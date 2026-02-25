import * as THREE from 'three';
import { FemShader } from './FemShader';

export class NastranModel {
    constructor(scene, parsedData, color = 0x64748b) {
        this.scene = scene;
        this.nodes = parsedData.nodes;
        this.elements = parsedData.elements;
        this.properties = parsedData.properties;
        this.materials = parsedData.materials;
        this.loads = parsedData.loads || [];
        this.constraints = parsedData.constraints || [];

        this.color = color;
        this.propertyPalette = [
            0x22c55e, 0x3b82f6, 0xf59e0b, 0xec4899,
            0x06b6d4, 0x8b5cf6, 0xef4444, 0x10b981
        ];

        this.initGeometry();
        this.initLabels();
        this.initStructuralVisuals();
    }

    initGeometry() {
        const vertices = [];
        const indices = [];
        const stress = [];

        const nodeToVertexIndex = new Map();
        let vertexCounter = 0;

        // Populate vertices
        this.nodes.forEach((pos, id) => {
            vertices.push(pos.x, pos.y, pos.z);
            nodeToVertexIndex.set(id, vertexCounter++);
            stress.push(Math.random());
        });

        // Populate indices based on elements
        for (const el of this.elements) {
            if (el.type === 'CQUAD4' || el.type === 'CTRIA3') {
                const i = el.nodes.map(nid => nodeToVertexIndex.get(nid));
                if (el.type === 'CQUAD4' && i.every(idx => idx !== undefined)) {
                    indices.push(i[0], i[1], i[2], i[0], i[2], i[3]);
                } else if (el.type === 'CTRIA3' && i.every(idx => idx !== undefined)) {
                    indices.push(i[0], i[1], i[2]);
                }
            } else if (el.type === 'CTETRA') {
                const i = el.nodes.map(nid => nodeToVertexIndex.get(nid));
                if (i.every(idx => idx !== undefined)) {
                    // Basic tetrahedron faces
                    indices.push(i[0], i[1], i[2], i[0], i[2], i[3], i[0], i[3], i[1], i[1], i[3], i[2]);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('stress', new THREE.Float32BufferAttribute(stress, 1));

        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(FemShader.uniforms),
            vertexShader: FemShader.vertexShader,
            fragmentShader: FemShader.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });

        material.uniforms.uColor.value.set(this.color);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isPart = true;
        this.mesh.userData.isNastran = true;
        this.mesh.userData.partInstance = this;

        // Custom Mesh/Edge Lines (Enhanced to include CBAR)
        const edgeVertices = [];
        for (const el of this.elements) {
            const p = el.nodes.map(nid => this.nodes.get(nid)).filter(n => !!n);
            if (p.length < 2) continue;

            if (el.type === 'CBAR') {
                edgeVertices.push(p[0].x, p[0].y, p[0].z, p[1].x, p[1].y, p[1].z);
            } else if (el.type === 'CQUAD4' && p.length === 4) {
                for (let i = 0; i < 4; i++) {
                    const n1 = p[i], n2 = p[(i + 1) % 4];
                    edgeVertices.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
                }
            } else if (el.type === 'CTRIA3' && p.length === 3) {
                for (let i = 0; i < 3; i++) {
                    const n1 = p[i], n2 = p[(i + 1) % 3];
                    edgeVertices.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
                }
            }
        }

        const edgeGeometry = new THREE.BufferGeometry();
        edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));
        const line = new THREE.LineSegments(edgeGeometry, new THREE.LineBasicMaterial({
            color: 0xffffff, opacity: 0.4, transparent: true, depthTest: false
        }));
        line.renderOrder = 100;
        this.mesh.add(line);

        this.scene.add(this.mesh);
    }

    initLabels() {
        this.gridLabels = new THREE.Group();
        this.elemLabels = new THREE.Group();
        this.gridLabels.visible = false;
        this.elemLabels.visible = false;
        this.mesh.add(this.gridLabels);
        this.mesh.add(this.elemLabels);

        this.nodes.forEach((pos, id) => {
            const sprite = this.createTextSprite(id.toString(), '#fbbf24');
            sprite.position.set(pos.x, pos.y, pos.z);
            this.gridLabels.add(sprite);
        });

        for (const el of this.elements) {
            const p = el.nodes.map(nid => this.nodes.get(nid)).filter(n => !!n);
            if (p.length < 2) continue;

            const centroid = new THREE.Vector3(0, 0, 0);
            p.forEach(n => {
                centroid.x += n.x;
                centroid.y += n.y;
                centroid.z += n.z;
            });
            centroid.divideScalar(p.length);

            const sprite = this.createTextSprite(el.id.toString(), '#38bdf8');
            sprite.position.copy(centroid);
            this.elemLabels.add(sprite);
        }
    }

    initStructuralVisuals() {
        this.loadVisuals = new THREE.Group();
        this.spcVisuals = new THREE.Group();
        this.loadVisuals.visible = false;
        this.spcVisuals.visible = false;
        this.mesh.add(this.loadVisuals);
        this.mesh.add(this.spcVisuals);

        // Loads (Arrows)
        for (const load of this.loads) {
            const node = this.nodes.get(load.nodeId);
            if (!node) continue;

            const dir = load.direction;
            const origin = new THREE.Vector3(node.x, node.y, node.z);
            const arrow = new THREE.ArrowHelper(dir, origin, 1.0, 0xef4444);
            this.loadVisuals.add(arrow);
        }

        // Constraints (Spheres)
        for (const spc of this.constraints) {
            const node = this.nodes.get(spc.nodeId);
            if (!node) continue;

            const geometry = new THREE.SphereGeometry(0.1, 8, 8);
            const material = new THREE.MeshBasicMaterial({ color: 0x22c55e });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.set(node.x, node.y, node.z);
            this.spcVisuals.add(sphere);
        }
    }

    setPropertyColoring(enabled) {
        // Placeholder for property-based coloring
        // In a real FEA app, we'd update vertex colors or a shader uniform
        console.log("Property coloring mode:", enabled);
    }

    setStructuralVisualsVisible(loadsVisible, spcVisible) {
        this.loadVisuals.visible = loadsVisible;
        this.spcVisuals.visible = spcVisible;
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 64;

        context.font = 'Bold 40px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.fillText(text, 64, 45);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.4, 0.2, 1);
        sprite.renderOrder = 200;
        return sprite;
    }

    setLabelsVisible(gridVisible, elemVisible) {
        this.gridLabels.visible = gridVisible;
        this.elemLabels.visible = elemVisible;
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }

    get sockets() {
        return [];
    }
}

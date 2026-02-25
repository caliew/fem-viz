import * as THREE from 'three';
import { FemShader } from './FemShader';

export class FloorplanModel {
    constructor(scene, points, height = 3, color = 0x64748b) {
        this.scene = scene;
        this.points = points;
        this.height = height;

        // 1. Create the Shape for the floor
        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        shape.closePath();

        // 2. Create Plane Geometry
        const geometry = new THREE.ShapeGeometry(shape);

        // Rotate geometry to lay flat on XZ plane (ShapeGeometry is originally XY)
        geometry.rotateX(Math.PI / 2);

        // Add dummy stress data attribute
        const count = geometry.attributes.position.count;
        const stressData = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            stressData[i] = Math.random();
        }
        geometry.setAttribute('stress', new THREE.BufferAttribute(stressData, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(FemShader.uniforms),
            vertexShader: FemShader.vertexShader,
            fragmentShader: FemShader.fragmentShader,
            transparent: true,
            side: THREE.DoubleSide
        });

        material.uniforms.uColor.value.set(color);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.y = 0.01; // Minimal offset to avoid z-fighting while staying flush with grid
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isPart = true;
        this.mesh.userData.isFloorplan = true;
        this.mesh.userData.partInstance = this;

        // Add edges visualization
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.3, transparent: true }));
        this.mesh.add(line);

        this.scene.add(this.mesh);
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }

    // Sockets are not really applicable for complex polygons 
    // without more logic, but we'll leave it empty to avoid crashes
    get sockets() {
        return [];
    }
}

import * as THREE from 'three';
import { FemShader } from './FemShader';

export class PartModel {
    constructor(scene, color = 0x2563eb) {
        this.scene = scene;

        // Create the main box geometry
        const geometry = new THREE.BoxGeometry(1, 1, 1);

        // Add dummy stress data attribute
        const count = geometry.attributes.position.count;
        const stressData = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            // Assign random stress values between 0.0 and 1.0 for demonstration
            stressData[i] = Math.random();
        }
        geometry.setAttribute('stress', new THREE.BufferAttribute(stressData, 1));

        const material = new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(FemShader.uniforms),
            vertexShader: FemShader.vertexShader,
            fragmentShader: FemShader.fragmentShader,
            transparent: true
        });

        material.uniforms.uColor.value.set(color);

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.userData.isPart = true;
        this.mesh.userData.partInstance = this;

        // Add edges visualization
        const edges = new THREE.EdgesGeometry(geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
        this.mesh.add(line);

        // Define Sockets (Attachment Points)
        // We'll add 6 sockets, one for each face
        this.sockets = [];
        this.createSockets();

        this.scene.add(this.mesh);
    }

    createSockets() {
        const socketPositions = [
            { pos: [0.5, 0, 0], rot: [0, Math.PI / 2, 0] },  // Right
            { pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left
            { pos: [0, 0.5, 0], rot: [-Math.PI / 2, 0, 0] }, // Top
            { pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0] },  // Bottom
            { pos: [0, 0, 0.5], rot: [0, 0, 0] },           // Front
            { pos: [0, 0, -0.5], rot: [0, Math.PI, 0] }      // Back
        ];

        socketPositions.forEach((config, index) => {
            const socket = new THREE.Object3D();
            socket.position.set(...config.pos);
            socket.rotation.set(...config.rot);
            socket.userData.socketIndex = index;
            socket.userData.parentPart = this;

            this.mesh.add(socket);
            this.sockets.push(socket);

            // Optional: Draw a small visual indicator for sockets (debug mode)
            /*
            const helperGeo = new THREE.SphereGeometry(0.05);
            const helperMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const helper = new THREE.Mesh(helperGeo, helperMat);
            socket.add(helper);
            */
        });
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }
}

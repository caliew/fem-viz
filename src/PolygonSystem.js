import * as THREE from 'three';

export class PolygonSystem {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.isActive = false;
        this.points = [];
        this.line = null;
        this.previewLine = null;
        this.pointMeshes = [];

        this.initVisuals();
    }

    initVisuals() {
        // Main polygon lines
        const lineGeometry = new THREE.BufferGeometry();
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x3b82f6,
            linewidth: 3,
            depthTest: false,
            transparent: true
        });
        this.line = new THREE.Line(lineGeometry, lineMaterial);
        this.line.renderOrder = 9999;
        this.line.visible = false;
        this.scene.add(this.line);

        // Preview line to current mouse position
        const previewGeometry = new THREE.BufferGeometry();
        const previewMaterial = new THREE.LineDashedMaterial({
            color: 0x3b82f6,
            dashSize: 0.2,
            gapSize: 0.1,
            opacity: 0.8,
            transparent: true,
            depthTest: false
        });
        this.previewLine = new THREE.Line(previewGeometry, previewMaterial);
        this.previewLine.renderOrder = 9999;
        this.previewLine.visible = false;
        this.scene.add(this.previewLine);
    }

    activate() {
        this.isActive = true;
        this.points = [];
        this.clearVisuals();
        this.line.visible = true;
        this.previewLine.visible = true;
    }

    deactivate() {
        this.isActive = false;
        this.clearVisuals();
        this.line.visible = false;
        this.previewLine.visible = false;
    }

    clearVisuals() {
        this.pointMeshes.forEach(mesh => this.scene.remove(mesh));
        this.pointMeshes = [];
        this.line.geometry.dispose();
        this.line.geometry = new THREE.BufferGeometry();
        this.previewLine.geometry.dispose();
        this.previewLine.geometry = new THREE.BufferGeometry();
    }

    addPoint(point) {
        // Snap to grid
        const snapped = new THREE.Vector3(
            Math.round(point.x),
            0.02, // Consistent low offset
            Math.round(point.z)
        );

        // Prevent duplicate points at the same location
        if (this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            if (lastPoint.distanceTo(snapped) < 0.1) return;
        }

        this.points.push(snapped);
        this.updateLine();
        this.addPointVisual(snapped, this.points.length === 1);
    }

    addPointVisual(position, isFirst = false) {
        const geometry = new THREE.SphereGeometry(isFirst ? 0.15 : 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: isFirst ? 0xef4444 : 0x3b82f6,
            depthTest: false,
            transparent: true
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        mesh.renderOrder = 10000;
        this.scene.add(mesh);
        this.pointMeshes.push(mesh);
    }

    updateLine() {
        if (this.points.length > 1) {
            const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
            this.line.geometry.dispose();
            this.line.geometry = geometry;
        }
    }

    updatePreview(point) {
        if (!this.isActive || this.points.length === 0) return;

        const snapped = new THREE.Vector3(
            Math.round(point.x),
            0.02,
            Math.round(point.z)
        );

        const previewPoints = [this.points[this.points.length - 1], snapped];
        const geometry = new THREE.BufferGeometry().setFromPoints(previewPoints);
        this.previewLine.geometry.dispose();
        this.previewLine.geometry = geometry;
        this.previewLine.computeLineDistances();
    }

    isClosingPoint(point) {
        if (this.points.length < 3) return false;

        const snapped = new THREE.Vector3(
            Math.round(point.x),
            0.02,
            Math.round(point.z)
        );

        const firstPoint = this.points[0];
        return snapped.distanceTo(firstPoint) < 0.6; // Threshold of 0.6 allows clicking the same cell or slightly off
    }

    finish() {
        if (this.points.length < 3) {
            console.warn("Need at least 3 points to finish polygon");
            return null;
        }

        const result = [...this.points];
        this.deactivate();
        return result;
    }
}

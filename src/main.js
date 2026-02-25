import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { PartModel } from './PartModel';
import { SnappingSystem } from './SnappingSystem';
import { PolygonSystem } from './PolygonSystem';
import { FloorplanModel } from './FloorplanModel';
import { NastranParser } from './NastranParser';
import { NastranModel } from './NastranModel';

class App {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.parts = [];
        this.selectedPart = null;
        this.isDragging = false;
        this.isLocked = false;
        this.isShaded = true; // New: Shade state
        this.currentColor = 0xef4444; // Default Red

        this.palette = {
            '1': 0xef4444, // Red
            '2': 0x22c55e, // Green
            '3': 0x3b82f6, // Blue
            '4': 0xeab308, // Yellow
            '5': 0xa855f7, // Purple
            '6': 0x06b6d4, // Cyan
            '7': 0xf97316, // Orange
            '8': 0xec4899, // Pink
            '9': 0xffffff  // White
        };

        this.showGridIDs = false;
        this.showElemIDs = false;
        this.showLoads = false;
        this.showSPC = false;

        this.statusElement = document.getElementById('status');

        this.initScene();
        this.initLights();
        this.initControls();
        this.initRaycaster();
        this.initSnapping();
        this.initPolygonSystem();
        this.initEventListeners();
        this.updateStatus(); // Sync UI on start

        this.animate();

        // Create initial parts
        this.addPart(0, 0.5, 0, 0xef4444); // Red block
        this.addPart(2, 0.5, 0, 0x22c55e); // Green block
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);

        // Add a grid for spatial reference (better than global axes)
        const grid = new THREE.GridHelper(20, 20, 0x333333, 0x222222);
        this.scene.add(grid);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(5, 5, 5);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
    }

    initLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        pointLight.castShadow = true;
        this.scene.add(pointLight);
    }

    initControls() {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
    }

    initRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.dragPlane = new THREE.Plane();
    }

    initSnapping() {
        this.snappingSystem = new SnappingSystem(this.scene, this.parts);
    }

    initPolygonSystem() {
        this.polygonSystem = new PolygonSystem(this.scene, this.camera, this.renderer);
    }

    addPart(x, y, z, color) {
        // Grid snapping: center of grid cells (offsets of 0.5)
        const snappedX = Math.floor(x) + 0.5;
        const snappedY = Math.floor(y) + 0.5;
        const snappedZ = Math.floor(z) + 0.5;

        const part = new PartModel(this.scene, color);
        part.setPosition(snappedX, snappedY, snappedZ);

        // Sync new part with current shade mode
        part.mesh.material.uniforms.uShowStress.value = this.isShaded ? 1.0 : 0.0;

        this.parts.push(part);
    }

    initEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        document.getElementById('add-part').addEventListener('click', () => {
            this.addPart(Math.random() * 6 - 3, 0.5, Math.random() * 6 - 3, this.currentColor);
        });

        document.getElementById('draw-room').addEventListener('click', () => {
            this.togglePolygonMode();
        });

        document.getElementById('import-nastran').addEventListener('click', () => {
            this.triggerNastranImport();
        });

        document.getElementById('toggle-grid-ids').addEventListener('click', () => {
            this.showGridIDs = !this.showGridIDs;
            this.updateLabelVisibility();
        });

        document.getElementById('toggle-elem-ids').addEventListener('click', () => {
            this.showElemIDs = !this.showElemIDs;
            this.updateLabelVisibility();
        });

        document.getElementById('toggle-loads').addEventListener('click', () => {
            this.showLoads = !this.showLoads;
            this.updateLabelVisibility();
        });

        document.getElementById('toggle-spc').addEventListener('click', () => {
            this.showSPC = !this.showSPC;
            this.updateLabelVisibility();
        });

        document.getElementById('reset-view').addEventListener('click', () => {
            this.resetView();
        });

        document.querySelectorAll('.color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                const key = swatch.getAttribute('data-key');
                if (this.palette[key]) {
                    this.changeColor(this.palette[key]);
                }
            });
        });

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this.renderer.domElement.setPointerCapture(e.pointerId);
            this.onPointerDown(e);
        });

        window.addEventListener('pointermove', (e) => this.onPointerMove(e));
        window.addEventListener('pointerup', (e) => {
            this.renderer.domElement.releasePointerCapture(e.pointerId);
            this.onPointerUp();
        });

        window.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'a') {
                this.addPart(Math.random() * 6 - 3, 0.5, Math.random() * 6 - 3, this.currentColor);
            } else if (key === 'f') {
                this.fitCameraToObjects();
            } else if (key === 'l') {
                this.toggleLock();
            } else if (key === 's') {
                this.toggleShade();
            } else if (key === 'd' || key === 'delete' || key === 'backspace') {
                this.deletePart();
            } else if (key === 'p') {
                this.togglePolygonMode();
            } else if (key === 'enter') {
                this.finishPolygon();
            } else if (key === 'r') {
                // Toggle rotation mode
                this.isReadyToRotate = !this.isReadyToRotate;
                if (this.isReadyToRotate) {
                    this.updateStatus('Rotation Mode: Press X, Y, or Z (R or ESC to exit)');
                } else {
                    this.updateStatus();
                }
            } else if (key === 'escape') {
                this.isReadyToRotate = false;
                this.updateStatus();
            } else if (this.isReadyToRotate && (key === 'x' || key === 'y' || key === 'z')) {
                this.rotatePart(key);
                // Don't turn off mode here so user can press multiple times
            } else if (this.palette[key]) {
                this.changeColor(this.palette[key]);
            }
        });
    }

    rotatePart(axis) {
        if (!this.selectedPart || this.isLocked) return;

        const angle = Math.PI / 4; // 45 degrees
        const vector = new THREE.Vector3();
        if (axis === 'x') vector.set(1, 0, 0);
        if (axis === 'y') vector.set(0, 1, 0);
        if (axis === 'z') vector.set(0, 0, 1);

        this.selectedPart.mesh.rotateOnAxis(vector, angle);
        this.selectedPart.mesh.updateMatrixWorld(); // Ensure world matrix is fresh for snapping

        // Update snapping after rotation
        const snapped = this.snappingSystem.checkSnap(this.selectedPart);

        // If snapped while rotating, we don't need to update dragOffset 
        // because the user isn't currently moving the mouse to drag.
    }

    togglePolygonMode() {
        if (this.polygonSystem.isActive) {
            this.polygonSystem.deactivate();
            this.controls.enabled = true;
            this.parts.forEach(part => {
                if (!part.mesh.userData.isFloorplan) {
                    part.mesh.visible = true;
                }
            });
            this.updateStatus();
        } else {
            this.polygonSystem.activate();
            this.controls.enabled = false;
            this.parts.forEach(part => {
                if (!part.mesh.userData.isFloorplan) {
                    part.mesh.visible = false;
                }
            });
            this.updateStatus('Drawing Mode: Click to add points, AUTO-CLOSE on first point, ESC to cancel');
        }
    }

    finishPolygon() {
        if (!this.polygonSystem.isActive) return;

        const points = this.polygonSystem.finish();
        if (points) {
            const floorplan = new FloorplanModel(this.scene, points, 3, this.currentColor);

            // Sync with current shade mode
            floorplan.mesh.material.uniforms.uShowStress.value = this.isShaded ? 1.0 : 0.0;

            this.parts.push(floorplan);
            this.updateStatus();
        }
    }

    triggerNastranImport() {
        // Hide all blocks when importing structural model
        this.parts.forEach(part => {
            if (!part.mesh.userData.isFloorplan) {
                part.mesh.visible = false;
            }
        });

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.bdf,.dat';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                this.loadNastran(event.target.result);
            };
            reader.readAsText(file);
        };
        input.click();
    }

    loadNastran(text) {
        try {
            const parser = new NastranParser();
            const data = parser.parse(text);

            if (data.elements.length === 0 && data.nodes.size === 0) {
                alert('No elements or nodes found in Nastran file.');
                return;
            }

            const model = new NastranModel(this.scene, data, this.currentColor);

            // Sync with current modes
            model.mesh.material.uniforms.uShowStress.value = this.isShaded ? 1.0 : 0.0;
            model.setLabelsVisible(this.showGridIDs, this.showElemIDs);
            model.setStructuralVisualsVisible(this.showLoads, this.showSPC);

            this.parts.push(model);

            // Auto-center camera on the new model assembly
            this.fitCameraToObjects();

            this.updateStatus(`Imported Nastran model: ${data.nodes.size} nodes, ${data.elements.length} elements`);
        } catch (error) {
            console.error("Nastran Import Error:", error);
            alert(`Error importing Nastran file: ${error.message}`);
        }
    }

    updateLabelVisibility() {
        this.parts.forEach(part => {
            if (part instanceof NastranModel) {
                part.setLabelsVisible(this.showGridIDs, this.showElemIDs);
                part.setStructuralVisualsVisible(this.showLoads, this.showSPC);
            }
        });
    }

    deletePart() {
        if (!this.selectedPart) return;

        // Remove from scene
        this.scene.remove(this.selectedPart.mesh);

        // Remove from parts array
        const index = this.parts.indexOf(this.selectedPart);
        if (index > -1) {
            this.parts.splice(index, 1);
        }

        this.selectedPart = null;
    }

    changeColor(color) {
        this.currentColor = color;
        if (this.selectedPart) {
            this.selectedPart.mesh.material.uniforms.uColor.value.set(color);
        }
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        this.updateStatus();
    }

    toggleShade() {
        this.isShaded = !this.isShaded;
        this.parts.forEach(part => {
            part.mesh.material.uniforms.uShowStress.value = this.isShaded ? 1.0 : 0.0;
        });
        this.updateStatus();
    }

    updateStatus(customMessage = null) {
        if (this.statusElement) {
            if (customMessage) {
                this.statusElement.innerHTML = `<span style="color: #fbbf24;">${customMessage}</span>`;
                return;
            }
            const lockStatus = this.isLocked ? '<span style="color: #ef4444;">LOCKED</span>' : '<span style="color: #22c55e;">UNLOCKED</span>';
            const shadeStatus = this.isShaded ? '<span style="color: #3b82f6;">STRESS</span>' : '<span style="color: #94a3b8;">SOLID</span>';
            this.statusElement.innerHTML = `Status: ${lockStatus} | Mode: ${shadeStatus}`;
        }
    }

    resetView() {
        this.camera.position.set(10, 10, 10);
        this.camera.lookAt(0, 0, 0);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        this.updateStatus('View Reset to Origin');
    }

    fitCameraToObjects() {
        if (this.parts.length === 0) {
            this.resetView();
            return;
        }

        const boundingBox = new THREE.Box3();
        this.parts.forEach(part => {
            if (part.mesh.visible) {
                boundingBox.expandByObject(part.mesh);
            }
        });

        // If no visible parts, don't change
        if (boundingBox.isEmpty()) return;

        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        const size = new THREE.Vector3();
        boundingBox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2.5; // Add some padding

        this.camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        this.controls.update();
    }

    onPointerDown(event) {
        if (this.isLocked) return;

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // --- DRAWING MODE HAS ABSOLUTE PRIORITY ---
        if (this.polygonSystem.isActive) {
            // Determine point on ground plane
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersectPoint = new THREE.Vector3();
            if (this.raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
                if (this.polygonSystem.isClosingPoint(intersectPoint)) {
                    this.finishPolygon();
                } else {
                    this.polygonSystem.addPoint(intersectPoint);
                }
            }
            return; // Exit early: do not pick objects or deselect while drawing
        }

        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // Find the first part hit
        let partFound = null;
        for (let intersect of intersects) {
            let current = intersect.object;
            while (current) {
                if (current.userData.isPart) {
                    partFound = current.userData.partInstance;
                    break;
                }
                current = current.parent;
            }
            if (partFound) break;
        }

        // --- Rest of selection logic remains the same ---

        // 1. Handle Deselection / Selection change
        if (this.selectedPart) {
            this.selectedPart.mesh.material.uniforms.uHighlight.value = 0.0;
        }

        if (partFound) {
            // ... (keep part selection logic)
            if (this.selectedPart !== partFound) {
                this.isReadyToRotate = false;
                this.updateStatus();
            }

            this.selectedPart = partFound;
            this.selectedPart.mesh.material.uniforms.uHighlight.value = 1.0;

            if (this.selectedPart.mesh.parent !== this.scene) {
                this.scene.attach(this.selectedPart.mesh);
            }

            this.isDragging = true;
            this.controls.enabled = false;

            const meshWorldPos = new THREE.Vector3();
            this.selectedPart.mesh.getWorldPosition(meshWorldPos);

            if (event.shiftKey) {
                const cameraRight = new THREE.Vector3().set(1, 0, 0).applyQuaternion(this.camera.quaternion);
                const planeNormal = new THREE.Vector3().crossVectors(cameraRight, new THREE.Vector3(0, 1, 0)).normalize();
                this.dragPlane.setFromNormalAndCoplanarPoint(planeNormal, meshWorldPos);
            } else {
                const normal = new THREE.Vector3(0, 1, 0);
                this.dragPlane.setFromNormalAndCoplanarPoint(normal, meshWorldPos);
            }

            const intersectPoint = new THREE.Vector3();
            this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint);
            this.dragOffset = new THREE.Vector3().copy(intersectPoint).sub(meshWorldPos);
        } else {
            this.selectedPart = null;
            this.isReadyToRotate = false;
            this.updateStatus();
        }
    }

    onPointerMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (!this.isDragging || !this.selectedPart) {
            if (this.polygonSystem.isActive) {
                // Update preview line in polygon mode
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersectPoint = new THREE.Vector3();
                if (this.raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
                    this.polygonSystem.updatePreview(intersectPoint);
                }
            }
            return;
        }

        const intersectPoint = new THREE.Vector3();

        if (this.raycaster.ray.intersectPlane(this.dragPlane, intersectPoint)) {
            // targetPos is in WORLD coordinates
            const targetWorldPos = intersectPoint.sub(this.dragOffset);

            // Grid snapping in world space
            targetWorldPos.x = Math.floor(targetWorldPos.x) + 0.5;
            targetWorldPos.y = Math.floor(targetWorldPos.y) + 0.5;
            targetWorldPos.z = Math.floor(targetWorldPos.z) + 0.5;

            // Convert targetWorldPos to LOCAL coordinates of the parent
            const localTargetPos = targetWorldPos.clone();
            if (this.selectedPart.mesh.parent) {
                this.selectedPart.mesh.parent.worldToLocal(localTargetPos);
            }

            this.selectedPart.mesh.position.copy(localTargetPos);
            this.selectedPart.mesh.updateMatrixWorld(); // Critical for snapping

            // Check for socket snapping
            this.snappingSystem.checkSnap(this.selectedPart);
        }
    }

    onPointerUp() {
        this.isDragging = false;
        this.controls.enabled = true;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

new App();

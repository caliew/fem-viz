import * as THREE from 'three';

export class SnappingSystem {
    constructor(scene, parts) {
        this.scene = scene;
        this.parts = parts; // Array of PartModel instances
        this.snapThreshold = 0.6; // Increased to 0.6 to overcome grid snapping (0.5)
    }

    checkSnap(draggedPart) {
        let bestSnap = null;
        let minDistance = Infinity;

        // 1. Find the closest pair of sockets
        // We need world positions of ALL sockets
        const draggedMesh = draggedPart.mesh;

        draggedPart.sockets.forEach(draggedSocket => {
            const draggedSocketWorldPos = new THREE.Vector3();
            draggedSocket.getWorldPosition(draggedSocketWorldPos);

            this.parts.forEach(targetPart => {
                // IMPORTANT: Skip if targetPart is the dragged part OR a child of it
                if (targetPart === draggedPart) return;

                // Skip if targetPart is currently nested under draggedPart somewhere
                let isDescendant = false;
                targetPart.mesh.traverseAncestors(ancestor => {
                    if (ancestor === draggedMesh) isDescendant = true;
                });
                if (isDescendant) return;

                targetPart.sockets.forEach(targetSocket => {
                    const targetSocketWorldPos = new THREE.Vector3();
                    targetSocket.getWorldPosition(targetSocketWorldPos);

                    const distance = draggedSocketWorldPos.distanceTo(targetSocketWorldPos);

                    if (distance < this.snapThreshold && distance < minDistance) {
                        minDistance = distance;
                        bestSnap = {
                            draggedSocket,
                            targetSocket,
                            targetPart
                        };
                    }
                });
            });
        });

        if (bestSnap) {
            this.applySnap(draggedPart, bestSnap);
            return true;
        }

        return false;
    }

    applySnap(draggedPart, snapInfo) {
        const { draggedSocket, targetSocket, targetPart } = snapInfo;

        // 1. Align Rotation based on Normals (Face-to-Face)
        // We want the dragged socket's Z-axis (Forward) to point exactly towards the target socket's Z-axis.
        // In world space, this means draggedSocket.worldZ = -targetSocket.worldZ.

        const targetWorldQuat = new THREE.Quaternion();
        targetSocket.getWorldQuaternion(targetWorldQuat);
        const targetNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(targetWorldQuat);
        const desiredNormal = targetNormal.clone().negate();

        const currentSocketWorldQuat = new THREE.Quaternion();
        draggedSocket.getWorldQuaternion(currentSocketWorldQuat);
        const currentNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(currentSocketWorldQuat);

        // Find the shortest rotation to align the two normals
        const alignQuat = new THREE.Quaternion().setFromUnitVectors(currentNormal, desiredNormal);

        // Apply this rotation to the whole mesh
        draggedPart.mesh.applyQuaternion(alignQuat);

        // Refresh world matrices after rotation so position math is accurate
        draggedPart.mesh.updateMatrixWorld();
        targetPart.mesh.updateMatrixWorld();

        // 2. Align Position (Snap Sockets)
        const targetWorldPos = new THREE.Vector3();
        targetSocket.getWorldPosition(targetWorldPos);

        const draggedSocketWorldPos = new THREE.Vector3();
        draggedSocket.getWorldPosition(draggedSocketWorldPos);

        const offset = new THREE.Vector3().subVectors(targetWorldPos, draggedSocketWorldPos);

        const meshWorldPos = new THREE.Vector3();
        draggedPart.mesh.getWorldPosition(meshWorldPos);
        const finalWorldPos = meshWorldPos.add(offset);

        if (draggedPart.mesh.parent) {
            draggedPart.mesh.parent.worldToLocal(finalWorldPos);
        }
        draggedPart.mesh.position.copy(finalWorldPos);

        // 3. Hierarchical Parenting
        // Attach the dragged part to the target part so they move/rotate together.
        targetPart.mesh.attach(draggedPart.mesh);

        // Final matrix update
        draggedPart.mesh.updateMatrixWorld();
    }
}

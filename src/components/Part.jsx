import React, { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { FemShader } from '../FemShader';

export function Part({ id, position, rotation = [0, 0, 0, 1], color, isShaded, isSelected, onSelect, onDrag, onDragEnd, isLocked, isDrawing }) {
    const geometry = useMemo(() => {
        const geo = new THREE.BoxGeometry(1, 1, 1);
        const count = geo.attributes.position.count;
        const stressData = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            stressData[i] = Math.random();
        }
        geo.setAttribute('stress', new THREE.BufferAttribute(stressData, 1));
        return geo;
    }, []);

    const meshRef = useRef();
    const { raycaster, camera, mouse, scene } = useThree();
    const dragPlane = useMemo(() => new THREE.Plane(), []);
    const dragOffset = useMemo(() => new THREE.Vector3(), []);
    const [isDragging, setIsDragging] = useState(false);

    const uniforms = useMemo(() => THREE.UniformsUtils.clone(FemShader.uniforms), []);
    const quat = useMemo(() => new THREE.Quaternion().fromArray(rotation), [rotation]);

    useMemo(() => {
        uniforms.uColor.value.set(color);
        uniforms.uShowStress.value = isShaded ? 1.0 : 0.0;
        uniforms.uHighlight.value = isSelected ? 1.0 : 0.0;
    }, [color, isShaded, isSelected, uniforms]);

    const handlePointerDown = (e) => {
        if (isLocked || isDrawing) return;
        e.stopPropagation();
        onSelect();

        // Disable OrbitControls while dragging
        if (window.__G_CONTROLS) window.__G_CONTROLS.enabled = false;
        e.target.setPointerCapture(e.pointerId);

        setIsDragging(true);
        const meshWorldPos = new THREE.Vector3();
        meshRef.current.getWorldPosition(meshWorldPos);

        if (e.shiftKey) {
            // Vertical movement plane
            const cameraDir = new THREE.Vector3();
            camera.getWorldDirection(cameraDir);
            const planeNormal = new THREE.Vector3(cameraDir.x, 0, cameraDir.z).normalize().negate();
            dragPlane.setFromNormalAndCoplanarPoint(planeNormal, meshWorldPos);
        } else {
            // Horizontal movement plane
            const normal = new THREE.Vector3(0, 1, 0);
            dragPlane.setFromNormalAndCoplanarPoint(normal, meshWorldPos);
        }

        const intersectPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(dragPlane, intersectPoint);
        dragOffset.copy(intersectPoint).sub(meshWorldPos);
    };

    const handlePointerMove = (e) => {
        if (!isDragging || isLocked) return;
        e.stopPropagation();

        const intersectPoint = new THREE.Vector3();
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
            const targetWorldPos = intersectPoint.sub(dragOffset);

            // Grid Snapping
            // Grid Snapping
            targetWorldPos.x = Math.floor(targetWorldPos.x) + 0.5;
            targetWorldPos.y = Math.floor(targetWorldPos.y) + 0.5;
            targetWorldPos.z = Math.floor(targetWorldPos.z) + 0.5;

            // MOVE MESH DIRECTLY FOR SMOOTH SNAPPING
            meshRef.current.position.set(targetWorldPos.x, targetWorldPos.y, targetWorldPos.z);
            meshRef.current.updateMatrixWorld();

            onDrag(id, targetWorldPos);
        }
    };

    const handlePointerUp = (e) => {
        if (isDragging) {
            setIsDragging(false);
            e.target.releasePointerCapture(e.pointerId);
            if (window.__G_CONTROLS) window.__G_CONTROLS.enabled = true;
            onDragEnd(id);
        }
    };

    return (
        <mesh
            ref={meshRef}
            position={position}
            quaternion={quat}
            geometry={geometry}
            castShadow
            receiveShadow
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            userData={{ isPart: true, partId: id }}
        >
            <shaderMaterial
                attach="material"
                args={[FemShader]}
                uniforms={uniforms}
                transparent
            />
            <lineSegments>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color="white" opacity={0.5} transparent />
            </lineSegments>

            {/* Sockets with orientation */}
            {[
                { pos: [0.5, 0, 0], rot: [0, Math.PI / 2, 0] },  // Right
                { pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left
                { pos: [0, 0.5, 0], rot: [-Math.PI / 2, 0, 0] }, // Top
                { pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0] },  // Bottom
                { pos: [0, 0, 0.5], rot: [0, 0, 0] },           // Front
                { pos: [0, 0, -0.5], rot: [0, Math.PI, 0] }      // Back
            ].map((config, i) => (
                <group key={i} position={config.pos} rotation={config.rot} userData={{ isSocket: true, socketIndex: i }} />
            ))}
        </mesh>
    );
}

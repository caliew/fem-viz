import React, { useMemo, useRef, useState, FC } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { FemShader } from '../FemShader';
import { VisMode } from '../types';

interface PartProps {
    id: string;
    position: [number, number, number];
    rotation?: [number, number, number, number];
    color: number;
    visMode: VisMode;
    visible?: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onDrag: (id: string, targetWorldPos: THREE.Vector3) => void;
    onDragEnd: (id: string) => void;
    isLocked: boolean;
    isDrawing: boolean;
}

export const Part: FC<PartProps> = ({
    id,
    position,
    rotation = [0, 0, 0, 1],
    color,
    visMode,
    visible = true,
    isSelected,
    onSelect,
    onDrag,
    onDragEnd,
    isLocked,
    isDrawing
}) => {
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

    const meshRef = useRef<THREE.Mesh>(null!);
    const { raycaster, camera, mouse } = useThree();
    const dragPlane = useMemo(() => new THREE.Plane(), []);
    const dragOffset = useMemo(() => new THREE.Vector3(), []);
    const [isDragging, setIsDragging] = useState(false);

    const uniforms = useMemo(() => THREE.UniformsUtils.clone(FemShader.uniforms), []);
    const quat = useMemo(() => new THREE.Quaternion().fromArray(rotation), [rotation]);

    useMemo(() => {
        uniforms.uColor.value.set(color);
        uniforms.uUseVertexColor.value = 0.0; // Use uColor

        let modeVal = 0; // Contour/Stress
        if (visMode === 'shaded') modeVal = 1;
        if (visMode === 'hidden') modeVal = 2;
        if (visMode === 'freeedge') modeVal = 3;
        uniforms.uVisMode.value = modeVal;

        uniforms.uHighlight.value = isSelected ? 1.0 : 0.0;
    }, [color, visMode, isSelected, uniforms]);

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (!visible || isLocked || isDrawing) return;
        e.stopPropagation();
        onSelect();

        // Disable OrbitControls while dragging
        const controls = (window as any).__G_CONTROLS;
        if (controls) controls.enabled = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

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

    const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
        if (!isDragging || isLocked) return;
        e.stopPropagation();

        const intersectPoint = new THREE.Vector3();
        raycaster.setFromCamera(mouse, camera);
        if (raycaster.ray.intersectPlane(dragPlane, intersectPoint)) {
            const targetWorldPos = intersectPoint.sub(dragOffset);

            // Grid Snapping
            targetWorldPos.x = Math.floor(targetWorldPos.x) + 0.5;
            targetWorldPos.y = Math.floor(targetWorldPos.y) + 0.5;
            targetWorldPos.z = Math.floor(targetWorldPos.z) + 0.5;

            onDrag(id, targetWorldPos);
        }
    };

    const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
        if (isDragging) {
            setIsDragging(false);
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            const controls = (window as any).__G_CONTROLS;
            if (controls) controls.enabled = true;
            onDragEnd(id);
        }
    };

    if (!visible) return null;

    const showMesh = visMode !== 'wireframe';

    return (
        <group position={position} quaternion={quat}>
            {showMesh && (
                <mesh
                    ref={meshRef}
                    geometry={geometry}
                    castShadow
                    receiveShadow
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    userData={{ isPart: true, partId: id }}
                >
                    <shaderMaterial
                        key={`shader-${visMode}`}
                        attach="material"
                        args={[FemShader]}
                        uniforms={uniforms}
                        transparent
                        depthTest={true}
                    />
                </mesh>
            )}

            <lineSegments
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
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
                <group
                    key={i}
                    position={config.pos as [number, number, number]}
                    rotation={config.rot as [number, number, number]}
                    userData={{ isSocket: true, socketIndex: i }}
                />
            ))}
        </group>
    );
};

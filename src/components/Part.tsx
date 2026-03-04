import React, { useMemo, useRef, useState, FC } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { FemShader } from '../FemShader';
import { VisMode } from '../types';

interface PartProps {
    id: string;
    position: [number, number, number];
    quaternion: [number, number, number, number]; // stores quaternion
    color: number;
    visMode: VisMode;
    visible?: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onDrag: (id: string, targetWorldPos: THREE.Vector3) => void;
    onDragEnd: (id: string) => void;
    isLocked: boolean;
    isDrawing: boolean;
    isJoining?: boolean;
    onSocketClick?: (partId: string, socketIndex: number) => void;
    selectionInfo?: { partId: string, socketIndex: number } | null;
    groupId?: string;
}

export const Part: FC<PartProps> = ({
    id,
    position,
    quaternion,
    color,
    visMode,
    visible = true,
    isSelected,
    onSelect,
    onDrag,
    onDragEnd,
    isLocked,
    isDrawing,
    isJoining,
    onSocketClick,
    selectionInfo,
    groupId
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
    const quatObj = useMemo(() => new THREE.Quaternion().fromArray(quaternion), [quaternion]);

    const uniforms = useMemo(() => THREE.UniformsUtils.clone(FemShader.uniforms), []);

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
        if (!visible || isLocked || isDrawing || isJoining) return;
        e.stopPropagation();
        onSelect();

        // Disable OrbitControls while dragging
        const controls = (window as any).__G_CONTROLS;
        if (controls) controls.enabled = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        setIsDragging(true);
        if (!meshRef.current) return;
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
        <group userData={{ isPart: true, partId: id, groupId }} position={position} quaternion={quatObj}>
            {showMesh && (
                <mesh
                    ref={meshRef}
                    geometry={geometry}
                    castShadow
                    receiveShadow
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <shaderMaterial
                        key={`shader-${visMode}`}
                        attach="material"
                        args={[FemShader]}
                        uniforms={uniforms}
                        transparent
                        depthTest={true}
                        polygonOffset
                        polygonOffsetFactor={1}
                        polygonOffsetUnits={1}
                    />
                </mesh>
            )}

            <lineSegments
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                scale={[1.02, 1.02, 1.02]}
            >
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color={groupId ? "#00ff00" : "white"} opacity={1.0} transparent={false} linewidth={2} />
            </lineSegments>

            {/* Sockets with orientation */}
            {[
                { pos: [0.5, 0, 0], rot: [0, Math.PI / 2, 0] },  // Right
                { pos: [-0.5, 0, 0], rot: [0, -Math.PI / 2, 0] }, // Left
                { pos: [0, 0.5, 0], rot: [-Math.PI / 2, 0, 0] }, // Top
                { pos: [0, -0.5, 0], rot: [Math.PI / 2, 0, 0] },  // Bottom
                { pos: [0, 0, 0.5], rot: [0, 0, 0] },           // Front
                { pos: [0, 0, -0.5], rot: [0, Math.PI, 0] }      // Back
            ].map((config, i) => {
                const isThisSelected = selectionInfo?.partId === id && selectionInfo?.socketIndex === i;
                return (
                    <group
                        key={i}
                        position={config.pos as [number, number, number]}
                        rotation={config.rot as [number, number, number]}
                        userData={{ isSocket: true, socketIndex: i }}
                    >
                        {isJoining && (
                            <mesh
                                onPointerDown={(e) => {
                                    e.stopPropagation();
                                    onSocketClick?.(id, i);
                                }}
                                onPointerOver={(e) => {
                                    e.stopPropagation();
                                    const mesh = e.object as THREE.Mesh;
                                    (mesh.material as THREE.MeshBasicMaterial).color.set('#fcd34d');
                                }}
                                onPointerOut={(e) => {
                                    e.stopPropagation();
                                    const mesh = e.object as THREE.Mesh;
                                    (mesh.material as THREE.MeshBasicMaterial).color.set(isThisSelected ? '#ef4444' : '#6366f1');
                                }}
                            >
                                <sphereGeometry args={[0.12, 16, 16]} />
                                <meshBasicMaterial color={isThisSelected ? '#ef4444' : '#6366f1'} transparent opacity={0.8} depthTest={false} />
                            </mesh>
                        )}
                    </group>
                );
            })}
        </group>
    );
};

import React, { useMemo, useRef, useState, FC } from 'react';
import * as THREE from 'three';
import { useThree, ThreeEvent } from '@react-three/fiber';
import { FemShader } from '../../shaders/FemShader';
import { VisMode } from '../../types';

interface FloorplanModelCompProps {
    id: string;
    points?: THREE.Vector3[];
    position: [number, number, number];
    color: number;
    visMode: VisMode;
    visible?: boolean;
    isSelected: boolean;
    onSelect: () => void;
    onDrag: (id: string, targetWorldPos: THREE.Vector3) => void;
    onDragEnd: (id: string) => void;
    isLocked?: boolean;
    isDrawing?: boolean;
    groupId?: string;
    quaternion: [number, number, number, number];
    isJoining?: boolean;
    isEditMode: boolean;
}

export const FloorplanModelComp: FC<FloorplanModelCompProps> = ({
    id,
    points,
    position,
    color,
    visMode,
    visible = true,
    isSelected,
    onSelect,
    onDrag,
    onDragEnd,
    isLocked,
    isDrawing,
    groupId,
    quaternion,
    isJoining,
    isEditMode
}) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const { raycaster, camera, mouse } = useThree();
    const quatObj = useMemo(() => new THREE.Quaternion().fromArray(quaternion), [quaternion]);
    const dragPlane = useMemo(() => new THREE.Plane(), []);
    const dragOffset = useMemo(() => new THREE.Vector3(), []);
    const [isDragging, setIsDragging] = useState(false);

    const geometry = useMemo(() => {
        if (!points || points.length < 3) return null;

        const shape = new THREE.Shape();
        shape.moveTo(points[0].x, points[0].z);
        for (let i = 1; i < points.length; i++) {
            shape.lineTo(points[i].x, points[i].z);
        }
        shape.closePath();

        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(Math.PI / 2);

        const count = geo.attributes.position.count;
        const stressData = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            stressData[i] = Math.random();
        }
        geo.setAttribute('stress', new THREE.BufferAttribute(stressData, 1));
        return geo;
    }, [points]);

    const uniforms = useMemo(() => THREE.UniformsUtils.clone(FemShader.uniforms), []);

    useMemo(() => {
        uniforms.uColor.value.set(color);
        uniforms.uUseVertexColor.value = 0.0;

        let modeVal = 0; // Contour
        if (visMode === 'shaded') modeVal = 1;
        if (visMode === 'hidden') modeVal = 2;
        if (visMode === 'freeedge') modeVal = 3;
        uniforms.uVisMode.value = modeVal;
        uniforms.uHighlight.value = isSelected ? 1.0 : 0.0;
    }, [color, visMode, isSelected, uniforms]);

    if (!geometry || !visible) return null;

    const showMesh = visMode !== 'wireframe';

    const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
        if (!visible || isLocked || isDrawing || isJoining || !isEditMode) return;
        e.stopPropagation();

        if (!isSelected) {
            onSelect();
            return;
        }

        // Disable OrbitControls while dragging
        const controls = (window as any).__G_CONTROLS;
        if (controls) controls.enabled = false;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);

        setIsDragging(true);
        if (!meshRef.current) return;
        const meshWorldPos = new THREE.Vector3();
        meshRef.current.getWorldPosition(meshWorldPos);

        // Floorplan always moves on XZ plane
        const normal = new THREE.Vector3(0, 1, 0);
        dragPlane.setFromNormalAndCoplanarPoint(normal, meshWorldPos);

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

            // Grid Snapping (Floored for floorplan typically)
            targetWorldPos.x = Math.floor(targetWorldPos.x + 0.5);
            targetWorldPos.y = position[1]; // Maintain current Y
            targetWorldPos.z = Math.floor(targetWorldPos.z + 0.5);

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

    return (
        <group userData={{ isPart: true, partId: id, groupId }} position={position} quaternion={quatObj}>
            {showMesh && (
                <mesh
                    ref={meshRef}
                    key={`floorplan-mesh-${visMode}`}
                    geometry={geometry}
                    castShadow
                    receiveShadow
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <shaderMaterial
                        attach="material"
                        vertexShader={FemShader.vertexShader}
                        fragmentShader={FemShader.fragmentShader}
                        uniforms={uniforms}
                        transparent
                        side={THREE.DoubleSide}
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
                <lineBasicMaterial color={groupId ? "#00ff00" : "white"} opacity={1.0} transparent={false} />
            </lineSegments>
        </group>
    );
};

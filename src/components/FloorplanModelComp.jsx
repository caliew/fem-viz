import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FemShader } from '../FemShader';

export function FloorplanModelComp({ id, points, color, visMode, visible = true, isSelected, onSelect }) {
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

    const uniforms = useMemo(() => {
        const u = THREE.UniformsUtils.clone(FemShader.uniforms);
        u.uColor.value.set(color);
        u.uUseVertexColor.value = 0.0;

        let modeVal = 0; // Contour
        if (visMode === 'shaded') modeVal = 1;
        if (visMode === 'hidden') modeVal = 2;
        u.uVisMode.value = modeVal;
        u.uHighlight.value = isSelected ? 1.0 : 0.0;
        return u;
    }, [color, visMode, isSelected]);

    if (!geometry || !visible) return null;

    const showMesh = visMode !== 'wireframe';

    const handlePointerDown = (e) => {
        e.stopPropagation();
        onSelect();
    };

    return (
        <group position={[0, 0.01, 0]}>
            {showMesh && (
                <mesh
                    key={`floorplan-mesh-${visMode}`}
                    geometry={geometry}
                    castShadow
                    receiveShadow
                    onPointerDown={handlePointerDown}
                    userData={{ isPart: true, partId: id }}
                >
                    <shaderMaterial
                        attach="material"
                        vertexShader={FemShader.vertexShader}
                        fragmentShader={FemShader.fragmentShader}
                        uniforms={uniforms}
                        transparent
                        side={THREE.DoubleSide}
                        polygonOffset
                        polygonOffsetFactor={1}
                        polygonOffsetUnits={1}
                    />
                </mesh>
            )}
            <lineSegments onPointerDown={handlePointerDown}>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color="white" opacity={0.6} transparent />
            </lineSegments>
        </group>
    );
}

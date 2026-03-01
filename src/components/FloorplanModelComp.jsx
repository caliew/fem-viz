import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FemShader } from '../FemShader';

export function FloorplanModelComp({ points, color, isShaded }) {
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
        u.uShowStress.value = isShaded ? 1.0 : 0.0;
        return u;
    }, [color, isShaded]);

    if (!geometry) return null;

    return (
        <mesh geometry={geometry} position={[0, 0.01, 0]} castShadow receiveShadow>
            <shaderMaterial attach="material" args={[FemShader]} uniforms={uniforms} transparent side={THREE.DoubleSide} />
            <lineSegments>
                <edgesGeometry args={[geometry]} />
                <lineBasicMaterial color="white" opacity={0.3} transparent />
            </lineSegments>
        </mesh>
    );
}

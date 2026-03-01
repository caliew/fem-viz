import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function DrawingSystem({ onFinish, onCancel }) {
    const { raycaster, mouse, camera, scene } = useThree();
    const [points, setPoints] = useState([]);
    const [previewPoint, setPreviewPoint] = useState(null);

    const lineRef = useRef();
    const previewLineRef = useRef();

    const handlePointerDown = (e) => {
        e.stopPropagation();

        // Intersect with ground plane (XZ, y=0)
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.setFromCamera(mouse, camera);

        if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
            const snapped = new THREE.Vector3(
                Math.round(intersectPoint.x),
                0.02,
                Math.round(intersectPoint.z)
            );

            // Check if closing polygon
            if (points.length >= 3) {
                const firstPoint = points[0];
                if (snapped.distanceTo(firstPoint) < 0.6) {
                    onFinish(points);
                    return;
                }
            }

            // Prevent duplicate points
            if (points.length > 0) {
                const lastPoint = points[points.length - 1];
                if (lastPoint.distanceTo(snapped) < 0.1) return;
            }

            setPoints([...points, snapped]);
        }
    };

    useFrame(() => {
        if (points.length === 0) return;

        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectPoint = new THREE.Vector3();
        raycaster.setFromCamera(mouse, camera);

        if (raycaster.ray.intersectPlane(plane, intersectPoint)) {
            const snapped = new THREE.Vector3(
                Math.round(intersectPoint.x),
                0.02,
                Math.round(intersectPoint.z)
            );
            setPreviewPoint(snapped);
        }
    });

    const lineGeometry = useMemo(() => {
        if (points.length < 2) return new THREE.BufferGeometry();
        return new THREE.BufferGeometry().setFromPoints(points);
    }, [points]);

    const previewGeometry = useMemo(() => {
        if (points.length === 0 || !previewPoint) return new THREE.BufferGeometry();
        return new THREE.BufferGeometry().setFromPoints([points[points.length - 1], previewPoint]);
    }, [points, previewPoint]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && points.length >= 3) onFinish(points);
            if (e.key === 'Escape') onCancel();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [points, onFinish, onCancel]);

    return (
        <group onPointerDown={handlePointerDown}>
            {/* Catch-all plane for clicks - Priority is key to avoid block interference */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
                <planeGeometry args={[1000, 1000]} />
                <meshBasicMaterial transparent opacity={0} />
            </mesh>

            <line geometry={lineGeometry}>
                <lineBasicMaterial color="#3b82f6" linewidth={3} depthTest={false} transparent />
            </line>

            <line geometry={previewGeometry}>
                <lineDashedMaterial color="#3b82f6" dashSize={0.2} gapSize={0.1} opacity={0.8} transparent depthTest={false} />
            </line>

            {/* Point Markers */}
            {points.map((p, i) => (
                <mesh key={i} position={p}>
                    <sphereGeometry args={[i === 0 ? 0.15 : 0.1]} />
                    <meshBasicMaterial color={i === 0 ? '#ef4444' : '#3b82f6'} depthTest={false} transparent />
                </mesh>
            ))}
        </group>
    );
}

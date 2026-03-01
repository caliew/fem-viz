import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FemShader } from '../FemShader';
import { Html } from '@react-three/drei';

export function NastranModelComp({ data, color, visMode, showGridIDs, showElemIDs, showLoads, showSPC }) {
    const { nodes, elements, loads } = data;

    const { geometry, edges, elLabels } = useMemo(() => {
        const vertices = [];
        const indices = [];
        const stress = [];
        const vertexColors = [];
        let vertexCounter = 0;

        // PID to Color mapping
        const pidColors = new Map();
        const getPidColor = (pid) => {
            if (!pidColors.has(pid)) {
                const c = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
                pidColors.set(pid, [c.r, c.g, c.b]);
            }
            return pidColors.get(pid);
        };

        // We duplicate vertices per element to ensure sharp PID boundaries and flat shading
        elements.forEach(el => {
            if (el.type === 'CQUAD4' || el.type === 'CTRIA3') {
                const pNodes = el.nodes.map(nid => nodes.get(nid));
                if (pNodes.some(n => !n)) return;

                const c = getPidColor(el.pid || 0);
                const startIdx = vertices.length / 3;

                pNodes.forEach(n => {
                    vertices.push(n.x, n.y, n.z);
                    stress.push(Math.random());
                    vertexColors.push(c[0], c[1], c[2]);
                });

                if (el.type === 'CQUAD4') {
                    indices.push(startIdx, startIdx + 1, startIdx + 2, startIdx, startIdx + 2, startIdx + 3);
                } else if (el.type === 'CTRIA3') {
                    indices.push(startIdx, startIdx + 1, startIdx + 2);
                }
            }
        });

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('stress', new THREE.Float32BufferAttribute(stress, 1));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        // Elem Labels
        const labels = [];
        for (const el of elements) {
            const p = el.nodes.map(nid => nodes.get(nid)).filter(n => !!n);
            if (p.length < 2) continue;

            const centroid = new THREE.Vector3(0, 0, 0);
            p.forEach(n => {
                centroid.x += n.x;
                centroid.y += n.y;
                centroid.z += n.z;
            });
            centroid.divideScalar(p.length);
            labels.push({ id: el.id, pos: [centroid.x, centroid.y, centroid.z] });
        }

        // Edges
        const edgeVertices = [];
        for (const el of elements) {
            const p = el.nodes.map(nid => nodes.get(nid)).filter(n => !!n);
            if (p.length < 2) continue;
            if (el.type === 'CBAR') {
                edgeVertices.push(p[0].x, p[0].y, p[0].z, p[1].x, p[1].y, p[1].z);
            } else if (el.type === 'CQUAD4' && p.length === 4) {
                for (let i = 0; i < 4; i++) {
                    const n1 = p[i], n2 = p[(i + 1) % 4];
                    edgeVertices.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
                }
            } else if (el.type === 'CTRIA3' && p.length === 3) {
                for (let i = 0; i < 3; i++) {
                    const n1 = p[i], n2 = p[(i + 1) % 3];
                    edgeVertices.push(n1.x, n1.y, n1.z, n2.x, n2.y, n2.z);
                }
            }
        }
        const edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3));

        return { geometry: geo, edges: edgeGeo, elLabels: labels };
    }, [nodes, elements]);

    const uniforms = useMemo(() => {
        const u = THREE.UniformsUtils.clone(FemShader.uniforms);
        u.uColor.value.set(color);

        // Mode Mapping: 0: Contour, 1: Shaded, 2: HiddenLine
        let modeVal = 0;
        if (visMode === 'shaded') modeVal = 1;
        if (visMode === 'hidden') modeVal = 2;
        u.uVisMode.value = modeVal;

        return u;
    }, [color, visMode]);

    const showMesh = visMode !== 'wireframe';

    return (
        <group>
            {showMesh && (
                <mesh geometry={geometry} castShadow receiveShadow>
                    <shaderMaterial
                        attach="material"
                        args={[FemShader]}
                        uniforms={uniforms}
                        transparent
                        side={THREE.DoubleSide}
                        polygonOffset
                        polygonOffsetFactor={1}
                        polygonOffsetUnits={1}
                    />
                </mesh>
            )}
            <lineSegments geometry={edges}>
                <lineBasicMaterial color="white" opacity={0.6} depthTest={true} transparent />
            </lineSegments>

            {/* Grid Labels */}
            {showGridIDs && Array.from(nodes).map(([id, pos]) => (
                <Html key={`node-${id}`} position={[pos.x, pos.y, pos.z]} center distanceFactor={15}>
                    <div style={{ color: '#fbbf24', fontSize: '10px', pointerEvents: 'none', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', padding: '1px 2px', borderRadius: '2px' }}>{id}</div>
                </Html>
            ))}

            {/* Elem Labels */}
            {showElemIDs && elLabels.map((lab, idx) => (
                <Html key={`elem-${lab.id}-${idx}`} position={lab.pos} center distanceFactor={15}>
                    <div style={{ color: '#38bdf8', fontSize: '10px', pointerEvents: 'none', fontWeight: 'bold', background: 'rgba(0,0,0,0.5)', padding: '1px 2px', borderRadius: '2px' }}>{lab.id}</div>
                </Html>
            ))}

            {/* Loads (Simple representation) */}
            {showLoads && loads.map((load, idx) => {
                const node = nodes.get(load.nodeId);
                if (!node) return null;
                return (
                    <primitive
                        key={`load-${idx}`}
                        object={new THREE.ArrowHelper(
                            new THREE.Vector3(load.direction.x, load.direction.y, load.direction.z),
                            new THREE.Vector3(node.x, node.y, node.z),
                            1, 0xef4444
                        )}
                    />
                );
            })}
        </group>
    );
}


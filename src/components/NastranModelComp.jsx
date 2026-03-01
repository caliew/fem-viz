import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FemShader } from '../FemShader';
import { Html } from '@react-three/drei';

export function NastranModelComp({ data, color, visMode, showGridIDs, showElemIDs, showLoads, showSPC, visible = true }) {
    const { nodes, elements, loads } = data;

    const { geometry, freeEdges, interiorEdges, elLabels, bars } = useMemo(() => {
        const vertices = [];
        const indices = [];
        const stress = [];
        const vertexColors = [];
        const barData = [];

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
                    // Use a spatial gradient for stress to look realistic
                    stress.push(Math.abs(n.y) / 10.0);
                    vertexColors.push(c[0], c[1], c[2]);
                });

                if (el.type === 'CQUAD4') {
                    indices.push(startIdx, startIdx + 1, startIdx + 2, startIdx, startIdx + 2, startIdx + 3);
                } else if (el.type === 'CTRIA3') {
                    indices.push(startIdx, startIdx + 1, startIdx + 2);
                }
            } else if (el.type === 'CBAR') {
                const p1 = nodes.get(el.nodes[0]);
                const p2 = nodes.get(el.nodes[1]);
                if (p1 && p2) {
                    const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
                    const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
                    const dist = v1.distanceTo(v2);
                    const center = v1.clone().add(v2).multiplyScalar(0.5);
                    const dir = v2.clone().sub(v1).normalize();
                    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                    const c = getPidColor(el.pid || 0);
                    barData.push({ id: el.id, pos: center, quat, height: dist, color: new THREE.Color(c[0], c[1], c[2]) });
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

        // Edge Analysis for Free Edges (Outline)
        const edgeMap = new Map();
        const addEdge = (n1, n2) => {
            const k = [n1, n2].sort((a, b) => a - b).join('-');
            edgeMap.set(k, (edgeMap.get(k) || 0) + 1);
        };

        for (const el of elements) {
            const p = el.nodes;
            if (el.type === 'CQUAD4' && p.length === 4) {
                addEdge(p[0], p[1]); addEdge(p[1], p[2]); addEdge(p[2], p[3]); addEdge(p[3], p[0]);
            } else if (el.type === 'CTRIA3' && p.length === 3) {
                addEdge(p[0], p[1]); addEdge(p[1], p[2]); addEdge(p[2], p[0]);
            }
        }

        const freeEdgeVertices = [];
        const interiorEdgeVertices = [];

        // Build Edge Geometries
        edgeMap.forEach((count, key) => {
            const [n1Id, n2Id] = key.split('-').map(Number);
            const p1 = nodes.get(n1Id);
            const p2 = nodes.get(n2Id);
            if (p1 && p2) {
                if (count === 1) {
                    freeEdgeVertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                } else {
                    interiorEdgeVertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                }
            }
        });

        // Add CBARs to Free Edges (they are always prominent)
        for (const el of elements) {
            if (el.type === 'CBAR') {
                const p1 = nodes.get(el.nodes[0]);
                const p2 = nodes.get(el.nodes[1]);
                if (p1 && p2) {
                    freeEdgeVertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                }
            }
        }

        const freeEdgeGeo = new THREE.BufferGeometry();
        freeEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(freeEdgeVertices, 3));

        const interiorEdgeGeo = new THREE.BufferGeometry();
        interiorEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(interiorEdgeVertices, 3));

        return { geometry: geo, freeEdges: freeEdgeGeo, interiorEdges: interiorEdgeGeo, elLabels: labels, bars: barData };
    }, [nodes, elements]);

    const uniforms = useMemo(() => {
        const u = THREE.UniformsUtils.clone(FemShader.uniforms);
        u.uColor.value.set(color);
        u.uUseVertexColor.value = 1.0;

        let modeVal = 0; // Contour
        if (visMode === 'shaded') modeVal = 1;
        if (visMode === 'hidden') modeVal = 2;
        u.uVisMode.value = modeVal;
        return u;
    }, [color, visMode]);

    const showMesh = visMode !== 'wireframe';

    if (!visible) return null;

    return (
        <group userData={{ isNastran: true }}>
            {showMesh && (
                <mesh key={`nastran-mesh-${visMode}`} geometry={geometry} castShadow receiveShadow userData={{ isNastran: true }}>
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

            {showMesh && bars.map(bar => (
                <mesh key={`bar-${bar.id}-${visMode}`} position={bar.pos} quaternion={bar.quat} castShadow receiveShadow userData={{ isNastran: true }}>
                    <cylinderGeometry args={[0.03, 0.03, bar.height, 8]} />
                    <shaderMaterial
                        attach="material"
                        vertexShader={FemShader.vertexShader}
                        fragmentShader={FemShader.fragmentShader}
                        uniforms={{
                            ...uniforms,
                            uColor: { value: bar.color },
                            uUseVertexColor: { value: 0.0 } // Use uniform color for bar
                        }}
                        transparent
                        side={THREE.DoubleSide}
                    />
                </mesh>
            ))}

            {/* Free Edges (Outline) - Always prominent */}
            <lineSegments geometry={freeEdges} userData={{ isNastran: true }}>
                <lineBasicMaterial color="white" opacity={0.8} depthTest={true} transparent />
            </lineSegments>

            {/* Interior Edges - Dimmed or Hidden in non-wireframe modes */}
            <lineSegments geometry={interiorEdges} userData={{ isNastran: true }}>
                <lineBasicMaterial
                    color="white"
                    opacity={visMode === 'wireframe' ? 0.6 : 0.05}
                    depthTest={true}
                    transparent
                    visible={visMode === 'wireframe' || visMode !== 'hidden'}
                />
            </lineSegments>

            {/* Grid Labels */}
            {showGridIDs && Array.from(nodes).map(([id, pos]) => (
                <Html key={`node-${id}`} position={[pos.x, pos.y, pos.z]} center distanceFactor={10}>
                    <div style={{ color: '#fbbf24', fontSize: '3px', fontWeight: 'normal', background: 'rgba(0,0,0,0.6)', padding: '1px 2px', borderRadius: '2px', pointerEvents: 'none' }}>{id}</div>
                </Html>
            ))}

            {/* Elem Labels */}
            {showElemIDs && elLabels.map((lab, idx) => (
                <Html key={`elem-${lab.id}-${idx}`} position={lab.pos} center distanceFactor={10}>
                    <div style={{ color: '#38bdf8', fontSize: '3px', fontWeight: 'normal', background: 'rgba(0,0,0,0.6)', padding: '1px 2px', borderRadius: '2px', pointerEvents: 'none' }}>{lab.id}</div>
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


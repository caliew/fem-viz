import React, { useMemo } from 'react';
import * as THREE from 'three';
import { FemShader } from '../FemShader';
import { Html } from '@react-three/drei';

export function NastranModelComp({ data, color, showGridIDs, showElemIDs, showLoads, showSPC }) {
    const { nodes, elements, loads } = data;

    const { geometry, edges, elLabels } = useMemo(() => {
        const vertices = [];
        const indices = [];
        const stress = [];
        const nodeToVertexIndex = new Map();
        let vertexCounter = 0;

        // Populate vertices
        nodes.forEach((pos, id) => {
            vertices.push(pos.x, pos.y, pos.z);
            nodeToVertexIndex.set(id, vertexCounter++);
            stress.push(Math.random());
        });

        // Populate indices
        for (const el of elements) {
            if (el.type === 'CQUAD4' || el.type === 'CTRIA3') {
                const i = el.nodes.map(nid => nodeToVertexIndex.get(nid));
                if (el.type === 'CQUAD4' && i.every(idx => idx !== undefined)) {
                    indices.push(i[0], i[1], i[2], i[0], i[2], i[3]);
                } else if (el.type === 'CTRIA3' && i.every(idx => idx !== undefined)) {
                    indices.push(i[0], i[1], i[2]);
                }
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('stress', new THREE.Float32BufferAttribute(stress, 1));
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
        u.uShowStress.value = 1.0;
        return u;
    }, [color]);

    return (
        <group>
            <mesh geometry={geometry} castShadow receiveShadow>
                <shaderMaterial attach="material" args={[FemShader]} uniforms={uniforms} transparent side={THREE.DoubleSide} />
            </mesh>
            <lineSegments geometry={edges}>
                <lineBasicMaterial color="white" opacity={0.4} transparent depthTest={false} />
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


import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Part } from './components/Part.jsx';
import { NastranModelComp } from './components/NastranModelComp.jsx';
import { FloorplanModelComp } from './components/FloorplanModelComp.jsx';
import { DrawingSystem } from './components/DrawingSystem.jsx';
import { NastranParser } from './NastranParser';

// Dedicated Snapping Logic to match original SnappingSystem.js
function checkSocketSnap(draggedId, elements, setElements) {
    const scene = window.__G_SCENE;
    if (!scene) return;

    const parts = scene.children.filter(c => c.userData?.isPart);
    const draggedMesh = parts.find(p => p.userData.partId === draggedId);
    if (!draggedMesh) return;

    const otherParts = parts.filter(p => p.userData.partId !== draggedId);
    const snapThreshold = 0.6;

    let bestSnap = null;
    let minDistance = Infinity;

    const draggedSockets = draggedMesh.children.filter(c => c.userData?.isSocket);

    draggedSockets.forEach(ds => {
        const dsWorldPos = new THREE.Vector3();
        ds.getWorldPosition(dsWorldPos);

        otherParts.forEach(tp => {
            const targetSockets = tp.children.filter(c => c.userData?.isSocket);
            targetSockets.forEach(ts => {
                const tsWorldPos = new THREE.Vector3();
                ts.getWorldPosition(tsWorldPos);

                const dist = dsWorldPos.distanceTo(tsWorldPos);
                if (dist < snapThreshold && dist < minDistance) {
                    minDistance = dist;
                    bestSnap = { ds, ts, tp, targetId: tp.userData.partId };
                }
            });
        });
    });

    if (bestSnap) {
        setElements(prev => {
            const targetEl = prev.find(e => e.id === bestSnap.targetId);
            if (!targetEl) return prev;

            // Aligment logic from original applySnap
            const dsWorldQuat = new THREE.Quaternion();
            bestSnap.ds.getWorldQuaternion(dsWorldQuat);
            const dsNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(dsWorldQuat);

            const tsWorldQuat = new THREE.Quaternion();
            bestSnap.ts.getWorldQuaternion(tsWorldQuat);
            const tsNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(tsWorldQuat);
            const desiredNormal = tsNormal.clone().negate();

            // 1. Align Rotation based on Normals
            const alignQuat = new THREE.Quaternion().setFromUnitVectors(dsNormal, desiredNormal);
            const currentQuat = new THREE.Quaternion().fromArray(prev.find(e => e.id === draggedId).rotation || [0, 0, 0, 1]);
            const nextQuat = alignQuat.clone().multiply(currentQuat);

            // 2. Align Position (Factor in socket translation during rotation)
            const dsLocalPos = bestSnap.ds.position.clone();
            const partWorldPos = new THREE.Vector3().fromArray(prev.find(e => e.id === draggedId).position);
            const rotatedDSWorldPos = dsLocalPos.applyQuaternion(nextQuat).add(partWorldPos);

            const tsWorldPos = new THREE.Vector3();
            bestSnap.ts.getWorldPosition(tsWorldPos);
            const trOffset = new THREE.Vector3().subVectors(tsWorldPos, rotatedDSWorldPos);
            const nextPos = [partWorldPos.x + trOffset.x, partWorldPos.y + trOffset.y, partWorldPos.z + trOffset.z];

            return prev.map(el => {
                if (el.id === draggedId) {
                    return { ...el, position: nextPos, rotation: nextQuat.toArray(), parentId: bestSnap.targetId };
                }
                return el;
            });
        });
    }
}

function SceneListener({ onSceneInit }) {
    const { scene, camera, controls } = useThree();
    useEffect(() => {
        window.__G_SCENE = scene;
        window.__G_CAMERA = camera;
        window.__G_CONTROLS = controls;
        onSceneInit(scene);
    }, [scene, camera, controls, onSceneInit]);
    return null;
}

export default function ProjectRoot() {
    const [elements, setElements] = useState([
        { id: 'initial-1', type: 'block', position: [0.5, 0.5, 0], rotation: [0, 0, 0, 1], color: 0xef4444 },
        { id: 'initial-2', type: 'block', position: [2.5, 0.5, 0], rotation: [0, 0, 0, 1], color: 0x22c55e }
    ]);
    const [selectedId, setSelectedId] = useState(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isShaded, setIsShaded] = useState(true);
    const [isDrawing, setIsDrawing] = useState(false);
    const [currentColor, setCurrentColor] = useState(0xef4444);

    const [showGridIDs, setShowGridIDs] = useState(false);
    const [showElemIDs, setShowElemIDs] = useState(false);
    const [showLoads, setShowLoads] = useState(false);
    const [importSummary, setImportSummary] = useState(null);
    const [showFE, setShowFE] = useState(true);
    const [visMode, setVisMode] = useState('shaded'); // wireframe, hidden, shaded, contour
    const [showBlocks, setShowBlocks] = useState(true);

    const palette = {
        '1': 0xef4444, '2': 0x22c55e, '3': 0x3b82f6,
        '4': 0xeab308, '5': 0xa855f7, '6': 0x06b6d4,
        '7': 0xf97316, '8': 0xec4899, '9': 0xffffff
    };

    const addPart = useCallback(() => {
        const id = Math.random().toString(36).substr(2, 9);
        const newPart = {
            id,
            type: 'block',
            position: [Math.floor(Math.random() * 4) + 0.5, 0.5, Math.floor(Math.random() * 4) + 0.5],
            rotation: [0, 0, 0, 1],
            color: currentColor
        };
        setElements(prev => [...prev, newPart]);
    }, [currentColor]);

    const deletePart = useCallback(() => {
        if (!selectedId) return;
        setElements(prev => prev.filter(p => p.id !== selectedId));
        setSelectedId(null);
    }, [selectedId]);

    const rotateSelected = useCallback((axis) => {
        if (!selectedId || isLocked) return;
        setElements(prev => prev.map(el => {
            if (el.id === selectedId) {
                const quat = new THREE.Quaternion().fromArray(el.rotation || [0, 0, 0, 1]);
                const axisVec = new THREE.Vector3();
                if (axis === 'x') axisVec.set(1, 0, 0);
                if (axis === 'y') axisVec.set(0, 1, 0);
                if (axis === 'z') axisVec.set(0, 0, 1);
                quat.multiply(new THREE.Quaternion().setFromAxisAngle(axisVec, Math.PI / 4));
                return { ...el, rotation: quat.toArray() };
            }
            return el;
        }));
    }, [selectedId, isLocked]);

    const changeColor = useCallback((color) => {
        setCurrentColor(color);
        if (selectedId) {
            setElements(prev => prev.map(el => el.id === selectedId ? { ...el, color } : el));
        }
    }, [selectedId]);

    const fitCameraToObjects = useCallback(() => {
        const scene = window.__G_SCENE;
        const camera = window.__G_CAMERA;
        const controls = window.__G_CONTROLS;
        if (!scene || !camera || !controls) return;

        const boundingBox = new THREE.Box3();
        let hasVisible = false;

        scene.traverse(obj => {
            if (obj.visible && (obj.userData?.isPart || obj.userData?.isNastran || obj.userData?.isFloorplan)) {
                // Special check for Nastran/Parts groups based on global visibility
                if (obj.userData?.isNastran && !showFE) return;
                if (obj.userData?.isPart && !showBlocks) return;

                boundingBox.expandByObject(obj);
                hasVisible = true;
            }
        });

        if (!hasVisible) {
            controls.target.set(0, 0, 0);
            camera.position.set(10, 10, 10);
            controls.update();
            return;
        }

        const center = new THREE.Vector3();
        boundingBox.getCenter(center);

        const sphere = new THREE.Sphere();
        boundingBox.getBoundingSphere(sphere);
        const radius = sphere.radius;

        const fov = camera.fov * (Math.PI / 180);
        const aspect = camera.aspect;

        // Calculate distance based on both vertical and horizontal fov
        const fovH = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const fovMin = Math.min(fov, fovH);

        let cameraDist = Math.abs(radius / Math.sin(fovMin / 2));
        cameraDist *= 1.1; // Professional Padding

        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        if (direction.lengthSq() === 0) direction.set(0, 0.5, 1).normalize();

        const newCameraPos = center.clone().add(direction.multiplyScalar(cameraDist));

        controls.target.copy(center);
        camera.position.copy(newCameraPos);
        controls.update();
    }, [showFE, showBlocks]);

    // Keybinds
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'l') setIsLocked(prev => !prev);
            if (key === 'f') fitCameraToObjects();
            if (key === 'a') addPart();
            if (key === 'd' || key === 'delete' || key === 'backspace') deletePart();
            if (key === 'p') setIsDrawing(prev => !prev);
            if (key === 'r') window.__G_ROTATE_MODE = !window.__G_ROTATE_MODE;

            // Visualization Modes
            if (key === 'c') setVisMode('contour');
            if (key === 's') setVisMode('shaded');
            if (key === 'h') setVisMode('hidden');
            if (key === 'w') setVisMode('wireframe');
            if (key === 'b') setShowBlocks(prev => !prev);

            if (window.__G_ROTATE_MODE && (key === 'x' || key === 'y' || key === 'z')) {
                rotateSelected(key);
            }
            if (palette[key]) changeColor(palette[key]);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [addPart, deletePart, rotateSelected, changeColor, fitCameraToObjects]);

    const handleImportNastran = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const parser = new NastranParser();
            setShowFE(true);
            setShowBlocks(false);
            const data = parser.parse(event.target.result);
            const id = Math.random().toString(36).substr(2, 9);
            setElements(prev => [...prev, { id, type: 'nastran', data, color: currentColor }]);
            setImportSummary(data.summary);
            setTimeout(fitCameraToObjects, 100);
        };
        reader.readAsText(file);
    };

    const handleDrag = (id, newWorldPos) => {
        setElements(prev => prev.map(el => {
            if (el.id === id) {
                return { ...el, position: [newWorldPos.x, newWorldPos.y, newWorldPos.z] };
            }
            return el;
        }));
        // Snapping logic now sees the updated mesh matrix from Part.jsx
        checkSocketSnap(id, elements, setElements);
    };

    const handleDragEnd = (id) => {
        // No-op or final cleanup if needed, but snapping is now real-time
    };

    return (
        <div className="canvas-wrapper">
            <Canvas shadows onPointerMissed={() => setSelectedId(null)}>
                <SceneListener onSceneInit={() => { }} />
                <PerspectiveCamera makeDefault position={[10, 10, 10]} />
                <OrbitControls makeDefault enableDamping rotateSpeed={0.5} />
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} castShadow />
                <Grid infiniteGrid fadeDistance={30} sectionColor="#666" cellColor="#444" sectionSize={1} cellSize={1} />

                {isDrawing && <DrawingSystem onFinish={(points) => {
                    const id = Math.random().toString(36).substr(2, 9);
                    setElements(prev => [...prev, { id, type: 'floorplan', points, color: currentColor }]);
                    setIsDrawing(false);
                    setShowBlocks(true); // Ensure new draws are visible
                    setShowFE(false);
                }} onCancel={() => setIsDrawing(false)} />}

                {elements.map(el => {
                    if (el.type === 'block') return <Part key={el.id} id={el.id} position={el.position} rotation={el.rotation} color={el.color} visMode={visMode} visible={showBlocks} isSelected={selectedId === el.id} onSelect={() => setSelectedId(el.id)} onDrag={handleDrag} onDragEnd={handleDragEnd} isLocked={isLocked} isDrawing={isDrawing} />;
                    if (el.type === 'nastran') return <NastranModelComp key={el.id} data={el.data} color={el.color} visMode={visMode} showGridIDs={showGridIDs} showElemIDs={showElemIDs} showLoads={showLoads} visible={showFE} />;
                    if (el.type === 'floorplan') return <FloorplanModelComp key={el.id} id={el.id} points={el.points} color={el.color} visMode={visMode} visible={showBlocks} isSelected={selectedId === el.id} onSelect={() => setSelectedId(el.id)} />;
                    return null;
                })}
            </Canvas>

            <div className="ui-overlay">
                <h1 className="ui-title">Lego FEM Viz (R3F)</h1>
                <div className="status-bar">
                    Status: <span className="status-tag" style={{ color: isLocked ? '#ef4444' : '#22c55e' }}>{isLocked ? 'LOCKED' : 'UNLOCKED'}</span> |
                    Mode: <span className="status-tag" style={{ color: '#6366f1' }}>{visMode}</span>
                </div>
                <div className="keybind-hint">
                    <b>L</b>: Lock | <b>W</b>: Wire | <b>H</b>: Hidden | <b>S</b>: Shaded | <b>C</b>: Contour | <b>F</b>: Fit
                </div>

                <div className="controls-group">
                    <button onClick={addPart} className="btn btn-primary">Add (A)</button>
                    <button onClick={() => setIsDrawing(!isDrawing)} className={`btn ${isDrawing ? 'btn-danger' : 'btn-secondary'}`}>
                        {isDrawing ? 'Cancel' : 'Draw (P)'}
                    </button>
                    <button onClick={deletePart} className="btn btn-danger">Del</button>
                    <button onClick={() => document.getElementById('nastran-input').click()} className="btn btn-accent">BDF</button>
                    <input id="nastran-input" type="file" accept=".bdf,.dat" onChange={handleImportNastran} style={{ display: 'none' }} />
                </div>

                <div className="controls-group" style={{ marginTop: '10px' }}>
                    <button onClick={() => setShowGridIDs(!showGridIDs)} className={`btn ${showGridIDs ? 'btn-active' : 'btn-outline'}`}>Grids</button>
                    <button onClick={() => setShowElemIDs(!showElemIDs)} className={`btn ${showElemIDs ? 'btn-active-blue' : 'btn-outline'}`}>Elems</button>
                    <button onClick={() => setShowLoads(!showLoads)} className={`btn ${showLoads ? 'btn-danger' : 'btn-outline'}`}>Loads</button>
                </div>

                {importSummary && (
                    <div className="stats-card">
                        <div className="view-toggle-group">
                            <button
                                onClick={() => {
                                    setShowBlocks(true); setShowFE(false);
                                    setTimeout(fitCameraToObjects, 50);
                                }}
                                className={`view-toggle-btn ${showBlocks ? 'active' : ''}`}
                            >
                                Lego & Plot
                            </button>
                            <button
                                onClick={() => {
                                    setShowBlocks(false); setShowFE(true);
                                    setTimeout(fitCameraToObjects, 50);
                                }}
                                className={`view-toggle-btn ${showFE ? 'active' : ''}`}
                            >
                                FE Model
                            </button>
                        </div>

                        <div className="stats-header">Import Statistics</div>
                        <div className="stats-grid">
                            <span className="stats-label">Grids:</span> <span className="stats-value" style={{ color: '#fbbf24' }}>{importSummary.nodes}</span>
                            <span className="stats-label">Elements:</span> <span className="stats-value" style={{ color: '#38bdf8' }}>{importSummary.elements}</span>
                            <span className="stats-label">Property:</span> <span className="stats-value">{importSummary.properties}</span>
                            <span className="stats-label">Material:</span> <span className="stats-value">{importSummary.materials}</span>
                        </div>
                        {importSummary.warnings.length > 0 && (
                            <div className="stats-warning">
                                ⚠️ {importSummary.warnings.length} issues found.
                            </div>
                        )}
                    </div>
                )}

                <div className="palette-container">
                    {Object.entries(palette).map(([key, color]) => (
                        <div
                            key={key}
                            onClick={() => changeColor(color)}
                            className={`color-swatch ${color === currentColor ? 'active' : ''}`}
                            style={{ background: `#${color.toString(16).padStart(6, '0')}` }}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

import React, { useState, useMemo, useRef, useEffect, useCallback, FC } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { Part } from './components/Part/Part';
import { NastranModelComp } from './components/NastranModelComp/NastranModelComp';
import { FloorplanModelComp } from './components/FloorplanModelComp/FloorplanModelComp';
import { DrawingSystem } from './components/DrawingSystem/DrawingSystem';
import { ContextMenu } from './components/ContextMenu/ContextMenu';
import { NastranParser } from './parser/NastranParser';
import { SceneElement, VisMode, NastranData } from './types';


interface SceneListenerProps {
    onSceneInit: (scene: THREE.Scene) => void;
}

const SceneListener: FC<SceneListenerProps> = ({ onSceneInit }) => {
    const { scene, camera, controls } = useThree();
    useEffect(() => {
        (window as any).__G_SCENE = scene;
        (window as any).__G_CAMERA = camera;
        (window as any).__G_CONTROLS = controls;
        onSceneInit(scene);
    }, [scene, camera, controls, onSceneInit]);
    return null;
};

export default function ProjectRoot() {
    const [elements, setElements] = useState<SceneElement[]>([
        { id: 'initial-1', type: 'block', position: [0.5, 0.5, 0], rotation: [0, 0, 0, 1], color: 0xef4444 },
        { id: 'initial-2', type: 'block', position: [2.5, 0.5, 0], rotation: [0, 0, 0, 1], color: 0x22c55e }
    ]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isJoining, setIsJoining] = useState(false);
    const [joinSelection, setJoinSelection] = useState<{ partId: string, socketIndex: number } | null>(null);
    const [currentColor, setCurrentColor] = useState(0xef4444);
    const [isEditMode, setIsEditMode] = useState(false);

    const [showGridIDs, setShowGridIDs] = useState(false);
    const [showElemIDs, setShowElemIDs] = useState(false);
    const [showLoads, setShowLoads] = useState(false);
    const [showSPC, setShowSPC] = useState(false);
    const [importSummary, setImportSummary] = useState<NastranData['summary'] | null>(null);
    const [showFE, setShowFE] = useState(false);
    const [visMode, setVisMode] = useState<VisMode>('shaded');
    const [showBlocks, setShowBlocks] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const mouseStartPos = useRef({ x: 0, y: 0 });
    const mouseDownTime = useRef(0);

    useEffect(() => {
        const handleGlobalMouseDown = (e: MouseEvent) => {
            if (e.button === 2) {
                mouseStartPos.current = { x: e.clientX, y: e.clientY };
                mouseDownTime.current = Date.now();
            }
        };
        window.addEventListener('mousedown', handleGlobalMouseDown, { capture: true });
        return () => window.removeEventListener('mousedown', handleGlobalMouseDown, { capture: true });
    }, []);

    // Sync currentColor with selected element
    useEffect(() => {
        if (selectedId) {
            const selectedEl = elements.find(el => el.id === selectedId);
            if (selectedEl) {
                setCurrentColor(selectedEl.color);
            }
        }
    }, [selectedId, elements]);

    const palette: Record<string, number> = {
        '1': 0xef4444, '2': 0x22c55e, '3': 0x3b82f6,
        '4': 0xeab308, '5': 0xa855f7, '6': 0x06b6d4,
        '7': 0xf97316, '8': 0xec4899, '9': 0xffffff
    };

    const addPart = useCallback(() => {
        const id = Math.random().toString(36).substr(2, 9);
        const newPart: SceneElement = {
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

    const rotateSelected = useCallback((axis: 'x' | 'y' | 'z') => {
        if (!selectedId || isLocked) return;
        setElements(prev => prev.map(el => {
            if (el.id === selectedId) {
                const quat = new THREE.Quaternion().fromArray(el.rotation || [0, 0, 0, 1]);
                const axisVec = new THREE.Vector3();
                if (axis === 'x') axisVec.set(1, 0, 0);
                if (axis === 'y') axisVec.set(0, 1, 0);
                if (axis === 'z') axisVec.set(0, 0, 1);
                quat.multiply(new THREE.Quaternion().setFromAxisAngle(axisVec, Math.PI / 4));
                return { ...el, rotation: quat.toArray() as [number, number, number, number] };
            }
            return el;
        }));
    }, [selectedId, isLocked]);

    const changeColor = useCallback((color: number) => {
        setCurrentColor(color);
        if (selectedId) {
            setElements(prev => prev.map(el => el.id === selectedId ? { ...el, color } : el));
        }
    }, [selectedId]);

    const ungroup = useCallback(() => {
        if (!selectedId) return;
        setElements(prev => {
            const selected = prev.find(e => e.id === selectedId);
            if (!selected || !selected.groupId) return prev;
            // Detach ONLY the selected part from the group
            return prev.map(el => {
                if (el.id === selectedId) {
                    const { groupId, ...rest } = el;
                    return rest;
                }
                return el;
            });
        });
    }, [selectedId]);

    const handleDrag = useCallback((id: string, newWorldPos: THREE.Vector3) => {
        setElements(prev => {
            const dragged = prev.find(e => e.id === id);
            if (!dragged) return prev;

            const delta = [
                newWorldPos.x - dragged.position[0],
                newWorldPos.y - dragged.position[1],
                newWorldPos.z - dragged.position[2]
            ];

            return prev.map(el => {
                if (el.id === id || (dragged.groupId && el.groupId === dragged.groupId)) {
                    return {
                        ...el,
                        position: [
                            el.position[0] + delta[0],
                            el.position[1] + delta[1],
                            el.position[2] + delta[2]
                        ]
                    };
                }
                return el;
            });
        });
    }, []);

    const handleDragEnd = useCallback((id: string) => {
        // Trigger snap only at the end of a drag to allow dragging "away" from a group
        // without immediate re-snapping
        checkSocketSnap(id, elements, setElements);
    }, [elements]);

    function checkSocketSnap(
        draggedId: string,
        elements: SceneElement[],
        setElements: React.Dispatch<React.SetStateAction<SceneElement[]>>
    ) {
        const scene = (window as any).__G_SCENE as THREE.Scene;
        if (!scene) return;

        const parts = scene.children.filter(c => c.userData?.isPart);
        const draggedMesh = parts.find(p => p.userData.partId === draggedId);
        if (!draggedMesh) return;

        const draggedEl = elements.find(e => e.id === draggedId);
        const otherParts = parts.filter(p => (
            p.userData.partId !== draggedId &&
            (!draggedEl?.groupId || p.userData.groupId !== draggedEl.groupId)
        ));

        // Thresholds: Only snap if close, but NOT if already perfectly flush (to allow Detach)
        const snapThreshold = 0.6;
        const minSnapDist = 0.05;

        let bestSnap: any = null;
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
                    // Only snap if we are within range but NOT already touching (prevents re-snap after ungroup)
                    if (dist < snapThreshold && dist > minSnapDist && dist < minDistance) {
                        minDistance = dist;
                        bestSnap = { ds, ts, tp, targetId: tp.userData.partId };
                    }
                });
            });
        });

        if (bestSnap) {
            setElements(prev => {
                const targetEl = prev.find(e => e.id === bestSnap.targetId);
                const draggedEl = prev.find(e => e.id === draggedId);
                if (!targetEl || !draggedEl) return prev;

                const dsWorldQuat = new THREE.Quaternion();
                bestSnap.ds.getWorldQuaternion(dsWorldQuat);
                const dsNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(dsWorldQuat);

                const tsWorldQuat = new THREE.Quaternion();
                bestSnap.ts.getWorldQuaternion(tsWorldQuat);
                const tsNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(tsWorldQuat);
                const desiredNormal = tsNormal.clone().negate();

                const alignQuat = new THREE.Quaternion().setFromUnitVectors(dsNormal, desiredNormal);
                const currentQuat = new THREE.Quaternion().fromArray(draggedEl.rotation || [0, 0, 0, 1]);
                const nextQuat = alignQuat.clone().multiply(currentQuat);

                const dsLocalPos = (bestSnap.ds as THREE.Object3D).position.clone();
                const partWorldPos = new THREE.Vector3().fromArray(draggedEl.position);
                const rotatedDSWorldPos = dsLocalPos.applyQuaternion(nextQuat).add(partWorldPos);

                const tsWorldPos = new THREE.Vector3();
                bestSnap.ts.getWorldPosition(tsWorldPos);
                const trOffset = new THREE.Vector3().subVectors(tsWorldPos, rotatedDSWorldPos);

                const delta = [trOffset.x, trOffset.y, trOffset.z];
                const finalGroupId = targetEl.groupId || draggedEl.groupId || Math.random().toString(36).substring(2, 11);

                const mOldPos = new THREE.Vector3().fromArray(draggedEl.position);
                const mOldQuat = new THREE.Quaternion().fromArray(draggedEl.rotation || [0, 0, 0, 1]);

                return prev.map(el => {
                    const isPartOrMember = el.id === draggedId || (draggedEl.groupId && el.groupId === draggedEl.groupId);

                    if (isPartOrMember) {
                        const targetPos = new THREE.Vector3().fromArray(draggedEl.position).add(trOffset);

                        if (el.id === draggedId) {
                            return {
                                ...el,
                                position: [targetPos.x, targetPos.y, targetPos.z],
                                rotation: nextQuat.toArray() as [number, number, number, number],
                                groupId: finalGroupId
                            };
                        }

                        // For group members: match rotation and relative position
                        const elPos = new THREE.Vector3().fromArray(el.position);
                        const relativePos = elPos.clone().sub(mOldPos).applyQuaternion(mOldQuat.clone().invert());
                        const newRelativePos = relativePos.applyQuaternion(nextQuat);
                        const newElPos = targetPos.clone().add(newRelativePos);

                        const elQuat = new THREE.Quaternion().fromArray(el.rotation || [0, 0, 0, 1]);
                        const newElQuat = alignQuat.clone().multiply(elQuat);

                        return {
                            ...el,
                            position: [newElPos.x, newElPos.y, newElPos.z],
                            rotation: newElQuat.toArray() as [number, number, number, number],
                            groupId: finalGroupId
                        };
                    }

                    if (el.id === bestSnap.targetId) {
                        return { ...el, groupId: finalGroupId };
                    }
                    return el;
                });
            });
        }
    }

    const fitCameraToObjects = useCallback(() => {
        const scene = (window as any).__G_SCENE as THREE.Scene;
        const camera = (window as any).__G_CAMERA as THREE.PerspectiveCamera;
        const controls = (window as any).__G_CONTROLS as any;
        if (!scene || !camera || !controls) return;

        const boundingBox = new THREE.Box3();
        let hasVisible = false;

        scene.traverse(obj => {
            if (obj.visible && (obj.userData?.isPart || obj.userData?.isNastran || obj.userData?.isFloorplan)) {
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

        const fovH = 2 * Math.atan(Math.tan(fov / 2) * aspect);
        const fovMin = Math.min(fov, fovH);

        let cameraDist = Math.abs(radius / Math.sin(fovMin / 2));
        cameraDist *= 1.1;

        const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
        if (direction.lengthSq() === 0) direction.set(0, 0.5, 1).normalize();

        const newCameraPos = center.clone().add(direction.multiplyScalar(cameraDist));

        controls.target.copy(center);
        camera.position.copy(newCameraPos);
        controls.update();
    }, [showFE, showBlocks]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const key = e.key.toLowerCase();
            if (key === 'l') setIsLocked(prev => !prev);
            if (key === 'f') fitCameraToObjects();
            if (key === 'a') addPart();
            if (key === 'd' || key === 'delete' || key === 'backspace') deletePart();
            if (key === 'p') setIsDrawing(prev => !prev);
            if (key === 'j') {
                setIsJoining(prev => !prev);
                setJoinSelection(null);
            }
            if (key === 'r') (window as any).__G_ROTATE_MODE = !(window as any).__G_ROTATE_MODE;
            if (key === 'u') ungroup();
            if (key === 'm') setIsEditMode(prev => !prev);
            if (key === 'escape') {
                setIsDrawing(false);
                setIsJoining(false);
                setJoinSelection(null);
                setMenuVisible(false);
                setSelectedId(null);
                setIsEditMode(false);
            }

            if (key === 'c') setVisMode('contour');
            if (key === 's') setVisMode('shaded');
            if (key === 'h') setVisMode('hidden');
            if (key === 'e') setVisMode('freeedge');
            if (key === 'w') setVisMode('wireframe');
            if (key === 'b') setShowBlocks(prev => !prev);

            if ((window as any).__G_ROTATE_MODE && (key === 'x' || key === 'y' || key === 'z') && e.shiftKey) {
                rotateSelected(key as 'x' | 'y' | 'z');
            }
            if (palette[key]) changeColor(palette[key]);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [addPart, deletePart, rotateSelected, changeColor, fitCameraToObjects, palette, ungroup, isDrawing, isJoining, isLocked, joinSelection]);

    const handleImportNastran = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const parser = new NastranParser();
            setShowFE(true);
            setShowBlocks(false);
            const data = parser.parse(event.target?.result as string);
            const id = Math.random().toString(36).substr(2, 9);
            setElements(prev => [...prev, { id, type: 'nastran', data, color: currentColor, position: [0, 0, 0], rotation: [0, 0, 0, 1] }]);
            setImportSummary(data.summary);
            setTimeout(fitCameraToObjects, 100);
        };
        reader.readAsText(file);
    };

    const handleLoadDemo = useCallback(async () => {
        try {
            const response = await fetch('./R5610_GLBMDL.bdf');
            if (!response.ok) throw new Error('Failed to load demo model');
            const text = await response.text();

            const parser = new NastranParser();
            setShowFE(true);
            setShowBlocks(false);
            const data = parser.parse(text);
            const id = Math.random().toString(36).substr(2, 9);
            setElements(prev => [...prev, { id, type: 'nastran', data, color: currentColor, position: [0, 0, 0], rotation: [0, 0, 0, 1] }]);
            setImportSummary(data.summary);
            setTimeout(fitCameraToObjects, 100);
        } catch (error) {
            console.error('Demo load error:', error);
            setJoinError('Failed to load demo model');
        }
    }, [currentColor, fitCameraToObjects]);


    const [joinError, setJoinError] = useState<string | null>(null);

    const performJoin = useCallback((fixed: { partId: string, socketIndex: number }, moving: { partId: string, socketIndex: number }) => {
        const scene = (window as any).__G_SCENE as THREE.Scene;
        if (!scene) return;

        setJoinError(null);
        console.log('Perform Join:', { fixed, moving });

        // Find root groups by searching all objects in the scene
        let fixedGroup: THREE.Object3D | undefined;
        let movingGroup: THREE.Object3D | undefined;

        scene.traverse(obj => {
            if (obj.userData?.isPart) {
                if (obj.userData.partId === fixed.partId) fixedGroup = obj;
                if (obj.userData.partId === moving.partId) movingGroup = obj;
            }
        });

        if (!fixedGroup || !movingGroup) {
            setJoinError('Units not found in scene');
            return;
        }

        // Find precise socket objects within their groups
        let fixedSocket: THREE.Object3D | undefined;
        let movingSocket: THREE.Object3D | undefined;

        fixedGroup.traverse(obj => {
            if (obj.userData?.isSocket && obj.userData.socketIndex === fixed.socketIndex) fixedSocket = obj;
        });
        movingGroup.traverse(obj => {
            if (obj.userData?.isSocket && obj.userData.socketIndex === moving.socketIndex) movingSocket = obj;
        });

        if (!fixedSocket || !movingSocket) {
            setJoinError('Sockets not found on objects');
            return;
        }

        const fs = fixedSocket;
        const ms = movingSocket;

        setElements(prev => {
            const movingEl = prev.find(e => e.id === moving.partId);
            const fixedEl = prev.find(e => e.id === fixed.partId);
            if (!movingEl || !fixedEl) return prev;

            // 1. Calculate the rotation required to align ms normal to -fs normal
            const mSocketWorldQuat = new THREE.Quaternion();
            ms.getWorldQuaternion(mSocketWorldQuat);
            const mNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(mSocketWorldQuat);

            const fSocketWorldQuat = new THREE.Quaternion();
            fs.getWorldQuaternion(fSocketWorldQuat);
            const fNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(fSocketWorldQuat);
            const desiredNormal = fNormal.clone().negate();

            // Quat that rotates mNormal to desiredNormal
            const alignQuat = new THREE.Quaternion().setFromUnitVectors(mNormal, desiredNormal);

            // Apply it to moving object's current rotation
            const currentQuat = new THREE.Quaternion().fromArray(movingEl.rotation || [0, 0, 0, 1]);
            const nextQuat = alignQuat.clone().multiply(currentQuat);

            // 2. Calculate the position so that the rotated moving socket matches the fixed socket
            // Socket position relative to part origin
            const mSocketLocalPos = ms.position.clone();
            const fSocketWorldPos = new THREE.Vector3();
            fs.getWorldPosition(fSocketWorldPos);

            // After rotation 'nextQuat', the relative world offset is: nextQuat * mSocketLocalPos
            const rotatedOffset = mSocketLocalPos.clone().applyQuaternion(nextQuat);

            // New part position = fixed socket world position - rotated offset
            const nextPosVec = fSocketWorldPos.clone().sub(rotatedOffset);
            const nextPos: [number, number, number] = [nextPosVec.x, nextPosVec.y, nextPosVec.z];

            console.log('Join SUCCESS:', { nextPos, nextQuat: nextQuat.toArray() });

            // 3. Determine Group Logic & Transform Assembly
            let finalGroupId = fixedEl.groupId || movingEl.groupId;
            if (!finalGroupId) {
                finalGroupId = Math.random().toString(36).substr(2, 9);
            }

            const movingElGroupId = movingEl.groupId;

            // Calculate assembly-wide transformation
            // We need to move every element 'el' in the moving group such that its 
            // relative position to 'movingEl' is maintained after 'movingEl' 
            // is moved to 'nextPos' and rotated to 'nextQuat'.
            const mOldPos = new THREE.Vector3().fromArray(movingEl.position);
            const mOldQuat = new THREE.Quaternion().fromArray(movingEl.rotation || [0, 0, 0, 1]);

            return prev.map(el => {
                const isPartOrMember = el.id === moving.partId || (movingElGroupId && el.groupId === movingElGroupId);

                if (isPartOrMember) {
                    if (el.id === moving.partId) {
                        return { ...el, position: nextPos, rotation: nextQuat.toArray() as [number, number, number, number], groupId: finalGroupId };
                    }

                    // For other members of the same group:
                    // 1. Get relative pos in local space of movingEl
                    const elPos = new THREE.Vector3().fromArray(el.position);
                    const relativePos = elPos.clone().sub(mOldPos).applyQuaternion(mOldQuat.clone().invert());

                    // 2. Rotate relative pos by the new orientation
                    const newRelativePos = relativePos.applyQuaternion(nextQuat);

                    // 3. New El Pos = nextPos + newRelativePos
                    const newElPos = new THREE.Vector3().fromArray(nextPos).add(newRelativePos);

                    // 4. New El Rot = alignQuat * elRot
                    const elQuat = new THREE.Quaternion().fromArray(el.rotation || [0, 0, 0, 1]);
                    const newElQuat = alignQuat.clone().multiply(elQuat);

                    return {
                        ...el,
                        position: [newElPos.x, newElPos.y, newElPos.z],
                        rotation: newElQuat.toArray() as [number, number, number, number],
                        groupId: finalGroupId
                    };
                }

                // Ensure fixed part is also in the group
                if (el.id === fixed.partId) {
                    return { ...el, groupId: finalGroupId };
                }
                return el;
            });
        });
    }, []);

    const handleSocketClick = useCallback((partId: string, socketIndex: number) => {
        if (!joinSelection) {
            setJoinSelection({ partId, socketIndex });
        } else {
            if (joinSelection.partId === partId) {
                setJoinSelection(null);
                setIsJoining(false);
                return;
            }
            performJoin(joinSelection, { partId, socketIndex });
            setJoinSelection(null);
            setIsJoining(false);
        }
    }, [joinSelection, performJoin]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 2) { // Right click
            mouseStartPos.current = { x: e.clientX, y: e.clientY };
            mouseDownTime.current = Date.now();
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();

        const dist = Math.sqrt(
            Math.pow(e.clientX - mouseStartPos.current.x, 2) +
            Math.pow(e.clientY - mouseStartPos.current.y, 2)
        );
        const duration = Date.now() - mouseDownTime.current;

        console.log('Context Menu Attempt:', { dist, duration, mouseDownSet: mouseDownTime.current !== 0 });

        // If mouse moved more than 10px OR held for too long (> 350ms), it's likely a pan.
        // We only return if we actually matched a mousedown.
        if (mouseDownTime.current !== 0 && (dist > 10 || duration > 350)) {
            console.log('Context Menu Suppressed (Drag detected)');
            return;
        }

        setMenuPos({ x: e.clientX, y: e.clientY });
        setMenuVisible(true);
    };

    const menuItems = [
        { label: 'View Mode', shortcut: 'M/V', checked: !isEditMode, onClick: () => setIsEditMode(false) },
        { label: 'Edit Mode', shortcut: 'M/E', checked: isEditMode, onClick: () => setIsEditMode(true) },
        { isSeparator: true },
        {
            label: 'LEGO & PLOT',
            checked: showBlocks && !showFE,
            onClick: () => {
                setShowBlocks(true); setShowFE(false);
                setTimeout(fitCameraToObjects, 50);
            }
        },
        {
            label: 'FE MODEL',
            checked: !showBlocks && showFE,
            onClick: () => {
                setShowBlocks(false); setShowFE(true);
                setTimeout(fitCameraToObjects, 50);
            }
        },
        { isSeparator: true },
        { label: 'Fit', shortcut: 'F', onClick: fitCameraToObjects },
        { label: 'Lock', shortcut: 'L', checked: isLocked, onClick: () => setIsLocked(!isLocked) },
        { isSeparator: true },
        { label: 'Wireframe', shortcut: 'W', checked: visMode === 'wireframe', onClick: () => setVisMode('wireframe') },
        { label: 'Free Edge', shortcut: 'E', checked: visMode === 'freeedge', onClick: () => setVisMode('freeedge') },
        { label: 'Hidden', shortcut: 'H', checked: visMode === 'hidden', onClick: () => setVisMode('hidden') },
        { label: 'Shade', shortcut: 'S', checked: visMode === 'shaded', onClick: () => setVisMode('shaded') },
        { label: 'Contour', shortcut: 'C', checked: visMode === 'contour', onClick: () => setVisMode('contour') },
        { isSeparator: true },
        { label: 'Add', shortcut: 'A', onClick: addPart },
        { label: 'Draw', shortcut: 'P', checked: isDrawing, onClick: () => setIsDrawing(!isDrawing) },
        { label: 'Join', shortcut: 'J', checked: isJoining, onClick: () => { setIsJoining(!isJoining); setJoinSelection(null); } },
        { label: 'Ungroup', shortcut: 'U', onClick: ungroup },
        { isSeparator: true },
        { label: 'BDF Import', onClick: () => document.getElementById('nastran-input')?.click() },
        { label: 'Load Demo Model', onClick: handleLoadDemo },
    ];

    return (
        <div
            className="canvas-wrapper"
            onContextMenu={handleContextMenu}
        >
            {menuVisible && (
                <ContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    items={menuItems}
                    onClose={() => {
                        console.log('ProjectRoot: Closing ContextMenu');
                        setMenuVisible(false);
                    }}
                />
            )}
            <Canvas shadows onPointerMissed={() => setSelectedId(null)}>
                <SceneListener onSceneInit={() => { }} />
                <PerspectiveCamera makeDefault position={[10, 10, 10]} />
                <OrbitControls makeDefault enableDamping rotateSpeed={0.5} />
                <ambientLight intensity={0.6} />
                <pointLight position={[10, 10, 10]} castShadow />
                <Grid infiniteGrid fadeDistance={30} sectionColor="#666" cellColor="#444" sectionSize={1} cellSize={1} />

                {isDrawing && <DrawingSystem color={currentColor} onFinish={(points) => {
                    const id = Math.random().toString(36).substr(2, 9);
                    setElements(prev => [...prev, { id, type: 'floorplan', points, color: currentColor, position: [0, 0, 0], rotation: [0, 0, 0, 1] }]);
                    setIsDrawing(false);
                    setShowBlocks(true);
                    setShowFE(false);
                }} onCancel={() => setIsDrawing(false)} />}

                {(() => {
                    const selectedEl = elements.find(el => el.id === selectedId);
                    const selectedGroupId = selectedEl?.groupId;

                    return elements.map(el => {
                        const isSelected = el.id === selectedId || (selectedGroupId && el.groupId === selectedGroupId);

                        if (el.type === 'block') {
                            return (
                                <Part
                                    key={el.id}
                                    id={el.id}
                                    position={el.position}
                                    quaternion={el.rotation}
                                    color={el.color}
                                    visMode={visMode}
                                    visible={showBlocks}
                                    isSelected={!!isSelected}
                                    onSelect={() => setSelectedId(el.id)}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                    isLocked={isLocked}
                                    isDrawing={isDrawing}
                                    isJoining={isJoining}
                                    onSocketClick={handleSocketClick}
                                    selectionInfo={joinSelection}
                                    groupId={el.groupId}
                                    isEditMode={isEditMode}
                                />
                            );
                        }
                        if (el.type === 'nastran' && el.data) {
                            return (
                                <NastranModelComp
                                    key={el.id}
                                    id={el.id}
                                    data={el.data}
                                    color={el.color}
                                    visMode={visMode}
                                    showGridIDs={showGridIDs}
                                    showElemIDs={showElemIDs}
                                    showLoads={showLoads}
                                    showSPC={showSPC}
                                    visible={showFE}
                                    position={el.position}
                                    quaternion={el.rotation}
                                    isSelected={!!isSelected}
                                    onSelect={() => setSelectedId(el.id)}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                    isLocked={isLocked}
                                    isEditMode={isEditMode}
                                />
                            );
                        }
                        if (el.type === 'floorplan' && el.points) {
                            return (
                                <FloorplanModelComp
                                    key={el.id}
                                    id={el.id}
                                    points={el.points}
                                    position={el.position}
                                    color={el.color}
                                    visMode={visMode}
                                    visible={showBlocks}
                                    isSelected={!!isSelected}
                                    onSelect={() => setSelectedId(el.id)}
                                    onDrag={handleDrag}
                                    onDragEnd={handleDragEnd}
                                    isLocked={isLocked}
                                    isDrawing={isDrawing}
                                    groupId={el.groupId}
                                    quaternion={el.rotation}
                                    isJoining={isJoining}
                                    isEditMode={isEditMode}
                                />
                            );
                        }
                        return null;
                    });
                })()}
            </Canvas>

            <div className="ui-overlay">
                <h1 className="ui-title">Lego FEM Viz (R3F)</h1>
                <div className="status-bar">
                    <div className="status-row">
                        Status: <span className="status-tag" style={{ color: isLocked ? '#ef4444' : '#22c55e' }}>{isLocked ? 'LOCKED' : 'UNLOCKED'}</span> |
                        Mode: <span className="status-tag" style={{ color: '#6366f1' }}>{visMode}</span>
                    </div>
                    <div className="status-row">
                        Interaction: <span className="status-tag" style={{ color: isEditMode ? '#f59e0b' : '#3b82f6' }}>{isEditMode ? 'EDIT' : 'VIEW'}</span>
                        {isJoining && (
                            <> | <span className="status-tag" style={{ color: '#f59e0b' }}>JOINING: {joinSelection ? 'Select Moving Face' : 'Select Fixed Face'}</span></>
                        )}
                        {joinError && (
                            <> | <span className="status-tag" style={{ color: '#ef4444' }}>ERROR: {joinError}</span></>
                        )}
                    </div>
                </div>
                <div className="keybind-hint">
                    <b>M</b>: Toggle Mode | <b>L</b>: Lock | <b>E</b>: FreeEdge | <b>W</b>: Wire | <b>H</b>: Hidden | <b>S</b>: Shaded | <b>C</b>: Contour | <b>F</b>: Fit | <b>J</b>: Join
                </div>

                <div className="controls-group">
                    <button onClick={addPart} className="btn btn-primary">Add (A)</button>
                    <button onClick={() => setIsDrawing(!isDrawing)} className={`btn ${isDrawing ? 'btn-danger' : 'btn-secondary'}`}>
                        {isDrawing ? 'Cancel' : 'Draw (P)'}
                    </button>
                    <button onClick={() => { setIsJoining(!isJoining); setJoinSelection(null); }} className={`btn ${isJoining ? 'btn-danger' : 'btn-accent'}`}>
                        {isJoining ? 'Cancel' : 'Join (J)'}
                    </button>
                    <button onClick={deletePart} className="btn btn-danger">Del</button>
                    <button onClick={handleLoadDemo} className="btn btn-accent" title="Load demo BDF model">Demo</button>
                    <button onClick={() => document.getElementById('nastran-input')?.click()} className="btn btn-accent">BDF</button>
                    <input id="nastran-input" type="file" accept=".bdf,.dat" onChange={handleImportNastran} style={{ display: 'none' }} />
                </div>

                <div className="controls-group" style={{ marginTop: '10px' }}>
                    <button onClick={() => setShowGridIDs(!showGridIDs)} className={`btn ${showGridIDs ? 'btn-active' : 'btn-outline'}`}>Grids</button>
                    <button onClick={() => setShowElemIDs(!showElemIDs)} className={`btn ${showElemIDs ? 'btn-active-blue' : 'btn-outline'}`}>Elems</button>
                    <button onClick={() => setShowLoads(!showLoads)} className={`btn ${showLoads ? 'btn-danger' : 'btn-outline'}`}>Loads</button>
                    <button onClick={() => setShowSPC(!showSPC)} className={`btn ${showSPC ? 'btn-active' : 'btn-outline'}`} style={{ background: showSPC ? '#22c55e' : '' }}>SPC</button>
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

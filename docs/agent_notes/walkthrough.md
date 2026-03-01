# Walkthrough - FEM-VIZ R3F Migration

The migration of the **fem-viz** project from vanilla Three.js (imperative) to **React Three Fiber** (declarative) is now 100% complete, with full feature parity and polished interaction.

## Key Technical Achievements

1.  **State-Driven Interaction**: Real-time synchronization between the UI overlay and the 3D scene using React hooks.
2.  **High-Performance FEA Rendering**: Nastran BDF parsing and rendering optimized for R3F, including interactive labels for Grid IDs and Elem IDs.
3.  **Smooth Drag & Snap**: Restored the "premium" interaction feel.
    *   **Direct Mesh Manipulation**: Bypasses React's render cycle during drags for synchronous, lag-free movement.
    *   **Real-time Socket Snapping**: Precise orientation and position alignment triggered during movement.
    *   **Shift-Drag**: Restored vertical movement logic.
4.  **Drawing System**: A robust polygon drawing tool on the Ground Plane with priority pointer handling.
5.  **Camera Controls**: Precise **Fit View (F)** and **Fit View** calculations to frame the entire model.

## Functional Guide

### General Shortcuts
- **Add Block (A)**: Spawns a new block at a random grid location.
- **Fit View (F)**: Automatically frames all visible objects in the scene.
- **Lock/Unlock (L)**: Toggles interaction lock.
- **Shade Mode (S)**: Toggles between Stress (colored) and Solid modes.
- **Delete (Del/Backspace)**: Removes the selected block.

### Block Manipulation
- **Drag**: Standard horizontal drag on the ground.
- **Shift + Drag**: Move blocks vertically.
- **Align**: Drag a block near another to see it "snap" face-to-face.
- **Rotate (R + X/Y/Z)**: Enter rotation mode (R), then press X, Y, or Z to rotate by 45°.

### FEA & Nastran
- **Import BDF**: Import `.bdf` or `.dat` files via the overlay.
- **Labels**: Toggle **Grid IDs** and **Elem IDs** for detailed inspection.
- **Stress Visualization**: Real-time shader updates based on the model data.

### Room Drawing
- **Draw Room (P)**: Activate/Deactivate drawing mode. Click on the grid to place points. Press **Enter** to close the polygon and create the floorplan.

## Project Structure
- `src/ProjectRoot.jsx`: The heart of the app.
- `src/components/Part.jsx`: The interactive block component.
- `src/components/NastranModelComp.jsx`: The structural model component.
- `src/components/DrawingSystem.jsx`: The interactive polygon tool.
- `src/FemShader.js`: Custom GLSL shaders preserved from the original.

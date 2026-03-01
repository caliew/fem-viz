# Part Interaction & View Parity

Restore the high-quality interaction feel of the original vanilla implementation.

## Proposed Changes

### [MODIFY] [Part.jsx](file:///c:/WebPortal/fem-viz/src/components/Part.jsx)
*   **Vertical Dragging**: Fix the Shift key logic. It should create a vertical plane that matches the camera's orientation.
*   **Continuous Snap Preview**: Call snapping logic during `onPointerMove` to provide real-time visual feedback.

### [MODIFY] [ProjectRoot.jsx](file:///c:/WebPortal/fem-viz/src/ProjectRoot.jsx)
*   **Real-time Snapping**: Move `checkSocketSnap` invocation from `onDragEnd` to `onDrag`.
*   **Fit View (F)**: Implement the precise FOV-based camera framing.
*   **Draw Mode Priority**: Ensure `isDrawing` completely disables block raycasting.

### [MODIFY] [DrawingSystem.jsx](file:///c:/WebPortal/fem-viz/src/components/DrawingSystem.jsx)
*   **Priority Plane**: Use a large invisible mesh with high pointer priority.

## Verification Plan

### Manual Verification
1.  **Fit View**: Zoom out/move away, press 'F', verify everything is centered and framed.
2.  **Vertical Move**: Hold Shift and drag a block, verify it moves up/down.
3.  **Real-time Snapping**: Drag a block near another, verify it "snaps" and aligns *before* releasing the mouse.
4.  **Drawing**: Activate Draw Room, verify you can click on the grid even if a block is in the way.

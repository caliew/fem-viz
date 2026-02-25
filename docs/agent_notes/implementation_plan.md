# Interactive Lego-style FEM Visualization Project

This plan focuses on building a modular system where users can assembly and visualize FEM results on interactive parts.

## Proposed Strategy: Three.js for Interactivity

Given the requirement for "Lego-like" movement and "auto-joining," **Three.js** is the recommended choice. It provides a flexible scene graph and excellent utilities for custom interaction and snapping logic.

### 1. The "Attachment Point" (Socket) System
To enable "plug and play" behavior, we will use a dedicated Socket system:
- **Marker Objects**: Each 3D part will have empty `THREE.Object3D` children representing connection points.
- **Connection Types**: Sockets will be categorized (e.g., "male" vs "female" or "universal") to ensure only valid parts connect.
- **Orientation Constraints**: Snapping will align both the position and the rotation (using Quaternions) so parts sit flush against each other.

### 2. Snapping & Auto-joining Workflow
- **Raycasting**: Used to detect which part the user is dragging over.
- **Precision Grid Snapping**: 
    - Blocks will snap to the center of grid cells (e.g., coordinates ending in .5).
    - Snapping applies to both initial generation and real-time dragging.
- **Socket Snapping**: Proximity-based socket snapping takes precedence over grid snapping when parts are close.
- **Parenting**: Once snapped, the parts will be "attached" using `Object3D.attach(child)`.

### 3. FEM Color Mapping (Shaders)
To visualize scientific data (e.g., von Mises Stress) without performance lag:
- **Vertex Attributes**: We will add a custom attribute `aStress` to the geometry.
- **ShaderMaterial**: A custom shader will take the stress value and map it to a color using a LUT (Look-Up Table) uniform (texture).
- **Dynamic Updates**: As data changes (or parts are assembled), the colors will update instantaneously on the GPU.

---

## Proposed Changes (FEM Integration)

#### [MODIFY] [PartModel.js](file:///c:/WebPortal/fem-viz/src/PartModel.js)
Update to use `ShaderMaterial` and include dummy "stress" data in vertex attributes.

#### [NEW] [FemShader.js](file:///c:/WebPortal/fem-viz/src/FemShader.js)
Define the vertex and fragment shaders for the FEM visualization.

---

- **Delete Feature**: Pressing **`D`**, **`Delete`**, or **`Backspace`** will remove the selected block from the scene and assembly.
- **UI Color Menu**: A visual palette in the overlay allows users to select colors using mouse clicks as an alternative to keyboard shortcuts.
- **Manual Rotation**: 
    - Pressing **`R`** triggers "Rotation Intent". 
    - Following **`R`** with **`X`**, **`Y`**, or **`Z`** will rotate the selected block by **45-degree** increments around its **local axis**.
- **Angle-Aware Snapping**: 
    - Instead of forcing upright orientation, the system will align the "face normal" of the dragged socket to the "opposite normal" of the target socket.
    - This allows blocks rotated at 45-degrees to snap flush against any face while maintaining their angle.

## Verification Plan

### Manual Verification
1. **Drag and Drop:** Verify a user can pick up and move a block.
2. **Auto-Snap:** Verify that bringing two blocks close together triggers the "auto-joining" alignment.
3. **Hierarchy:** Verify that joined blocks move together (parenting or group management).
4. **FEM Overlay:** Verify that Stress/Strain values appear correctly on the surfaces after assembly.

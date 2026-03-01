# Task: Evaluate and Plan Upgrade to React Three Fiber

- [x] Analyze current architecture vs R3F patterns <!-- id: 0 -->
- [x] Research performance implications for FEA data <!-- id: 1 -->
- [x] Draft implementation plan for React migration <!-- id: 2 -->
- [x] Get user approval for migration <!-- id: 3 -->
- [x] Execute migration (if approved) <!-- id: 4 -->
    - [x] Install dependencies (React, R3F, Drei) <!-- id: 5 -->
    - [x] Restore Vanilla Parity <!-- id: 9 -->
        - [x] Fix color update for selected part <!-- id: 10 -->
        - [x] Proper Grid/Elem ID labels for Nastran <!-- id: 11 -->
        - [x] Precise snapping and hierarchical parenting <!-- id: 12 -->
        - [x] Predictable "Add Block" position <!-- id: 13 -->
    - [x] Refactor `App` to `ProjectRoot.jsx` <!-- id: 6 -->
    - [x] Convert `NastranModel` and `FloorplanModel` to R3F components <!-- id: 7 -->
    - [x] Fix Interaction Bugs <!-- id: 14 -->
        - [x] Restore 'F' key for Fit View <!-- id: 15 -->
        - [x] Fix Drawing mode interference from blocks <!-- id: 16 -->
        - [x] Improve snapping "break-free" and drag smoothness <!-- id: 17 -->

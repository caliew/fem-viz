import * as THREE from 'three';

export interface NastranNode {
    id: number;
    x: number;
    y: number;
    z: number;
}

export interface NastranElement {
    id: number;
    pid: number;
    nodes: number[];
    type: 'CQUAD4' | 'CTRIA3' | 'CBAR';
}

export interface NastranLoad {
    nodeId: number;
    direction: THREE.Vector3;
    magnitude: number;
}

export interface NastranProperty {
    id: number;
    type: string;
    mid?: number;
    t?: number;
    a?: number;
}

export interface NastranMaterial {
    id: number;
    e: number;
    nu: number;
    rho: number;
}

export interface NastranConstraint {
    nodeId: number;
    dof: string;
}

export interface NastranData {
    nodes: Map<number, NastranNode>;
    elements: NastranElement[];
    properties: Map<number, NastranProperty>;
    materials: Map<number, NastranMaterial>;
    loads: NastranLoad[];
    constraints: NastranConstraint[];
    summary: {
        nodes: number;
        elements: number;
        elemTypes: Record<string, number>;
        properties: number;
        materials: number;
        loads: number;
        constraints: number;
        warnings: string[];
        errors: string[];
    };
}

export type VisMode = 'wireframe' | 'hidden' | 'shaded' | 'contour' | 'freeedge';

export interface SceneElement {
    id: string;
    type: 'block' | 'nastran' | 'floorplan';
    position: [number, number, number];
    rotation: [number, number, number, number];
    color: number;
    data?: NastranData;
    points?: THREE.Vector3[];
    groupId?: string;
}

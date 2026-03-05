import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NastranModelComp } from './NastranModelComp';
import { NastranData } from '../types';
import * as THREE from 'three';
import React from 'react';

// Mock R3F and Drei
vi.mock('@react-three/fiber', () => ({
    useThree: () => ({ raycaster: {}, mouse: {}, camera: {} }),
    useFrame: vi.fn(),
}));

vi.mock('@react-three/drei', () => ({
    Html: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('NastranModelComp', () => {
    const mockData: NastranData = {
        nodes: new Map([[1, { id: 1, x: 0, y: 0, z: 0 }], [2, { id: 2, x: 1, y: 0, z: 0 }], [3, { id: 3, x: 1, y: 1, z: 0 }]]),
        elements: [{ id: 101, type: 'CTRIA3', pid: 10, nodes: [1, 2, 3] }],
        properties: new Map([[10, { id: 10, type: 'PSHELL', mid: 1, t: 0.1 }]]),
        materials: new Map(),
        loads: [],
        constraints: [],
        summary: { nodes: 3, elements: 1, elemTypes: { CTRIA3: 1 }, properties: 1, materials: 0, loads: 0, constraints: 0, warnings: [], errors: [] }
    };

    it('renders without crashing', () => {
        // Note: Full R3F testing usually requires a Canvas provider, 
        // but we can test the basic mounting and logic.
        const { container } = render(
            <NastranModelComp
                data={mockData}
                color={0x2563eb}
                visMode="contour"
                showGridIDs={false}
                showElemIDs={false}
                showLoads={false}
                quaternion={[0, 0, 0, 1]}
            />
        );
        expect(container).toBeDefined();
    });

    it('renders labels when enabled', () => {
        const { getByText } = render(
            <NastranModelComp
                data={mockData}
                color={0x2563eb}
                visMode="contour"
                showGridIDs={true}
                showElemIDs={true}
                showLoads={false}
                quaternion={[0, 0, 0, 1]}
            />
        );
        expect(getByText('1')).toBeInTheDocument(); // Node ID
        expect(getByText('101')).toBeInTheDocument(); // Elem ID
    });
});

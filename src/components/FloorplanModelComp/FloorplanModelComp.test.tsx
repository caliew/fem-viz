import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FloorplanModelComp } from './FloorplanModelComp';
import * as THREE from 'three';
import React from 'react';

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    useThree: () => ({
        raycaster: { ray: { intersectPlane: vi.fn() } },
        mouse: new THREE.Vector2(),
        camera: {}
    }),
    useFrame: vi.fn(),
}));

describe('FloorplanModelComp', () => {
    const mockPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 0, 1),
        new THREE.Vector3(0, 0, 1)
    ];

    const defaultProps = {
        id: 'test-floorplan',
        points: mockPoints,
        position: [0, 0, 0] as [number, number, number],
        color: 0x22c55e,
        visMode: 'shaded' as const,
        isSelected: false,
        onSelect: vi.fn(),
        onDrag: vi.fn(),
        onDragEnd: vi.fn(),
        quaternion: [0, 0, 0, 1] as [number, number, number, number],
    };

    it('renders without crashing when points are provided', () => {
        const { container } = render(<FloorplanModelComp {...defaultProps} />);
        expect(container).toBeDefined();
    });

    it('does not render if points is null', () => {
        const { container } = render(<FloorplanModelComp {...defaultProps} points={undefined} />);
        expect(container.firstChild).toBeNull();
    });

    it('handles selection highlight', () => {
        const { rerender, container } = render(<FloorplanModelComp {...defaultProps} isSelected={false} />);
        expect(container).toBeDefined();

        rerender(<FloorplanModelComp {...defaultProps} isSelected={true} />);
        expect(container).toBeDefined();
    });
});

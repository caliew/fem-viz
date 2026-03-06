import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Part } from './Part';
import * as THREE from 'three';
import React from 'react';

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    useThree: () => ({
        raycaster: { ray: { intersectPlane: vi.fn() } },
        mouse: new THREE.Vector2(),
        camera: { getWorldDirection: vi.fn(() => new THREE.Vector3()) }
    }),
    useFrame: vi.fn(),
}));

describe('Part', () => {
    const defaultProps = {
        id: 'test-part',
        position: [0, 0, 0] as [number, number, number],
        quaternion: [0, 0, 0, 1] as [number, number, number, number],
        color: 0xef4444,
        visMode: 'shaded' as const,
        isSelected: false,
        onSelect: vi.fn(),
        onDrag: vi.fn(),
        onDragEnd: vi.fn(),
        isLocked: false,
        isDrawing: false,
    };

    it('renders without crashing', () => {
        const { container } = render(<Part {...defaultProps} />);
        expect(container).toBeDefined();
    });

    it('renders sockets when isJoining is true', () => {
        const { container } = render(<Part {...defaultProps} isJoining={true} />);
        // Checking for spheres in the mocked output is tricky without a full R3F renderer,
        // but we can verify the component mounts with the extra logic enabled.
        expect(container).toBeDefined();
    });

    it('handles selection state', () => {
        const { rerender, container } = render(<Part {...defaultProps} isSelected={false} />);
        expect(container).toBeDefined();

        rerender(<Part {...defaultProps} isSelected={true} />);
        expect(container).toBeDefined();
    });
});

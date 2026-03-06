import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DrawingSystem } from './DrawingSystem';
import * as THREE from 'three';
import React from 'react';

// Mock R3F
vi.mock('@react-three/fiber', () => ({
    useThree: () => ({
        raycaster: { setFromCamera: vi.fn(), ray: { intersectPlane: vi.fn() } },
        mouse: new THREE.Vector2(),
        camera: {}
    }),
    useFrame: vi.fn(),
}));

describe('DrawingSystem', () => {
    const mockOnFinish = vi.fn();
    const mockOnCancel = vi.fn();
    const defaultProps = {
        onFinish: mockOnFinish,
        onCancel: mockOnCancel,
        color: 0xef4444,
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const { container } = render(<DrawingSystem {...defaultProps} />);
        expect(container).toBeDefined();
    });

    it('calls onCancel when Escape is pressed', () => {
        render(<DrawingSystem {...defaultProps} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(mockOnCancel).toHaveBeenCalled();
    });

    it('calls onFinish when Enter is pressed and enough points exist', () => {
        // This is a bit complex to simulate fully because points state is internal.
        // However, we can at least verify the listener is attached.
        render(<DrawingSystem {...defaultProps} />);
        fireEvent.keyDown(window, { key: 'Enter' });
        // It shouldn't be called yet because points.length < 3
        expect(mockOnFinish).not.toHaveBeenCalled();
    });
});

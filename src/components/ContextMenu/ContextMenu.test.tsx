import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import React from 'react';

describe('ContextMenu', () => {
    const mockOnClose = vi.fn();
    const items: ContextMenuItem[] = [
        { label: 'Item 1', onClick: vi.fn() },
        { label: 'Item 2', checked: true, onClick: vi.fn() },
        { isSeparator: true },
        { label: 'Delete', danger: true, onClick: vi.fn() },
    ];

    it('renders all items and separators', () => {
        render(<ContextMenu x={100} y={100} items={items} onClose={mockOnClose} />);

        expect(screen.getByText('Item 1')).toBeInTheDocument();
        expect(screen.getByText('Item 2')).toBeInTheDocument();
        expect(screen.getByText('Delete')).toBeInTheDocument();

        const separators = document.querySelectorAll('.context-menu-separator');
        expect(separators.length).toBe(1);
    });

    it('shows checkmark for checked items', () => {
        render(<ContextMenu x={100} y={100} items={items} onClose={mockOnClose} />);

        const checkedItem = screen.getByText('Item 2').closest('.context-menu-item');
        expect(checkedItem).toHaveClass('checked');
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('calls onClick and onClose when an item is clicked', () => {
        render(<ContextMenu x={100} y={100} items={items} onClose={mockOnClose} />);

        const item1 = screen.getByText('Item 1');
        fireEvent.click(item1);

        expect(items[0].onClick).toHaveBeenCalled();
        expect(mockOnClose).toHaveBeenCalled();
    });

    it('applies danger class to dangerous items', () => {
        render(<ContextMenu x={100} y={100} items={items} onClose={mockOnClose} />);

        const deleteItem = screen.getByText('Delete').closest('.context-menu-item');
        expect(deleteItem).toHaveClass('danger');
    });
});

import React, { useRef, useEffect, useState } from 'react';

export interface ContextMenuItem {
    label?: string;
    shortcut?: string;
    onClick?: () => void;
    danger?: boolean;
    isSeparator?: boolean;
    checked?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: y, left: x });

    useEffect(() => {
        const handleClick = () => {
            console.log('ContextMenu: Global click detected, closing.');
            onClose();
        };

        // Delay adding listeners so we don't catch the bubble of the 
        // same right-click that opened us.
        const timer = setTimeout(() => {
            window.addEventListener('click', handleClick);
            window.addEventListener('contextmenu', handleClick);
        }, 10);

        return () => {
            clearTimeout(timer);
            window.removeEventListener('click', handleClick);
            window.removeEventListener('contextmenu', handleClick);
        };
    }, [onClose]);

    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const winW = window.innerWidth;
            const winH = window.innerHeight;

            let nextX = x;
            let nextY = y;

            if (x + rect.width > winW) nextX = x - rect.width;
            if (y + rect.height > winH) nextY = y - rect.height;

            setPos({ top: nextY, left: nextX });
        }
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="context-menu"
            style={{
                top: pos.top,
                left: pos.left,
                pointerEvents: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {items.map((item, index) => {
                if (item.isSeparator) {
                    return <div key={index} className="context-menu-separator" />;
                }
                return (
                    <div
                        key={index}
                        className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.checked ? 'checked' : ''}`}
                        onClick={() => {
                            if (item.onClick) item.onClick();
                            onClose();
                        }}
                    >
                        <div className="item-content">
                            <span className="check">{item.checked ? '✓' : ''}</span>
                            <span className="label">{item.label}</span>
                        </div>
                        {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                    </div>
                );
            })}
        </div>
    );
};

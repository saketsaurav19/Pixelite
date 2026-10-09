import React from 'react';
import type { Tool } from '../../store/useStore';
import { useAnchoredMenuPosition } from '../MenuSystem/useAnchoredMenuPosition';

interface ToolContextMenuProps {
  tools: { id: Tool; icon: any; label: string; shortcut: string }[];
  activeTool: Tool;
  position: { x: number; y: number };
  onSelect: (toolId: Tool) => void;
  onClose: () => void;
}

const ToolContextMenu: React.FC<ToolContextMenuProps> = ({ tools, activeTool, position, onSelect, onClose }) => {
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  const menu = useAnchoredMenuPosition(position);

  return (
    <div
      className="tool-context-menu"
      ref={menu.ref}
      style={{
        position: 'fixed',
        left: menu.position.x,
        top: menu.position.y,
        zIndex: 1001,
        visibility: menu.ready ? 'visible' : 'hidden',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {tools.map((tool) => (
        <div
          key={tool.id}
          className={`context-menu-item ${activeTool === tool.id ? 'active' : ''}`}
          onClick={() => {
            onSelect(tool.id);
            onClose();
          }}
        >
          <tool.icon size={16} className="item-icon" />
          <span className="item-label">{tool.label}</span>
          <span className="item-shortcut">{tool.shortcut}</span>
        </div>
      ))}
    </div>
  );
};

export default ToolContextMenu;

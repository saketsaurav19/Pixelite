import './LayerContextMenu.css';
import React, { useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';

interface LayerContextMenuProps {
  position: { x: number; y: number };
  layerId: string;
  onClose: () => void;
  onRename: (layerId: string) => void;
  onDelete: (layerId: string) => void;
}

const LayerContextMenu: React.FC<LayerContextMenuProps> = ({ position, layerId, onClose, onRename, onDelete }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  // Prevent context menu from going off-screen
  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 2000, // ensure it's above other elements
  };

  return (
    <div className="layer-context-menu" style={style} ref={menuRef} onContextMenu={(e) => e.preventDefault()}>
      <button className="menu-item" onClick={() => { onRename(layerId); }}>
        <LucideIcons.Type size={14} />
        <span>Rename</span>
      </button>
      <button className="menu-item text-danger" onClick={() => { onDelete(layerId); }}>
        <LucideIcons.Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default LayerContextMenu;

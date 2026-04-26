import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolButtonProps {
  id: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  hasVariants?: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ 
  active, 
  icon: Icon, 
  label, 
  shortcut, 
  hasVariants, 
  onClick, 
  onContextMenu 
}) => {
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      title={`${label} (${shortcut.toUpperCase()})`}
    >
      <Icon size={20} />
      {hasVariants && <div className="variant-indicator" />}
    </button>
  );
};

export default ToolButton;

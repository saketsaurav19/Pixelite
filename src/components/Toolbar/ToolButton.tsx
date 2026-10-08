import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolButtonProps {
  id: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  hasVariants?: boolean;
  variantCount?: number;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  active,
  icon: Icon,
  label,
  shortcut,
  hasVariants,
  variantCount,
  onClick,
  onContextMenu
}) => {
  const tooltip = hasVariants && variantCount && variantCount > 1
    ? `${label} (${shortcut.toUpperCase()}) — Click to cycle (${variantCount} tools)`
    : `${label} (${shortcut.toUpperCase()})`;

  return (
    <button
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e);
      }}
      title={tooltip}
    >
      <Icon size={20} />
      {hasVariants && variantCount && variantCount > 1 && <div className="variant-indicator" />}
    </button>
  );
};

export default ToolButton;

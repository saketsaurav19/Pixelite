import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolButtonProps {
  id: string;
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

const ToolButton: React.FC<ToolButtonProps> = ({ active, icon: Icon, label, onClick }) => {
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={label}
    >
      <Icon size={20} />
    </button>
  );
};

export default ToolButton;

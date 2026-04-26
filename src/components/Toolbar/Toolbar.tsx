import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import type { Tool } from '../../store/useStore';
import ToolButton from './ToolButton';

const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool } = useStore();

  const tools: { id: Tool; icon: any; label: string }[] = [
    { id: 'select', icon: LucideIcons.MousePointer2, label: 'Select' },
    { id: 'marquee', icon: LucideIcons.BoxSelect, label: 'Marquee' },
    { id: 'move', icon: LucideIcons.Move, label: 'Move' },
    { id: 'brush', icon: LucideIcons.Brush, label: 'Brush' },
    { id: 'eraser', icon: LucideIcons.Eraser, label: 'Eraser' },
    { id: 'text', icon: LucideIcons.Type, label: 'Text' },
    { id: 'shape', icon: LucideIcons.Square, label: 'Shape' },
  ];

  return (
    <aside className="left-toolbar">
      {tools.map((tool) => (
        <ToolButton
          key={tool.id}
          id={tool.id}
          active={activeTool === tool.id}
          icon={tool.icon}
          label={tool.label}
          onClick={() => setActiveTool(tool.id)}
        />
      ))}
    </aside>
  );
};

export default Toolbar;

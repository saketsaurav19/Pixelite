import React, { useState, useRef } from 'react';
import { useStore } from '../../../store/useStore';
import type { Light } from '../../../store/types';

export const LightingOverlay: React.FC = () => {
  const { lights, updateLight, activeTool, zoom, recordHistory, isLightingEnabled } = useStore();

  if (activeTool !== 'lighting' && !isLightingEnabled) return null;

  return (
    <div
      className="lighting-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000 // Ensure it's above other overlays when active
      }}
    >
      {lights.map((light) => (
        <LightGizmo
          key={light.id}
          light={light}
          zoom={zoom}
          onUpdate={(updates) => updateLight(light.id, updates)}
          recordHistory={recordHistory}
        />
      ))}
    </div>
  );
};

interface LightGizmoProps {
  light: Light;
  zoom: number;
  onUpdate: (updates: Partial<Light>) => void;
  recordHistory: (name: string) => void;
}

const LightGizmo: React.FC<LightGizmoProps> = ({ light, zoom, onUpdate, recordHistory }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef<{ x: number, y: number } | null>(null);
  const startLightPos = useRef<{ x: number, y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
    startPos.current = { x: e.clientX, y: e.clientY };
    startLightPos.current = { x: light.position.x, y: light.position.y };
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!startPos.current || !startLightPos.current) return;

      const dx = (e.clientX - startPos.current.x) * (2 / zoom);
      const dy = (e.clientY - startPos.current.y) * (2 / zoom);

      onUpdate({
        position: {
          ...light.position,
          x: startLightPos.current.x + dx,
          y: startLightPos.current.y + dy,
          z: 600
        }
      });
    };

    const handleMouseUp = () => {
      if (isDragging) {
        recordHistory('Move Light');
      }
      setIsDragging(false);
      startPos.current = null;
      startLightPos.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, light.position, zoom, onUpdate]);

  const zScale = Math.max(0.5, Math.min(2.0, (light.position.z + 500) / 1000));
  const baseSize = isDragging ? 40 : 32;
  const finalSize = (baseSize * zScale) / zoom;

  return (
    <div
      style={{
        position: 'absolute',
        left: light.position.x / 2,
        top: light.position.y / 2,
        width: finalSize,
        height: finalSize,
        backgroundColor: light.color,
        border: `${3 * zScale}px solid ${light.color}`,
        outline: `${2 * zScale}px solid rgba(255,255,255,0.8)`,
        borderRadius: '50%',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'auto',
        cursor: 'move',
        boxShadow: `0 0 ${20 * zScale}px ${light.color}, inset 0 0 ${10 * zScale}px rgba(255,255,255,0.5)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'width 0.1s, height 0.1s, box-shadow 0.1s',
        opacity: light.visible ? 1 : 0.4,
        zIndex: Math.round(light.position.z + 1000)
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Inner Ring */}
      <div style={{
        width: '60%',
        height: '60%',
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.3)',
      }} />
    </div>
  );
};

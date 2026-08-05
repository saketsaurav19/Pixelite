import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import type { TextWarp } from '../../store/types';
import './Dialogs.css';

const WARP_STYLES = [
  'None',
  'Arc',
  'Arc Lower',
  'Arc Upper',
  'Arch',
  'Bulge',
  'Shell Lower',
  'Shell Upper',
  'Flag',
  'Wave',
  'Fish',
  'Rise',
  'Fish Eye',
  'Inflate',
  'Squeeze',
  'Twist'
] as const;

export const WarpDialog: React.FC = () => {
  const {
    isWarpDialogOpen,
    setIsWarpDialogOpen,
    activeLayerId,
    layers,
    updateLayer,
    recordHistory
  } = useStore();

  const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;
  const [backupWarp, setBackupWarp] = useState<TextWarp | undefined>(undefined);

  // local defaults
  const [style, setStyle] = useState<TextWarp['style']>('None');
  const [orientation, setOrientation] = useState<TextWarp['orientation']>('Horizontal');
  const [bend, setBend] = useState<number>(50);
  const [horizontalDistortion, setHorizontalDistortion] = useState<number>(0);
  const [verticalDistortion, setVerticalDistortion] = useState<number>(0);

  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isWarpDialogOpen) {
      setPosition({ x: 0, y: 0 });
    }
  }, [isWarpDialogOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  // Update local inputs when dialog opens & sync with active text layer's textWarp
  useEffect(() => {
    if (isWarpDialogOpen && activeLayer && activeLayer.type === 'text') {
      const warp = activeLayer.textWarp;
      setBackupWarp(warp ? { ...warp } : undefined);

      setStyle(warp?.style || 'None');
      setOrientation(warp?.orientation || 'Horizontal');
      setBend(warp?.bend !== undefined ? warp.bend : 50);
      setHorizontalDistortion(warp?.horizontalDistortion !== undefined ? warp.horizontalDistortion : 0);
      setVerticalDistortion(warp?.verticalDistortion !== undefined ? warp.verticalDistortion : 0);
    }
  }, [isWarpDialogOpen, activeLayerId]);

  if (!isWarpDialogOpen || !activeLayer || activeLayer.type !== 'text') {
    return null;
  }

  const handleUpdateLayerWarp = (updates: Partial<TextWarp>) => {
    const nextWarp: TextWarp = {
      style,
      orientation,
      bend,
      horizontalDistortion,
      verticalDistortion,
      ...updates
    };

    updateLayer(activeLayer.id, {
      textWarp: nextWarp.style === 'None' ? undefined : nextWarp
    });
  };

  const handleStyleChange = (newStyle: TextWarp['style']) => {
    setStyle(newStyle);
    if (newStyle === 'None') {
      updateLayer(activeLayer.id, { textWarp: undefined });
    } else {
      // Default to 50% bend if none was set
      handleUpdateLayerWarp({ style: newStyle });
    }
  };

  const handleCancel = () => {
    updateLayer(activeLayer.id, { textWarp: backupWarp });
    setIsWarpDialogOpen(false);
  };

  const handleOK = () => {
    recordHistory(style === 'None' ? 'Remove Text Warp' : 'Apply Text Warp');
    setIsWarpDialogOpen(false);
  };

  const isNone = style === 'None';

  return (
    <div
      className="dialog-overlay"
      onClick={handleCancel}
      style={{
        background: 'transparent',
        backdropFilter: 'none'
      }}
    >
      <div
        className="dialog-content warp-dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '320px', 
          maxWidth: '350px', 
          background: '#222', 
          border: '1px solid #444', 
          borderRadius: '6px',
          transform: `translate(${position.x}px, ${position.y}px)`,
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}
      >
        <div 
          className="dialog-header" 
          onMouseDown={handleMouseDown}
          style={{ 
            padding: '8px 12px', 
            borderBottom: '1px solid #333',
            cursor: 'move',
            userSelect: 'none'
          }}
        >
          <h2>Warp</h2>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={16} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '12px' }}>

          {/* Style Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#aaa', minWidth: '70px' }}>Style:</span>
            <select
              value={style}
              onChange={(e) => handleStyleChange(e.target.value as any)}
              style={{
                background: '#1a1a1a',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '3px',
                padding: '4px',
                flex: 1,
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {WARP_STYLES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ opacity: isNone ? 0.4 : 1, pointerEvents: isNone ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>

            {/* Orientation */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#aaa', minWidth: '70px' }}>Orientation:</span>
              <select
                disabled={isNone}
                value={orientation}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setOrientation(val);
                  handleUpdateLayerWarp({ orientation: val });
                }}
                style={{
                  background: '#1a1a1a',
                  color: '#fff',
                  border: '1px solid #444',
                  borderRadius: '3px',
                  padding: '4px',
                  flex: 1,
                  fontSize: '12px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="Horizontal">Horizontal</option>
                <option value="Vertical">Vertical</option>
              </select>
            </div>

            {/* Bend Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                <span>Bend:</span>
                <span>{bend}%</span>
              </div>
              <input
                type="range"
                disabled={isNone}
                min="-100"
                max="100"
                value={bend}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setBend(val);
                  handleUpdateLayerWarp({ bend: val });
                }}
                style={{ width: '100%', accentColor: '#0078d7', cursor: 'pointer' }}
              />
            </div>

            {/* Horizontal Distortion Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                <span>Horizontal Distortion:</span>
                <span>{horizontalDistortion}%</span>
              </div>
              <input
                type="range"
                disabled={isNone}
                min="-100"
                max="100"
                value={horizontalDistortion}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setHorizontalDistortion(val);
                  handleUpdateLayerWarp({ horizontalDistortion: val });
                }}
                style={{ width: '100%', accentColor: '#0078d7', cursor: 'pointer' }}
              />
            </div>

            {/* Vertical Distortion Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#aaa' }}>
                <span>Vertical Distortion:</span>
                <span>{verticalDistortion}%</span>
              </div>
              <input
                type="range"
                disabled={isNone}
                min="-100"
                max="100"
                value={verticalDistortion}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setVerticalDistortion(val);
                  handleUpdateLayerWarp({ verticalDistortion: val });
                }}
                style={{ width: '100%', accentColor: '#0078d7', cursor: 'pointer' }}
              />
            </div>

          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={handleCancel}
              style={{
                background: '#444',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleOK}
              style={{
                background: '#0078d7',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                padding: '6px 16px',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '500'
              }}
            >
              OK
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

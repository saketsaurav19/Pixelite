import React from 'react';
import type { Point } from '../types';
import { stopOverlayEvent } from '../Core/eventUtils';
import { toolState } from '../../../tools/toolState';
import { useStore } from '../../../store/useStore';

interface TransformOverlayProps {
  activeLayerId: string;
  layers: any[];
  documentSize: { w: number; h: number };
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  findLayerAbsoluteRect: (id: string, layers: any[]) => any;
  setActiveCropHandle: (handle: string | null) => void;
  setIsInteracting: (val: boolean) => void;
  getCoordinates: (clientX: number, clientY: number) => Point | null;
  lastPointRef: React.MutableRefObject<Point | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  activeLayerId,
  layers,
  documentSize,
  zoom,
  canvasOffset,
  canvasRotation,
  findLayerAbsoluteRect,
  setActiveCropHandle,
  setIsInteracting,
  getCoordinates,
  lastPointRef,
  onConfirm,
  onCancel,
}) => {
  const rect = findLayerAbsoluteRect(activeLayerId, layers);
  if (!rect) return null;

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isWarped = activeLayer && activeLayer.type === 'text' && activeLayer.textWarp && activeLayer.textWarp.style !== 'None';

  let w = rect.w || documentSize.w;
  let h = rect.h || documentSize.h;
  let x = rect.x;
  let y = rect.y;

  if (isWarped) {
    const padX = Math.round(w * 0.3) + 20;
    const padY = Math.round(h * 0.8) + 20;
    w = w + 2 * padX;
    h = h + 2 * padY;
    x = x - padX;
    y = y - padY;
  }

  const mode = useStore(state => state.transformMode);
  const corners = activeLayer?.corners;
  const warpGrid = activeLayer?.warpGrid;

  const handleMouseDown = (handle: string) => (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (c) {
      lastPointRef.current = c;
      toolState._transformStartCoords = { ...c };
    }
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      let startW = layer.width || documentSize.w;
      let startH = layer.height || documentSize.h;
      let startX = layer.position?.x || 0;
      let startY = layer.position?.y || 0;
      if (isWarped) {
        const padX = Math.round(startW * 0.3) + 20;
        const padY = Math.round(startH * 0.8) + 20;
        startW = startW + 2 * padX;
        startH = startH + 2 * padY;
        startX = startX - padX;
        startY = startY - padY;
      }
      toolState._transformStartLayerPos = { x: startX, y: startY };
      toolState._transformStartLayerSize = { w: startW, h: startH };
      toolState._transformStartLayerRotation = layer.rotation || 0;
      toolState._transformStartCornersList = layer.corners ? layer.corners.map((p: any) => ({ ...p })) : undefined;
    }
    toolState._transformActiveHandle = handle;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  const handleTouchStart = (handle: string) => (e: React.TouchEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    if (c) {
      lastPointRef.current = c;
      toolState._transformStartCoords = { ...c };
    }
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      let startW = layer.width || documentSize.w;
      let startH = layer.height || documentSize.h;
      let startX = layer.position?.x || 0;
      let startY = layer.position?.y || 0;
      if (isWarped) {
        const padX = Math.round(startW * 0.3) + 20;
        const padY = Math.round(startH * 0.8) + 20;
        startW = startW + 2 * padX;
        startH = startH + 2 * padY;
        startX = startX - padX;
        startY = startY - padY;
      }
      toolState._transformStartLayerPos = { x: startX, y: startY };
      toolState._transformStartLayerSize = { w: startW, h: startH };
      toolState._transformStartLayerRotation = layer.rotation || 0;
      toolState._transformStartCornersList = layer.corners ? layer.corners.map((p: any) => ({ ...p })) : undefined;
    }
    toolState._transformActiveHandle = handle;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  // Determine bounds of current transformed layout to position the confirmation actions bar
  let xs: number[] = [];
  let ys: number[] = [];

  if (corners) {
    xs = corners.map(p => p.x);
    ys = corners.map(p => p.y);
  } else if (warpGrid) {
    xs = warpGrid.map(p => p.x);
    ys = warpGrid.map(p => p.y);
  } else {
    // Standard mode: calculate 4 corners of rotated layer
    const lx = rect.x;
    const ly = rect.y;
    const lw = w;
    const lh = h;
    const lr = rect.rotation || 0;
    const theta = (lr * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    
    const localCorners = [
      { x: 0, y: 0 },
      { x: lw, y: 0 },
      { x: lw, y: lh },
      { x: 0, y: lh }
    ];
    const rotatedCorners = localCorners.map(p => ({
      x: lx + p.x * cosT - p.y * sinT,
      y: ly + p.x * sinT + p.y * cosT
    }));
    
    xs = rotatedCorners.map(p => p.x);
    ys = rotatedCorners.map(p => p.y);
  }

  const xMin = xs.length > 0 ? Math.min(...xs) : rect.x;
  const xMax = xs.length > 0 ? Math.max(...xs) : rect.x + w;
  const yMax = ys.length > 0 ? Math.max(...ys) : rect.y + h;

  const isDeformed = ['skew', 'distort', 'perspective', 'warp'].includes(mode);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${documentSize.w}px`,
        height: `${documentSize.h}px`,
        transform: `translate(-50%, -50%) scale(1) translate(${canvasOffset.x}px, ${canvasOffset.y}px) rotate(${canvasRotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
        zIndex: 1500,
      }}
    >
      {/* 1. Warp mesh overlay (4x4 grid) */}
      {mode === 'warp' && warpGrid && warpGrid.length === 16 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            {/* Draw warp mesh lines */}
            {Array.from({ length: 4 }).map((_, r) => (
              <path
                key={`h-line-${r}`}
                d={`M ${warpGrid[r * 4].x},${warpGrid[r * 4].y} L ${warpGrid[r * 4 + 1].x},${warpGrid[r * 4 + 1].y} L ${warpGrid[r * 4 + 2].x},${warpGrid[r * 4 + 2].y} L ${warpGrid[r * 4 + 3].x},${warpGrid[r * 4 + 3].y}`}
                fill="none"
                stroke="#0078d4"
                strokeWidth={1.5 / zoom}
              />
            ))}
            {Array.from({ length: 4 }).map((_, c) => (
              <path
                key={`v-line-${c}`}
                d={`M ${warpGrid[c].x},${warpGrid[c].y} L ${warpGrid[4 + c].x},${warpGrid[4 + c].y} L ${warpGrid[8 + c].x},${warpGrid[8 + c].y} L ${warpGrid[12 + c].x},${warpGrid[12 + c].y}`}
                fill="none"
                stroke="#0078d4"
                strokeWidth={1.5 / zoom}
              />
            ))}
          </svg>

          {/* Warp Grid Control Points */}
          {warpGrid.map((point, idx) => (
            <div
              key={`warp-pt-${idx}`}
              onMouseDown={handleMouseDown(`warp-${idx}`)}
              onTouchStart={handleTouchStart(`warp-${idx}`)}
              style={{
                position: 'absolute',
                left: `${point.x}px`,
                top: `${point.y}px`,
                width: `${12 / zoom}px`,
                height: `${12 / zoom}px`,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 10005
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Distort/Perspective/Skew Quad Bounding Box & Handles */}
      {isDeformed && mode !== 'warp' && corners && corners.length === 4 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            <polygon
              points={corners.map(p => `${p.x},${p.y}`).join(' ')}
              fill="rgba(0, 120, 244, 0.03)"
              stroke="#0078d4"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom}, ${4 / zoom}`}
              style={{ pointerEvents: 'auto', cursor: 'move' }}
              onMouseDown={handleMouseDown('move')}
              onTouchStart={handleTouchStart('move')}
            />
          </svg>

          {/* Corner Handles */}
          {corners.map((point, idx) => {
            const handleNames = ['tl', 'tr', 'br', 'bl'];
            const handle = handleNames[idx];
            let cursorStyle = 'pointer';
            if (handle === 'tl' || handle === 'br') cursorStyle = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') cursorStyle = 'nesw-resize';

            return (
              <div
                key={`corner-${handle}`}
                onMouseDown={handleMouseDown(handle)}
                onTouchStart={handleTouchStart(handle)}
                style={{
                  position: 'absolute',
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  width: `${14 / zoom}px`,
                  height: `${14 / zoom}px`,
                  backgroundColor: '#ffffff',
                  border: `${1.5 / zoom}px solid #0078d4`,
                  boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                  transform: 'translate(-50%, -50%)',
                  cursor: cursorStyle,
                  pointerEvents: 'auto',
                  zIndex: 10003
                }}
              />
            );
          })}

          {/* Side Midpoint Handles (Skew and Distort) */}
          {[
            { name: 'tm', x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2, cursor: 'ns-resize' },
            { name: 'mr', x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2, cursor: 'ew-resize' },
            { name: 'bm', x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2, cursor: 'ns-resize' },
            { name: 'ml', x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2, cursor: 'ew-resize' }
          ].map((mid) => (
            <div
              key={`mid-${mid.name}`}
              onMouseDown={handleMouseDown(mid.name)}
              onTouchStart={handleTouchStart(mid.name)}
              style={{
                position: 'absolute',
                left: `${mid.x}px`,
                top: `${mid.y}px`,
                width: `${14 / zoom}px`,
                height: `${14 / zoom}px`,
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: mid.cursor,
                pointerEvents: 'auto',
                zIndex: 10002
              }}
            />
          ))}
        </div>
      )}

      {/* 3. Default Scale, Rotate, Free Transform rectangular bounding box */}
      {!isDeformed && (
        <div
          className="layer-move-outline"
          onMouseDown={handleMouseDown('move')}
          onTouchStart={handleTouchStart('move')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${w}px`,
            height: `${h}px`,
            transform: `translate(${x}px, ${y}px) rotate(${rect.rotation}deg)`,
            transformOrigin: '0 0',
            pointerEvents: 'auto',
            cursor: 'move',
            border: `${8 / zoom}px dashed #0078d4`,
            outline: `${1 / zoom}px dashed rgba(255, 255, 255, 0.8)`,
            boxShadow: `0 0 ${4 / zoom}px rgba(0, 0, 0, 0.2)`
          }}
        >
          {/* Connection line for rotation handle */}
          {mode !== 'scale' && (
            <div
              style={{
                position: 'absolute',
                top: `${-25 / zoom}px`,
                left: '50%',
                width: `${1 / zoom}px`,
                height: `${25 / zoom}px`,
                backgroundColor: '#0078d4',
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            />
          )}

          {/* Rotation Handle */}
          {mode !== 'scale' && (
            <div
              className="handle rot"
              onMouseDown={handleMouseDown('rot')}
              onTouchStart={handleTouchStart('rot')}
              style={{
                position: 'absolute',
                top: `${-25 / zoom}px`,
                left: '50%',
                width: `${16 / zoom}px`,
                height: `${16 / zoom}px`,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: 'crosshair',
                pointerEvents: 'auto'
              }}
            />
          )}

          {/* 8 Resizing Handles (Hidden or shown depending on mode) */}
          {mode !== 'rotate' && ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'].map(handle => {
            let cursorStyle = 'pointer';
            if (handle === 'tl' || handle === 'br') cursorStyle = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') cursorStyle = 'nesw-resize';
            else if (handle === 'tm' || handle === 'bm') cursorStyle = 'ns-resize';
            else if (handle === 'ml' || handle === 'mr') cursorStyle = 'ew-resize';

            return (
              <div
                key={handle}
                className={`handle ${handle}`}
                onMouseDown={handleMouseDown(handle)}
                onTouchStart={handleTouchStart(handle)}
                style={{
                  pointerEvents: 'auto',
                  cursor: cursorStyle,
                  width: `${16 / zoom}px`,
                  height: `${16 / zoom}px`,
                  borderWidth: `${1.5 / zoom}px`
                }}
              />
            );
          })}
        </div>
      )}

      {/* 4. Common Confirmation Actions Bar (Always below the bounds of the layer) */}
      <div
        className="crop-actions-bar bottom"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: `${(xMin + xMax) / 2}px`,
          top: `${yMax + 20}px`,
          bottom: 'auto',
          right: 'auto',
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: 'top center',
          width: 'fit-content',
          pointerEvents: 'auto',
          display: 'flex',
          gap: '8px',
          zIndex: 100002
        }}
      >
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          title="Commit Transform"
          style={{ cursor: 'pointer' }}
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          title="Cancel Transform"
          style={{ cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

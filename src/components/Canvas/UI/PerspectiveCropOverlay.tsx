import React from 'react';
import type { Point } from '../types';
import { stopOverlayEvent } from '../Core/eventUtils';
import { toolState } from '../../../tools/toolState';

interface PerspectiveCropOverlayProps {
  lassoPaths: Point[][];
  getCoordinates: (x: number, y: number) => Point | null;
  setIsInteracting: (val: boolean) => void;
  lastPointRef: React.MutableRefObject<Point | null>;
  handleDoubleClick: () => void;
  setLassoPaths: (paths: Point[][]) => void;
}

export const PerspectiveCropOverlay: React.FC<PerspectiveCropOverlayProps> = ({
  lassoPaths,
  getCoordinates,
  setIsInteracting,
  lastPointRef,
  handleDoubleClick,
  setLassoPaths
}) => {
  if (lassoPaths.length === 0 || lassoPaths[0].length !== 4) return null;

  const p = lassoPaths[0];

  const handleMouseDown = (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (!c) return;
    toolState._pcDragIdx = 8; // Move whole quad
    toolState._pcStartPoint = { ...c };
    toolState._pcOrigPoints = p.map(point => ({ ...point }));
    setIsInteracting(true);
    lastPointRef.current = c;
  };

  const midpoints = [
    { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }, // Top
    { x: (p[1].x + p[2].x) / 2, y: (p[1].y + p[2].y) / 2 }, // Right
    { x: (p[2].x + p[3].x) / 2, y: (p[2].y + p[3].y) / 2 }, // Bottom
    { x: (p[3].x + p[0].x) / 2, y: (p[3].y + p[0].y) / 2 }  // Left
  ];

  // Grid lines
  const gridLines = [];
  for (let i = 1; i <= 2; i++) {
    const t = i / 3;
    // Horizontal lines
    const hStart = { x: p[0].x * (1 - t) + p[3].x * t, y: p[0].y * (1 - t) + p[3].y * t };
    const hEnd = { x: p[1].x * (1 - t) + p[2].x * t, y: p[1].y * (1 - t) + p[2].y * t };
    gridLines.push({ start: hStart, end: hEnd });

    // Vertical lines
    const vStart = { x: p[0].x * (1 - t) + p[1].x * t, y: p[0].y * (1 - t) + p[1].y * t };
    const vEnd = { x: p[3].x * (1 - t) + p[2].x * t, y: p[3].y * (1 - t) + p[2].y * t };
    gridLines.push({ start: vStart, end: vEnd });
  }

  return (
    <>
      <svg style={{ 
        position: 'absolute', 
        top: -2000, 
        left: -2000, 
        width: 'calc(100% + 4000px)', 
        height: 'calc(100% + 4000px)', 
        pointerEvents: 'none', 
        zIndex: 10000,
        overflow: 'visible'
      }}>
        <g transform="translate(2000, 2000)">
        {/* Quad Area */}
        <path
          d={`M ${p[0].x / 2},${p[0].y / 2} L ${p[1].x / 2},${p[1].y / 2} L ${p[2].x / 2},${p[2].y / 2} L ${p[3].x / 2},${p[3].y / 2} Z`}
          fill="rgba(0, 170, 255, 0.1)"
          stroke="#00aaff"
          strokeWidth={1}
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onMouseDown={handleMouseDown}
        />

        {/* Grid Lines */}
        {gridLines.map((line, i) => (
          <line
            key={i}
            x1={line.start.x / 2}
            y1={line.start.y / 2}
            x2={line.end.x / 2}
            y2={line.end.y / 2}
            stroke="rgba(255, 255, 255, 0.5)"
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
        ))}

        {/* Corner Handles */}
        {p.map((point, i) => (
          <g key={`corner-g-${i}`} 
            onMouseDown={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.clientX, e.clientY);
              if (c) lastPointRef.current = c;
              toolState._pcDragIdx = i;
              setIsInteracting(true);
            }}
            onTouchStart={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
              if (c) lastPointRef.current = c;
              (window as any)._pcDragIdx = i;
              setIsInteracting(true);
            }}
            style={{ cursor: i % 2 === 0 ? 'nwse-resize' : 'nesw-resize', pointerEvents: 'auto' }}
          >
            {/* Hit Area */}
            <rect
              x={point.x / 2 - 15}
              y={point.y / 2 - 15}
              width={30}
              height={30}
              fill="transparent"
            />
            {/* Visual Handle */}
            <rect
              x={point.x / 2 - 5}
              y={point.y / 2 - 5}
              width={10}
              height={10}
              fill="#fff"
              stroke="#00aaff"
              strokeWidth={1}
            />
          </g>
        ))}

        {/* Midpoint Handles */}
        {midpoints.map((point, i) => (
          <g key={`mid-g-${i}`}
            onMouseDown={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.clientX, e.clientY);
              if (c) lastPointRef.current = c;
<<<<<<< HEAD
              (window as any)._pcDragIdx = i + 4;
              (window as any)._pcStartPoint = { ...c };
              (window as any)._pcOrigPoints = p.map(pt => ({ ...pt }));
=======
              toolState._pcDragIdx = i + 4; // Midpoint indices are 4-7
              toolState._pcStartPoint = { ...c };
              toolState._pcOrigPoints = p.map(pt => ({ ...pt }));
>>>>>>> 734602a4eff0a2c33dd75c49b5bcff07f2544a7f
              setIsInteracting(true);
            }}
            onTouchStart={(e) => {
              stopOverlayEvent(e);
              const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
              if (c) lastPointRef.current = c;
              (window as any)._pcDragIdx = i + 4;
              (window as any)._pcStartPoint = { ...c };
              (window as any)._pcOrigPoints = p.map(pt => ({ ...pt }));
              setIsInteracting(true);
            }}
            style={{ cursor: i % 2 === 0 ? 'ns-resize' : 'ew-resize', pointerEvents: 'auto' }}
          >
            {/* Hit Area */}
            <rect
              x={point.x / 2 - 12}
              y={point.y / 2 - 12}
              width={24}
              height={24}
              fill="transparent"
            />
            {/* Visual Handle */}
            <rect
              x={point.x / 2 - 4}
              y={point.y / 2 - 4}
              width={8}
              height={8}
              fill="#fff"
              stroke="#00aaff"
              strokeWidth={1}
            />
          </g>
        ))}
        </g>
      </svg>

      <div
        className="perspective-actions-bar"
        style={{
          position: 'absolute',
          left: Math.min(...p.map(point => point.x)) / 2,
          top: Math.max(...p.map(point => point.y)) / 2 + 15,
          zIndex: 20000,
          display: 'flex', gap: '10px', background: '#222', padding: '8px', borderRadius: '6px', border: '1px solid #444',
          width: 'fit-content'
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button onClick={handleDoubleClick} style={{ background: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer' }}>✓</button>
        <button onClick={() => { delete toolState._pcPoints; setLassoPaths([]); setIsInteracting(false); }} style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer' }}>✕</button>
      </div>
    </>
  );
};

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

  // Grid lines (4/4 grid)
  const gridLines = [];
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
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
            d={`M ${p[0].x},${p[0].y} L ${p[1].x},${p[1].y} L ${p[2].x},${p[2].y} L ${p[3].x},${p[3].y} Z`}
            fill="rgba(0, 170, 255, 0)"
            stroke="#00aaff"
            strokeWidth={1.5}
            style={{ pointerEvents: 'auto', cursor: 'move' }}
            onMouseDown={handleMouseDown}
          />
          {/* Grid Lines */}
          {gridLines.map((line, i) => (
            <line
              key={i}
              x1={line.start.x}
              y1={line.start.y}
              x2={line.end.x}
              y2={line.end.y}
              stroke="#00aaff"
              strokeWidth={1.5}
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
              <rect x={point.x - 15} y={point.y - 15} width={30} height={30} fill="transparent" />
              <rect x={point.x - 5} y={point.y - 5} width={10} height={10} fill="#fff" stroke="#00aaff" strokeWidth={1} />
            </g>
          ))}
          {/* Midpoint Handles */}
          {midpoints.map((point, i) => (
            <g key={`mid-g-${i}`}
              onMouseDown={(e) => {
                stopOverlayEvent(e);
                const c = getCoordinates(e.clientX, e.clientY);
                toolState._pcDragIdx = i + 4;
                toolState._pcStartPoint = { ...c };
                toolState._pcOrigPoints = p.map(pt => ({ ...pt }));
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
              <rect x={point.x - 12} y={point.y - 12} width={24} height={24} fill="transparent" />
              <rect x={point.x - 4} y={point.y - 4} width={8} height={8} fill="#fff" stroke="#00aaff" strokeWidth={1} />
            </g>
          ))}
        </g>
      </svg>
      <div
        className="crop-actions-bar"
        style={{
          position: 'absolute',
          left: Math.min(...p.map(point => point.x)),
          top: Math.max(...p.map(point => point.y)) + 15,
          bottom: 'auto',
          right: 'auto',
          zIndex: 20000,
          display: 'flex',
          gap: '8px',
          width: 'fit-content'
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); handleDoubleClick(); }}
          title="Apply Perspective Crop"
          style={{ cursor: 'pointer' }}
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => {
            e.stopPropagation();
            delete toolState._pcPoints;
            setLassoPaths([]);
            setIsInteracting(false);
          }}
          title="Cancel Perspective Crop"
          style={{ cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </>
  );
};

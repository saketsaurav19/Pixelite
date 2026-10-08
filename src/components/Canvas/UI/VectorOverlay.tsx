import React from 'react';
import type { Point } from '../types';

interface VectorPoint extends Point {
  handleIn?: { x: number; y: number };
  handleOut?: { x: number; y: number };
}

interface VectorPath {
  id?: string;
  points: VectorPoint[];
  closed: boolean;
  smooth?: boolean;
}

interface VectorOverlayProps {
  vectorPaths: VectorPath[];
  activePathIndex: number | null;
  activeTool: string;
  currentMousePos: Point | null;
  zoom: number;
  getSvgPathData: (points: VectorPoint[], closed: boolean, smooth?: boolean) => string;
  selectedPoint: { pathIdx: number; pointIdx: number; handle?: 'in' | 'out' } | null;
}

export const VectorOverlay: React.FC<VectorOverlayProps> = ({
  vectorPaths,
  activePathIndex,
  activeTool,
  currentMousePos,
  zoom,
  getSvgPathData,
  selectedPoint,
}) => {
  const isVectorTool = ['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool);
  if (vectorPaths.length === 0 && !(['pen', 'curvature_pen', 'free_pen'].includes(activeTool) && activePathIndex !== null)) return null;

  return (
    <svg className="vector-paths-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1100 }} onClick={(e) => { e.stopPropagation(); }}>
      {vectorPaths.map((path, idx) => {
        const isActive = activePathIndex === idx;
        if (!isActive && !isVectorTool) return null;
        return (
          <path
            key={idx}
            d={getSvgPathData(path.points, path.closed, path.smooth)}
            fill="none"
            stroke={isActive ? "#888888" : "rgba(128, 128, 128, 0.4)"}
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        );
      })}
      
      {/* Rubber Band Preview */}
      {(activeTool === 'pen' || activeTool === 'curvature_pen' || activeTool === 'free_pen') && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
        <>
          <path
            d={getSvgPathData([...vectorPaths[activePathIndex].points, currentMousePos as VectorPoint], false, activeTool === 'curvature_pen' || vectorPaths[activePathIndex].smooth)}
            stroke="#888888"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            fill="none"
            style={{ opacity: 0.8 }}
          />
          <circle
            cx={currentMousePos.x}
            cy={currentMousePos.y}
            r="4"
            fill="#888888"
            opacity="0.3"
          />
          <circle
            cx={currentMousePos.x}
            cy={currentMousePos.y}
            r="2"
            fill="#fff"
            stroke="#888888"
            strokeWidth="1"
          />
        </>
      )}

      {/* Hover Preview for start of new path */}
      {activeTool === 'pen' && activePathIndex === null && currentMousePos && (
        <circle
          cx={currentMousePos.x}
          cy={currentMousePos.y}
          r="4"
          fill="none"
          stroke="#888888"
          strokeWidth="1"
          strokeDasharray="2 2"
        />
      )}

      {/* Close Path Square Indicator */}
      {['pen', 'curvature_pen'].includes(activeTool) && activePathIndex !== null && vectorPaths[activePathIndex] && !vectorPaths[activePathIndex].closed && currentMousePos && (
        (() => {
          const firstPoint = vectorPaths[activePathIndex].points[0];
          const isNearStart = Math.hypot(currentMousePos.x - firstPoint.x, currentMousePos.y - firstPoint.y) < 10 / (zoom || 1);
          if (isNearStart) {
            return (
              <rect
                x={firstPoint.x - 4}
                y={firstPoint.y - 4}
                width="8"
                height="8"
                fill="none"
                stroke="#888888"
                strokeWidth="2"
              />
            );
          }
          return null;
        })()
      )}

      {/* Render Anchor Points and Direction Handles for selected anchor */}
      {['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool) && vectorPaths.map((path, pIdx) => (
        <g key={`path-points-${pIdx}`}>
          {path.points.map((p: VectorPoint, ptIdx: number) => {
            const isSelected = activePathIndex === pIdx && selectedPoint?.pointIdx === ptIdx;
            const dist = currentMousePos ? Math.hypot(p.x - currentMousePos.x, p.y - currentMousePos.y) : Infinity;
            const isHovered = dist < 12 / (zoom || 1);
            const radius = isSelected ? 5 : (isHovered ? 6 : 3);

            // Render direction handles for the selected anchor, but also synthesize
            // "ghost" handles for ANY straight anchor while the Direct Selection
            // tool is active — so every point offers draggable direction handles
            // (straight segments can be pulled into curves). Ghost handles are
            // derived from neighbouring anchors and drawn faintly until grabbed.
            const showHandles = isSelected || activeTool === 'direct_select';
            const handleLines: { x1: number; y1: number; x2: number; y2: number; key: string; ghost?: boolean }[] = [];
            if (showHandles) {
              if (p.handleOut) {
                handleLines.push({ x1: p.x, y1: p.y, x2: p.handleOut.x, y2: p.handleOut.y, key: 'out' });
              } else if (activeTool === 'direct_select' && !isSelected) {
                const next = path.points[(ptIdx + 1) % path.points.length];
                const dx = next.x - p.x, dy = next.y - p.y;
                const len = Math.hypot(dx, dy);
                const hl = Math.min((len || 1) * 0.4, 60);
                if (len > 0) handleLines.push({ x1: p.x, y1: p.y, x2: p.x + (dx / len) * hl, y2: p.y + (dy / len) * hl, key: 'out', ghost: true });
              }
              if (p.handleIn) {
                handleLines.push({ x1: p.x, y1: p.y, x2: p.handleIn.x, y2: p.handleIn.y, key: 'in' });
              } else if (activeTool === 'direct_select' && !isSelected) {
                const prev = path.points[(ptIdx - 1 + path.points.length) % path.points.length];
                const dx = prev.x - p.x, dy = prev.y - p.y;
                const len = Math.hypot(dx, dy);
                const hl = Math.min((len || 1) * 0.4, 60);
                if (len > 0) handleLines.push({ x1: p.x, y1: p.y, x2: p.x + (dx / len) * hl, y2: p.y + (dy / len) * hl, key: 'in', ghost: true });
              }
            }

            const isSmooth = path.smooth;
            return (
              <g key={`${pIdx}-${ptIdx}`}>
                {/* Direction handles - visible for selected anchor, or ghost handles for any straight anchor under Direct Selection */}
                {handleLines.map((line) => (
                  <line
                    key={line.key}
                    x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                    stroke="#888888"
                    strokeWidth="1.5"
                    strokeDasharray={line.ghost ? '3 2' : undefined}
                    opacity={line.ghost ? 0.45 : 0.8}
                  />
                ))}
                {handleLines.map((line) => (
                  <circle
                    key={`handle-${line.key}`}
                    cx={line.x2}
                    cy={line.y2}
                    r="4"
                    fill={line.ghost ? "transparent" : "#888888"}
                    stroke="#888888"
                    strokeWidth="1.5"
                    opacity={line.ghost ? 0.5 : 0.9}
                  />
                ))}
                {/* Anchor point: square for straight/corner, circle for smooth/curved */}
                {isSmooth ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={radius}
                    fill={isSelected ? "#888888" : "#fff"}
                    stroke="#888888"
                    strokeWidth="1"
                  />
                ) : (
                  <rect
                    x={p.x - radius}
                    y={p.y - radius}
                    width={radius * 2}
                    height={radius * 2}
                    fill={isSelected ? "#888888" : "#fff"}
                    stroke="#888888"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
};

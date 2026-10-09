import React, { useCallback, useEffect, useState } from 'react';
import { stopOverlayEvent } from '../Core/eventUtils';
import type { Point } from '../types';
import {
  mwGetMesh,
  mwStartCornerDrag,
  mwClearMesh,
} from '../../../tools/Transform/meshWarpTool';

interface MeshWarpOverlayProps {
  activeLayerId: string;
  layers: any[];
  documentSize: { w: number; h: number };
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  setIsInteracting: (val: boolean) => void;
  getCoordinates: (clientX: number, clientY: number) => Point | null;
  lastPointRef: React.MutableRefObject<Point | null>;
  onCommit: () => void;
  onCancel: () => void;
}

const HANDLE_SIZE = 12;

export const MeshWarpOverlay: React.FC<MeshWarpOverlayProps> = ({
  activeLayerId,
  layers,
  documentSize,
  zoom,
  canvasOffset,
  canvasRotation,
  setIsInteracting,
  getCoordinates,
  lastPointRef,
  onCommit,
  onCancel,
}) => {
  const layer = layers.find(l => l.id === activeLayerId);
  if (!layer) return null;

  const layerX = layer.position?.x || 0;
  const layerY = layer.position?.y || 0;

  const [mesh, setMesh] = useState(mwGetMesh());

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setMesh(mwGetMesh());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activeLayerId]);

  useEffect(() => {
    return () => {
      mwClearMesh();
    };
  }, [activeLayerId]);

  const handleMouseDown = useCallback((cornerIdx: number) => (e: React.MouseEvent | React.TouchEvent) => {
    stopOverlayEvent(e);
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    const c = getCoordinates(clientX, clientY);
    if (!c) return;

    const local = { x: c.x - layerX, y: c.y - layerY };
    lastPointRef.current = c;
    mwStartCornerDrag(cornerIdx, local);
    setIsInteracting(true);
  }, [getCoordinates, setIsInteracting, lastPointRef, layerX, layerY]);

  if (!mesh || mesh.length < 4) return null;

  const canvasMesh = mesh.map(p => ({ x: p.x + layerX, y: p.y + layerY }));

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
        zIndex: 1500,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <svg
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
        >
          <line x1={canvasMesh[0].x} y1={canvasMesh[0].y} x2={canvasMesh[1].x} y2={canvasMesh[1].y} stroke="#fff" strokeWidth={1.5 / zoom} />
          <line x1={canvasMesh[1].x} y1={canvasMesh[1].y} x2={canvasMesh[2].x} y2={canvasMesh[2].y} stroke="#fff" strokeWidth={1.5 / zoom} />
          <line x1={canvasMesh[2].x} y1={canvasMesh[2].y} x2={canvasMesh[3].x} y2={canvasMesh[3].y} stroke="#fff" strokeWidth={1.5 / zoom} />
          <line x1={canvasMesh[3].x} y1={canvasMesh[3].y} x2={canvasMesh[0].x} y2={canvasMesh[0].y} stroke="#fff" strokeWidth={1.5 / zoom} />
        </svg>

        {canvasMesh.map((pt, idx) => (
          <div
            key={`mw-corner-${idx}`}
            onMouseDown={handleMouseDown(idx)}
            onTouchStart={handleMouseDown(idx)}
            style={{
              position: 'absolute',
              left: `${pt.x}px`,
              top: `${pt.y}px`,
              width: `${HANDLE_SIZE / zoom}px`,
              height: `${HANDLE_SIZE / zoom}px`,
              borderRadius: '3px',
              backgroundColor: '#0078d4',
              border: `${1.5 / zoom}px solid #fff`,
              boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.35)`,
              transform: 'translate(-50%, -50%)',
              cursor: 'move',
              pointerEvents: 'auto',
              zIndex: 10005,
            }}
            title={`Vertex ${idx + 1}`}
          />
        ))}
      </div>
      <div
        className="crop-actions-bar"
        style={{
          position: 'absolute',
          left: Math.min(...canvasMesh.map(p => p.x)),
          top: Math.max(...canvasMesh.map(p => p.y)) + 15,
          zIndex: 20000,
          display: 'flex',
          gap: '8px',
          width: 'fit-content',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); onCommit(); }}
          title="Apply Mesh Warp"
          style={{ cursor: 'pointer' }}
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          title="Cancel Mesh Warp"
          style={{ cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

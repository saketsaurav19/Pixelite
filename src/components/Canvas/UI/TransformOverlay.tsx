import React from 'react';
import type { Point } from '../types';
import { stopOverlayEvent } from '../Core/eventUtils';
import { toolState } from '../../../tools/toolState';

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

  const w = rect.w || documentSize.w;
  const h = rect.h || documentSize.h;

  const handleMouseDown = (handle: string) => (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (c) {
      lastPointRef.current = c;
      toolState._transformStartCoords = { ...c };
    }
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      toolState._transformStartLayerPos = { x: layer.position?.x || 0, y: layer.position?.y || 0 };
      toolState._transformStartLayerSize = { w: layer.width || documentSize.w, h: layer.height || documentSize.h };
      toolState._transformStartLayerRotation = layer.rotation || 0;
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
      toolState._transformStartLayerPos = { x: layer.position?.x || 0, y: layer.position?.y || 0 };
      toolState._transformStartLayerSize = { w: layer.width || documentSize.w, h: layer.height || documentSize.h };
      toolState._transformStartLayerRotation = layer.rotation || 0;
    }
    toolState._transformActiveHandle = handle;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

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
          transform: `translate(${rect.x}px, ${rect.y}px) rotate(${rect.rotation}deg)`,
          transformOrigin: '0 0',
          pointerEvents: 'auto',
          cursor: 'move',
          border: `${8 / zoom}px dashed #0078d4`,
          outline: `${1 / zoom}px dashed rgba(255, 255, 255, 0.8)`,
          boxShadow: `0 0 ${4 / zoom}px rgba(0, 0, 0, 0.2)`
        }}
      >
        {/* Connection line for rotation handle */}
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

        {/* Rotation Handle */}
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

        {/* 8 Resizing Handles */}
        {['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'].map(handle => {
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

        {/* Transform Confirmation Actions Bar */}
        <div
          className="crop-actions-bar bottom"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: `${-55 / zoom}px`,
            transform: `translateX(-50%) rotate(${-rect.rotation}deg) scale(${1 / zoom})`,
            transformOrigin: 'bottom center',
            width: 'fit-content',
            pointerEvents: 'auto',
            display: 'flex',
            gap: '8px',
            zIndex: 10002
          }}
        >
          <button
            className="crop-action-btn confirm"
            onClick={(e) => { e.stopPropagation(); onConfirm(); }}
            title="Commit Transform"
            style={{
              cursor: 'pointer'
            }}
          >
            ✓
          </button>
          <button
            className="crop-action-btn cancel"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            title="Cancel Transform"
            style={{
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

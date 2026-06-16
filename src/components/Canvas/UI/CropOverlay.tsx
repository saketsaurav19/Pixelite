import React from 'react';
import type { Point, Rect } from '../types';
import { stopOverlayEvent } from '../Core/eventUtils';

interface CropOverlayProps {
  cropRect: Rect | null;
  getCoordinates: (clientX: number, clientY: number) => Point | null;
  lastPointRef: React.MutableRefObject<Point | null>;
  setActiveCropHandle: (handle: string | null) => void;
  setIsInteracting: (val: boolean) => void;
  applyCrop: () => void;
  setCropRect: (rect: Rect | null) => void;
}

export const CropOverlay: React.FC<CropOverlayProps> = ({
  cropRect,
  getCoordinates,
  lastPointRef,
  setActiveCropHandle,
  setIsInteracting,
  applyCrop,
  setCropRect
}) => {
  if (!cropRect) return null;

  const handleMouseDown = (handle: string) => (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (c) lastPointRef.current = c;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  const handleTouchStart = (handle: string) => (e: React.TouchEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    if (c) lastPointRef.current = c;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  return (
    <div
      className="crop-marquee"
      onMouseDown={handleMouseDown('move')}
      onTouchStart={handleTouchStart('move')}
      style={{
        left: cropRect.w >= 0 ? cropRect.x : cropRect.x + cropRect.w,
        top: cropRect.h >= 0 ? cropRect.y : cropRect.y + cropRect.h,
        width: Math.abs(cropRect.w),
        height: Math.abs(cropRect.h),
        position: 'absolute',
        border: '4px solid #008cffff',
        outline: '2000px solid rgba(0,0,0,0.5)',
        zIndex: 10000,
        cursor: 'move'
      }}
    >
      {/* 3x3 Grid Lines */}
      <div style={{ position: 'absolute', top: 0, left: '33.33%', width: '3px', height: '100%', borderLeft: '1px solid #008cffff', mixBlendMode: 'difference', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: 0, left: '66.66%', width: '3px', height: '100%', borderLeft: '1px solid #008cffff', mixBlendMode: 'difference', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '33.33%', left: 0, height: '3px', width: '100%', borderTop: '1px solid #008cffff', mixBlendMode: 'difference', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', top: '66.66%', left: 0, height: '3px', width: '100%', borderTop: '1px solid #008cffff', mixBlendMode: 'difference', pointerEvents: 'none' }} />

      {/* 4 Corner Handles Only */}
      {['tl', 'tr', 'bl', 'br'].map(handle => (
        <div
          key={handle}
          className={`crop-handle ${handle}`}
          onMouseDown={handleMouseDown(handle)}
          onTouchStart={handleTouchStart(handle)}
        />
      ))}

      <div className="crop-actions-bar bottom" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} style={{ width: 'fit-content' }}>
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); applyCrop(); }}
          title="Apply Crop"
          style={{ cursor: 'pointer' }}
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); setCropRect(null); }}
          title="Cancel Crop"
          style={{ cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

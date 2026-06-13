import React, { useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';

export const GlobalRulers: React.FC = () => {
  const { showRulers, rulerUnit, zoom, canvasOffset, documentSize } = useStore();
  const topRulerRef = useRef<HTMLCanvasElement>(null);
  const leftRulerRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!showRulers) return;

    const drawRuler = (canvas: HTMLCanvasElement, isVertical: boolean) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Ruler background
      ctx.fillStyle = '#2c2c2c';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#b0b0b0';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 1;

      // Ruler lines (bottom edge for top ruler, right edge for left ruler)
      ctx.beginPath();
      if (isVertical) {
        ctx.moveTo(width - 1, 0);
        ctx.lineTo(width - 1, height);
      } else {
        ctx.moveTo(0, height - 1);
        ctx.lineTo(width, height - 1);
      }
      ctx.stroke();

      ctx.beginPath();
      ctx.strokeStyle = '#b0b0b0';

      const unitMultiplier = rulerUnit === 'in' ? 96 : rulerUnit === 'cm' ? 37.795 : 1; // Approximate pixels per unit
      const pixelsPerUnit = unitMultiplier * zoom;

      // Determine tick intervals
      let tickInterval = pixelsPerUnit;
      let subdivisions = 10;

      if (rulerUnit === 'in') subdivisions = 8;

      while (tickInterval < 50) {
        tickInterval *= 2;
        subdivisions = rulerUnit === 'in' ? 8 : 10;
      }

      const majorTickStep = tickInterval / zoom;
      const subTickStep = majorTickStep / subdivisions;

      const viewportSize = isVertical ? height : width;

      // Calculate zero point relative to canvas element
      // offset is centered, viewport is centered.
      // The canvas offset needs to be mapped to screen coordinates.

      const docDim = isVertical ? documentSize.h : documentSize.w;

      // Offset applied to document center
      const centerOffset = isVertical ? canvasOffset.y : canvasOffset.x;

      // Start of document in screen space:
      // Viewport center is at viewportSize / 2
      // Document is centered there, plus centerOffset.
      const docStartScreen = (viewportSize / 2) + centerOffset - (docDim * zoom / 2);

      // Start calculating ticks slightly before the visible area
      const startDocPos = -docStartScreen / zoom;
      const endDocPos = (viewportSize - docStartScreen) / zoom;

      const startMajor = Math.floor(startDocPos / majorTickStep) * majorTickStep;

      for (let pos = startMajor; pos <= endDocPos; pos += subTickStep) {
        // Document position scaled by 2 (matching the rest of the app)
        const screenPos = docStartScreen + (pos * zoom);

        if (screenPos < 0 || screenPos > viewportSize) continue;

        const isMajor = Math.abs(pos % majorTickStep) < 0.01;
        const tickLength = isMajor ? (isVertical ? width : height) : (isVertical ? width * 0.4 : height * 0.4);

        if (isVertical) {
          ctx.moveTo(width - tickLength, screenPos);
          ctx.lineTo(width, screenPos);
        } else {
          ctx.moveTo(screenPos, height - tickLength);
          ctx.lineTo(screenPos, height);
        }

        if (isMajor) {
          const valStr = Math.round(pos / unitMultiplier).toString();
          if (isVertical) {
             ctx.save();
             ctx.translate(width - 10, screenPos);
             ctx.rotate(-Math.PI / 2);
             ctx.fillText(valStr, 0, 0);
             ctx.restore();
          } else {
             ctx.fillText(valStr, screenPos + 2, 8);
          }
        }
      }
      ctx.stroke();
    };

    const handleResize = () => {
      if (topRulerRef.current && topRulerRef.current.parentElement) {
        topRulerRef.current.width = topRulerRef.current.parentElement.clientWidth;
        topRulerRef.current.height = 20;
        drawRuler(topRulerRef.current, false);
      }
      if (leftRulerRef.current && leftRulerRef.current.parentElement) {
        leftRulerRef.current.width = 20;
        leftRulerRef.current.height = leftRulerRef.current.parentElement.clientHeight;
        drawRuler(leftRulerRef.current, true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showRulers, rulerUnit, zoom, canvasOffset, documentSize]);

  if (!showRulers) return null;

  return (
    <>
      <div style={{ position: 'absolute', top: 0, left: 20, right: 0, height: 20, zIndex: 1000, pointerEvents: 'none' }}>
        <canvas ref={topRulerRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', top: 20, left: 0, bottom: 0, width: 20, zIndex: 1000, pointerEvents: 'none' }}>
        <canvas ref={leftRulerRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 20, height: 20, background: '#2c2c2c', zIndex: 1001, borderRight: '1px solid #555', borderBottom: '1px solid #555', boxSizing: 'border-box' }} />
    </>
  );
};

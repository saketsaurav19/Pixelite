import React, { useRef, useEffect } from 'react';
import { useStore } from '../../../store/useStore';
import Guides from '@scena/react-guides';

const getRulerSettings = (rulerUnit: 'px' | 'in' | 'cm', zoom: number) => {
  const unitMultiplier = rulerUnit === 'in' ? 96 : rulerUnit === 'cm' ? 37.795 : 1;
  const calculatedZoom = zoom * unitMultiplier;

  // We want the physical spacing (unit * calculatedZoom) on screen to be >= 50px
  let unit = 50;
  let segment = 10;

  if (rulerUnit === 'px') {
    const niceIntervals = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const bestInterval = niceIntervals.find(interval => interval * calculatedZoom >= 50) || 10000;
    unit = bestInterval;

    // Choose sensible segments
    if (unit <= 2) segment = unit;
    else if (unit === 5) segment = 5;
    else if (unit === 10) segment = 10;
    else if (unit === 20) segment = 4;
    else if (unit === 50) segment = 5;
    else if (unit === 100) segment = 10;
    else if (unit === 200) segment = 4;
    else if (unit === 500) segment = 5;
    else if (unit === 1000) segment = 10;
    else segment = 10;
  } else if (rulerUnit === 'in') {
    const niceIntervals = [0.0625, 0.125, 0.25, 0.5, 1, 2, 5, 10, 20, 50];
    const bestInterval = niceIntervals.find(interval => interval * calculatedZoom >= 50) || 50;
    unit = bestInterval;

    if (unit === 0.0625) segment = 4;
    else if (unit === 0.125) segment = 4;
    else if (unit === 0.25) segment = 4;
    else if (unit === 0.5) segment = 4;
    else if (unit === 1) segment = 8;
    else if (unit === 2) segment = 8;
    else segment = 10;
  } else { // cm
    const niceIntervals = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50];
    const bestInterval = niceIntervals.find(interval => interval * calculatedZoom >= 50) || 50;
    unit = bestInterval;

    if (unit === 0.1) segment = 10;
    else if (unit === 0.2) segment = 10;
    else if (unit === 0.5) segment = 5;
    else if (unit === 1) segment = 10;
    else if (unit === 2) segment = 10;
    else if (unit === 5) segment = 5;
    else segment = 10;
  }

  return { calculatedZoom, unit, segment };
};

export const GlobalRulers: React.FC = () => {
  const { showRulers, rulerUnit, zoom, canvasOffset, documentSize, showGuides } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const topGuidesRef = useRef<any>(null);
  const leftGuidesRef = useRef<any>(null);

  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  useEffect(() => {
    if (!showRulers) return;

    const handleResize = () => {
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          setViewportWidth(parent.clientWidth);
          setViewportHeight(parent.clientHeight);
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showRulers]);

  useEffect(() => {
    if (topGuidesRef.current) topGuidesRef.current.resize();
    if (leftGuidesRef.current) leftGuidesRef.current.resize();
  }, [zoom, canvasOffset, documentSize, rulerUnit, viewportWidth, viewportHeight]);

  if (!showRulers) return null;

  const { calculatedZoom, unit, segment } = getRulerSettings(rulerUnit, zoom);

  // docStartScreen calculation:
  // Relative to top ruler container, document starts at docStartScreenX - 20
  const docStartScreenX = (viewportWidth / 2) + (canvasOffset.x * zoom) - (documentSize.w * zoom / 2);
  const docStartScreenY = (viewportHeight / 2) + (canvasOffset.y * zoom) - (documentSize.h * zoom / 2);

  const horizontalScrollPos = -(docStartScreenX - 20) / calculatedZoom;
  const verticalScrollPos = -(docStartScreenY - 20) / calculatedZoom;

  const textFormat = (val: number) => {
    const rounded = Math.round(val * 10000) / 10000;
    return rounded.toString();
  };

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1000 }}>
      {/* Top Ruler Container */}
      <div style={{ position: 'absolute', top: 0, left: 40, right: 0, height: 40, pointerEvents: 'auto' }}>
        <Guides
          ref={topGuidesRef}
          type="horizontal"
          useResizeObserver={true}
          zoom={calculatedZoom}
          unit={unit}
          segment={segment}
          scrollPos={horizontalScrollPos}
          backgroundColor="#2c2c2c"
          lineColor="#555"
          textColor="#b0b0b0"
          showGuides={showGuides}
          textFormat={textFormat}
          displayDragPos={true}
          displayGuidePos={true}
          guideStyle={{ backgroundColor: '#00ffff' }}
          dragGuideStyle={{ backgroundColor: '#00ffff' }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Left Ruler Container */}
      <div style={{ position: 'absolute', top: 40, left: 0, bottom: 0, width: 40, pointerEvents: 'auto' }}>
        <Guides
          ref={leftGuidesRef}
          type="vertical"
          useResizeObserver={true}
          zoom={calculatedZoom}
          unit={unit}
          segment={segment}
          scrollPos={verticalScrollPos}
          backgroundColor="#2c2c2c"
          lineColor="#555"
          textColor="#b0b0b0"
          showGuides={showGuides}
          textFormat={textFormat}
          displayDragPos={true}
          displayGuidePos={true}
          guideStyle={{ backgroundColor: '#00ffff' }}
          dragGuideStyle={{ backgroundColor: '#00ffff' }}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Corner Intersection Box */}
      <div
        onClick={() => {
          const units: ('px' | 'in' | 'cm')[] = ['px', 'in', 'cm'];
          const nextIndex = (units.indexOf(rulerUnit) + 1) % units.length;
          useStore.getState().setRulerUnit(units[nextIndex]);
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 40,
          height: 40,
          background: '#2c2c2c',
          zIndex: 1001,
          borderRight: '1px solid #555',
          borderBottom: '1px solid #555',
          boxSizing: 'border-box',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#b0b0b0',
          fontSize: '11px',
          fontWeight: 'bold',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        title="Click to toggle ruler units"
      >
        {rulerUnit}
      </div>
    </div>
  );
};

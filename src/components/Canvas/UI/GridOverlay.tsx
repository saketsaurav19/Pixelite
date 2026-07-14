import React, { useMemo } from 'react';
import { useStore } from '../../../store/useStore';

export const GridOverlay: React.FC = () => {
  const showGrid = useStore((s) => s.showGrid);
  const gridColor = useStore((s) => s.gridColor);
  const gridType = useStore((s) => s.gridType);
  const gridGapX = useStore((s) => s.gridGapX);
  const gridGapY = useStore((s) => s.gridGapY);
  const gridSubdivision = useStore((s) => s.gridSubdivision);
  const documentSize = useStore((s) => s.documentSize);

  const lines = useMemo(() => {
    if (!showGrid) return { h: [] as number[], v: [] as number[], subH: [] as number[], subV: [] as number[] };

    const w = documentSize.w;
    const h = documentSize.h;
    const gapX = Math.max(gridGapX, 1);
    const gapY = Math.max(gridGapY, 1);
    const sub = Math.max(gridSubdivision, 1);

    const hLines: number[] = [];
    const vLines: number[] = [];
    const subHLines: number[] = [];
    const subVLines: number[] = [];

    const isHorizontal = gridType === 'horizontal' || gridType === 'square' || gridType === 'cross';
    const isVertical = gridType === 'vertical' || gridType === 'square' || gridType === 'cross';

    if (isHorizontal) {
      for (let y = 0; y <= h; y += gapY) {
        hLines.push(y);
      }
      if (gridSubdivision > 1) {
        for (let y = gapY / sub; y < h; y += gapY / sub) {
          const isMain = Math.abs(y % gapY) < 0.5;
          if (!isMain) {
            subHLines.push(y);
          }
        }
      }
    }

    if (isVertical) {
      for (let x = 0; x <= w; x += gapX) {
        vLines.push(x);
      }
      if (gridSubdivision > 1) {
        for (let x = gapX / sub; x < w; x += gapX / sub) {
          const isMain = Math.abs(x % gapX) < 0.5;
          if (!isMain) {
            subVLines.push(x);
          }
        }
      }
    }

    // For 'cross' type, only draw the main lines as crosshairs (just vertical + horizontal is fine)
    return { h: hLines, v: vLines, subH: subHLines, subV: subVLines };
  }, [showGrid, gridColor, gridType, gridGapX, gridGapY, gridSubdivision, documentSize.w, documentSize.h]);

  if (!showGrid) return null;

  const subColor = gridColor + '60';

  return (
    <svg
      className="grid-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {lines.subH.map((y, i) => (
        <line key={`sh-${i}`} x1={0} y1={y} x2={documentSize.w} y2={y} stroke={subColor} strokeWidth={0.5} />
      ))}
      {lines.subV.map((x, i) => (
        <line key={`sv-${i}`} x1={x} y1={0} x2={x} y2={documentSize.h} stroke={subColor} strokeWidth={0.5} />
      ))}
      {lines.h.map((y, i) => (
        <line key={`h-${i}`} x1={0} y1={y} x2={documentSize.w} y2={y} stroke={gridColor} strokeWidth={1} />
      ))}
      {lines.v.map((x, i) => (
        <line key={`v-${i}`} x1={x} y1={0} x2={x} y2={documentSize.h} stroke={gridColor} strokeWidth={1} />
      ))}
    </svg>
  );
};

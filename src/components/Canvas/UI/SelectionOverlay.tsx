import React from 'react';
import type { Point, Rect } from '../types';

interface SelectionOverlayProps {
  selectionRect: Rect | null;
  lassoPaths: Point[][];
  isInverseSelection: boolean;
  documentSize: { w: number, h: number };
  getSelectionPathData: () => string;
}

export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  selectionRect,
  lassoPaths,
  documentSize,
  getSelectionPathData
}) => {
  if (!selectionRect && lassoPaths.length === 0) return null;

  return (
    <svg
      className="lasso-svg"
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
        transform: 'none'
      }}
    >
      {/* Dim the unselected area */}
      <path
        d={`M 0,0 L 0,${documentSize.h} L ${documentSize.w},${documentSize.h} L ${documentSize.w},0 Z ` + getSelectionPathData()}
        fill="rgba(255, 255, 255, 0.45)"
        fillRule="evenodd"
        style={{ pointerEvents: 'none' }}
      />

      {/* Marching ants selection outline */}
      <g>
        <path
          d={getSelectionPathData()}
          fill="none"
          stroke="#fff"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d={getSelectionPathData()}
          fill="none"
          stroke="#000"
          strokeWidth="1"
          strokeDasharray="4 4"
          strokeLinejoin="round"
          className="marching-ants"
        />
      </g>
    </svg>
  );
};

import { useEffect } from 'react';
import type { Point, Rect } from '../types';

/**
 * Options for the useSelectionAnimation hook.
 */
interface SelectionAnimationOptions {
  lassoPaths: Point[][]; // Current freehand or polygonal lasso paths
  vectorPaths: any[]; // Current pen tool paths
  selectionRect: Rect | null; // Rectangular or elliptical selection marquee
  isInverseSelection: boolean; // True if 'Select Inverse' is active
  isInteracting: boolean; // True if the user is currently dragging/drawing
  activeTool: string; // The currently selected tool ID
  currentMousePos: Point | null; // Real-time mouse position for previews
  zoom: number; // Current canvas zoom level
  selectionShape: string; // 'rect' or 'ellipse' for the selection marquee
  activePathIndex: number | null; // The index of the vector path being edited
  penMode: string; // 'path' or 'shape' for the pen tool
  findBestEdgePoint: (x: number, y: number, radius: number) => Point; // Helper for magnetic lasso
}

/**
 * A custom hook that keeps the selection animation loop alive without mutating
 * a canvas element. Selection visuals are rendered by SelectionOverlay (SVG),
 * so this hook no longer draws to a hidden canvas.
 */
export const useSelectionAnimation = (options: SelectionAnimationOptions) => {
  const {
    lassoPaths, vectorPaths, selectionRect, isInverseSelection,
    isInteracting, activeTool, currentMousePos, zoom, selectionShape,
    activePathIndex, penMode, findBestEdgePoint
  } = options;

  useEffect(() => {
    // No-op retained so dependent useEffect wiring does not change.
    // All selection rendering is handled by SelectionOverlay / VectorOverlay.
    void lassoPaths;
    void vectorPaths;
    void selectionRect;
    void isInverseSelection;
    void isInteracting;
    void activeTool;
    void currentMousePos;
    void zoom;
    void selectionShape;
    void activePathIndex;
    void penMode;
    void findBestEdgePoint;
  }, [
    lassoPaths, vectorPaths, selectionRect, isInverseSelection,
    isInteracting, activeTool, currentMousePos, zoom, selectionShape,
    activePathIndex, penMode, findBestEdgePoint
  ]);
};

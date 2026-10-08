import type { ToolModule } from '../types';
import type { Point } from '../../components/Canvas/types';
import { findBestEdgePoint } from '../../utils/canvasUtils';
import { shouldClear, getSelectionOp } from './utils';
import { computeSelectionBooleanOp } from './selectionBooleanOps';

const finishLasso = ({
  lassoPaths,
  setLassoPaths,
  selectionMode,
  recordHistory,
  label
}: {
  lassoPaths: Point[][];
  setLassoPaths: (updater: any) => void;
  selectionMode: string;
  recordHistory: (label: string) => void;
  label: string;
}) => {
  const current = lassoPaths[lassoPaths.length - 1];
  if (!current || current.length < 3) return;

  const op = getSelectionOp(selectionMode, false, false);
  if (op === 'unite') {
    // For additive operations, just concatenate paths — no rasterization needed.
    // Rasterizing to a canvas and tracing boundary pixels produces a jagged,
    // unordered pixel path that renders as a thick zigzag black stroke.
    const existing = lassoPaths.slice(0, -1);
    setLassoPaths([...existing, current]);
  } else if (op === 'subtract') {
    const existing = lassoPaths.slice(0, -1);
    const result = computeSelectionBooleanOp(existing, current, 'subtract');
    setLassoPaths(result);
  } else if (op === 'intersect') {
    const existing = lassoPaths.slice(0, -1);
    const result = computeSelectionBooleanOp(existing, current, 'intersect');
    setLassoPaths(result);
  }
  recordHistory(label);
};

export const lassoTools: ToolModule[] = [
  {
    id: 'lasso',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) {
        setLassoPaths([]);
        setSelectionRect(null);
      } else if (selectionRect) {
        const r = selectionRect;
        const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
        setLassoPaths((prev: any) => [...prev, rectPath]);
        setSelectionRect(null);
      }
      setLassoPaths((prev: any) => [...prev, [coords]]);
      setIsInteracting(true);
    },
    move: ({ coords, setLassoPaths }) => {
      setLassoPaths((prev: any) => {
        const next = [...prev];
        next[next.length - 1] = [...next[next.length - 1], coords];
        return next;
      });
    },
    end: ({ lassoPaths, setLassoPaths, selectionMode, recordHistory, setIsInteracting }) => {
      finishLasso({
        lassoPaths,
        setLassoPaths,
        selectionMode,
        recordHistory,
        label: 'Lasso'
      });
      setIsInteracting(false);
    }
  },
  {
    id: 'polygonal_lasso',
    start: ({ coords, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, zoom, recordHistory, isInteracting: interacting, selectionRect }) => {
      let closed = false;
      setLassoPaths((prev: any) => {
        if (!interacting || prev.length === 0 || (shouldClear(selectionMode, isShift, isAlt) && prev[prev.length-1].length === 0)) {
          setIsInteracting(true);
          if (shouldClear(selectionMode, isShift, isAlt)) {
            setSelectionRect(null);
            return [[coords]];
          } else if (selectionRect) {
            const r = selectionRect;
            const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
            setSelectionRect(null);
            return [rectPath, [coords]];
          }
          return [[coords]];
        }

        const currentPath = prev[prev.length - 1];
        if (currentPath.length === 0) {
          const next = [...prev];
          next[next.length - 1] = [coords];
          return next;
        }

        const firstPoint = currentPath[0];
        const dist = Math.hypot(coords.x - firstPoint.x, coords.y - firstPoint.y);

        if (dist < 15 / (zoom || 1) && currentPath.length > 2) {
          closed = true;
          return prev;
        }

        const next = [...prev];
        next[next.length - 1] = [...next[next.length - 1], coords];
        return next;
      });

      if (closed) {
        recordHistory('Polygonal Lasso (Closed)');
      } else {
        recordHistory('Polygonal Lasso Point');
      }
    },
    doubleClick: ({ setIsInteracting, recordHistory }) => {
      setIsInteracting(false);
      recordHistory('Polygonal Lasso');
    },
    end: ({ lassoPaths, setLassoPaths, selectionMode, recordHistory, setIsInteracting }) => {
      finishLasso({
        lassoPaths,
        setLassoPaths,
        selectionMode,
        recordHistory,
        label: 'Polygonal Lasso'
      });
      setIsInteracting(false);
    }
  },
  {
    id: 'magnetic_lasso',
    start: ({ coords, ctx, setLassoPaths, setSelectionRect, setIsInteracting, selectionMode, isShift, isAlt, selectionRect }) => {
      if (shouldClear(selectionMode, isShift, isAlt)) {
        setLassoPaths([]);
        setSelectionRect(null);
      } else if (selectionRect) {
        const r = selectionRect;
        const rectPath = [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }];
        setLassoPaths((prev: any) => [...prev, rectPath]);
        setSelectionRect(null);
      }
      const bestPoint = findBestEdgePoint(ctx, coords.x, coords.y, 15);
      setLassoPaths((prev: any) => [...prev, [bestPoint]]);
      setIsInteracting(true);
    },
    move: ({ coords, ctx, zoom, setLassoPaths }) => {
      setLassoPaths((prev: any) => {
        const next = [...prev];
        const currentPath = next[next.length - 1];
        const lastPoint = currentPath[currentPath.length - 1];
        const dist = Math.hypot(coords.x - lastPoint.x, coords.y - lastPoint.y);
        if (dist > 10 / (zoom || 1)) {
          const bestPoint = findBestEdgePoint(ctx, coords.x, coords.y, 15);
          next[next.length - 1] = [...currentPath, bestPoint];
        }
        return next;
      });
    },
    doubleClick: ({ setIsInteracting, recordHistory }) => {
      setIsInteracting(false);
      recordHistory('Magnetic Lasso');
    },
    end: ({ lassoPaths, setLassoPaths, selectionMode, recordHistory, setIsInteracting }) => {
      finishLasso({
        lassoPaths,
        setLassoPaths,
        selectionMode,
        recordHistory,
        label: 'Magnetic Lasso'
      });
      setIsInteracting(false);
    }
  }
];

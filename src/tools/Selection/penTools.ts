/**
 * Pen / Curvature Pen / Free Pen / Add Anchor / Delete Anchor /
 * Convert Point / Path Select / Direct Select tool modules.
 *
 * These drive the vector path tools through the standard tool-module
 * interface. The `context` object is enriched in interactionHandlers.ts
 * with setVectorPaths / setActivePathIndex / setCurrentMousePos /
 * setSelectedPoint and the current vectorPaths/activePathIndex state.
 */

import type { ToolModule } from '../types';
import { useStore } from '../../store/useStore';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

/** Threshold (in canvas coords) for clicking near the first anchor to close a path. */
const CLOSE_THRESHOLD = 10;

/** Threshold for detecting an anchor-point click in Direct Select / Add Anchor. */
const HIT_THRESHOLD = 12;

/** Compute a synthesized "ghost" direction-handle position for a straight anchor.
 *  Mirrors the math used by VectorOverlay so the two stay in sync. */
const ghostHandlePosition = (
  p: { x: number; y: number },
  neighbour: { x: number; y: number }
): { x: number; y: number } | null => {
  const dx = neighbour.x - p.x;
  const dy = neighbour.y - p.y;
  const len = Math.hypot(dx, dy);
  if (len <= 0) return null;
  const hl = Math.min(len * 0.4, 60);
  return { x: p.x + (dx / len) * hl, y: p.y + (dy / len) * hl };
};

// ---------------------------------------------------------------------------
// Pen Tool
// ---------------------------------------------------------------------------

const penTool: ToolModule = {
  id: 'pen',

  start(context: any) {
    const { coords, vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;

    if (!coords || typeof coords.x !== 'number') return;
    if (!setVectorPaths || typeof setVectorPaths !== 'function') return;
    if (!setActivePathIndex || typeof setActivePathIndex !== 'function') return;

    const vp = Array.isArray(vectorPaths) ? vectorPaths : [];
    const api = (activePathIndex != null && vp[activePathIndex]) ? activePathIndex : null;

    if (api !== null) {
      const path = vp[api];
      const points = path.points;
      const first = points[0];

      // Close path: click near the first anchor.
      if (first && !path.closed && distance(coords, first) < CLOSE_THRESHOLD) {
        const updated = [...vp];
        updated[api] = { ...updated[api], closed: true };
        setVectorPaths(updated);
        setActivePathIndex(null);
        useStore.getState().recordHistory('Close Path');
        return;
      }

      // On smooth paths, check handles first so they can be selected before anchors.
      if (path.smooth && points.length > 0) {
        for (let ptIdx = 0; ptIdx < points.length; ptIdx++) {
          const p = points[ptIdx];
          if (p.handleOut && distance(coords, p.handleOut) < 10) {
            setActivePathIndex(api);
            (context as any)._selectedPointForPen = { pathIdx: api, pointIdx: ptIdx, handle: 'out' };
            return;
          }
          if (p.handleIn && distance(coords, p.handleIn) < 10) {
            setActivePathIndex(api);
            (context as any)._selectedPointForPen = { pathIdx: api, pointIdx: ptIdx, handle: 'in' };
            return;
          }
        }
      }

      // Check if an existing anchor was clicked.
      for (let i = points.length - 1; i >= 0; i--) {
        if (distance(coords, points[i]) < HIT_THRESHOLD) {
          setActivePathIndex(api);
          (context as any)._selectedPointForPen = { pathIdx: api, pointIdx: i, handle: null };
          return;
        }
      }

      // Otherwise add a new straight corner point, matching Photopea's Pen.
      const updated = [...vp];
      updated[api] = { ...updated[api], points: [...points, { x: coords.x, y: coords.y }] };
      setVectorPaths(updated);
      setActivePathIndex(api);
      return;
    }

    // No active path — start a new one.
    const newPath = {
      id: nanoid(),
      points: [{ x: coords.x, y: coords.y }],
      closed: false,
      smooth: false,
    };
    setVectorPaths([...vp, newPath]);
    setActivePathIndex(vp.length);
  },

  move(context: any) {
    const { coords, vectorPaths, activePathIndex } = context;
    if (!coords || !vectorPaths || activePathIndex == null) return;
    const path = vectorPaths[activePathIndex];
    if (!path) return;

    const selPoint = (context as any)._selectedPointForPen;
    if (!selPoint || selPoint.pathIdx !== activePathIndex || selPoint.pointIdx == null) return;

    const ptIdx = selPoint.pointIdx;
    const pt = path.points[ptIdx];
    if (!pt) return;

    const dx = coords.x - pt.x;
    const dy = coords.y - pt.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return;

    const handleLen = Math.min(dist * 0.4, 60);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);

    const updated = [...vectorPaths];
    const newPoints = [...path.points];
    const newPt = { ...pt };

    if (selPoint.handle === 'out' || selPoint.handle === 'in') {
      const handleKey = selPoint.handle === 'out' ? 'handleOut' : 'handleIn';
      newPt[handleKey] = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
      const oppositeKey = selPoint.handle === 'out' ? 'handleIn' : 'handleOut';
      newPt[oppositeKey] = { x: 2 * pt.x - (pt.x + nx * handleLen), y: 2 * pt.y - (pt.y + ny * handleLen) };
    } else {
      // Drag from anchor creates a smooth point with mirrored handles.
      newPt.handleOut = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
      newPt.handleIn = { x: pt.x - nx * handleLen, y: pt.y - ny * handleLen };
    }

    newPoints[ptIdx] = newPt;
    updated[activePathIndex] = { ...path, points: newPoints, smooth: true };
    (context as any).setVectorPaths?.(updated);
  },

  end(context: any) {
    const { setSelectedPoint } = context;
    const sel = (context as any)._selectedPointForPen;
    if (sel && setSelectedPoint) {
      setSelectedPoint(sel);
    }
    delete (context as any)._penDragStart;
    delete (context as any)._selectedPointForPen;
    delete (context as any)._selectedPointForFreePen;
  },

  doubleClick(context: any) {
    const { vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;
    if (activePathIndex != null && vectorPaths?.[activePathIndex] && !vectorPaths[activePathIndex].closed) {
      const updated = [...vectorPaths];
      updated[activePathIndex] = { ...updated[activePathIndex], closed: true };
      setVectorPaths(updated);
      setActivePathIndex(null);
      useStore.getState().recordHistory('Close Path');
    }
  },
};

// ---------------------------------------------------------------------------
// Curvature Pen Tool (delegates to pen)
// ---------------------------------------------------------------------------

const curvaturePenTool: ToolModule = {
  id: 'curvature_pen',

  start(context: any) {
    const { coords, vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;
    if (!coords || !setVectorPaths || !setActivePathIndex) return;

    const vp = Array.isArray(vectorPaths) ? vectorPaths : [];
    const api = (activePathIndex != null && vp[activePathIndex]) ? activePathIndex : null;

    if (api !== null) {
      const path = vp[api];
      const first = path.points[0];
      if (first && distance(coords, first) < CLOSE_THRESHOLD) {
        const updated = [...vp];
        updated[api] = { ...updated[api], closed: true, smooth: true };
        setVectorPaths(updated);
        setActivePathIndex(null);
        useStore.getState().recordHistory('Close Path');
        return;
      }
      // Add point with bezier handles for smooth curves
      const points = [...path.points];
      const prev = points[points.length - 1];
      const newPoint: any = { x: coords.x, y: coords.y };
      if (prev && points.length > 0) {
        const dx = coords.x - prev.x;
        const dy = coords.y - prev.y;
        const dist = Math.hypot(dx, dy);
        const handleLen = Math.min(dist * 0.4, 60);
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        // Mirror handles for smooth curve continuity
        newPoint.handleIn = { x: coords.x - nx * handleLen, y: coords.y - ny * handleLen };
        newPoint.handleOut = { x: coords.x + nx * handleLen, y: coords.y + ny * handleLen };
        // Give the previous point handles too if it doesn't have any
        if (prev.handleOut === undefined) {
          prev.handleOut = { x: prev.x + nx * handleLen, y: prev.y + ny * handleLen };
          prev.handleIn = { x: prev.x - nx * handleLen, y: prev.y - ny * handleLen };
        }
      }
      const updated = [...vp];
      updated[api] = { ...updated[api], points: [...points, newPoint], smooth: true };
      setVectorPaths(updated);
      setActivePathIndex(api);
      return;
    }

    // No active path - start a new smooth path
    const newPath = {
      id: nanoid(),
      points: [{ x: coords.x, y: coords.y }],
      closed: false,
      smooth: true,
    };
    setVectorPaths([...vp, newPath]);
    setActivePathIndex(vp.length);
  },

  move(_context: any) {
    // no-op
  },

  end() {},

  doubleClick(context: any) {
    const { vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;
    if (activePathIndex != null && vectorPaths?.[activePathIndex] && !vectorPaths[activePathIndex].closed) {
      const updated = [...vectorPaths];
      updated[activePathIndex] = { ...updated[activePathIndex], closed: true, smooth: true };
      setVectorPaths(updated);
      setActivePathIndex(null);
      useStore.getState().recordHistory('Close Path');
    }
  },
};

// ---------------------------------------------------------------------------
// Free Pen Tool
// ---------------------------------------------------------------------------

const freePenTool: ToolModule = {
  id: 'free_pen',

  start(context: any) {
    const { coords, setVectorPaths, setActivePathIndex, setSelectedPoint, ctx, brushColor, strokeWidth } = context;
    if (!coords || !setVectorPaths) return;

    const storeState = useStore.getState();
    const vp = Array.isArray(storeState.vectorPaths) ? storeState.vectorPaths : [];
    const activePathIndex = storeState.activePathIndex;
    const last = vp.length > 0 ? vp[vp.length - 1] : null;
    const onLastPath = last && activePathIndex === vp.length - 1;

    // Only honor handle drags that this tool itself started.
    const localSelection = (context as any)._selectedPointForFreePen;
    if (
      onLastPath &&
      (context as any)._freePenDrag &&
      localSelection?.pathIdx === activePathIndex &&
      localSelection?.pointIdx != null
    ) {
      const ptIdx = localSelection.pointIdx;
      const pt = last.points[ptIdx];
      if (pt) {
        const dx = coords.x - pt.x;
        const dy = coords.y - pt.y;
        if (Math.hypot(dx, dy) > 2) {
          return;
        }
      }
    }

    const penSelection = (context as any)._selectedPointForPen;
    if (
      onLastPath &&
      penSelection?.pathIdx === activePathIndex &&
      penSelection?.pointIdx != null
    ) {
      (context as any)._selectedPointForFreePen = { ...penSelection };
      (context as any)._freePenDrag = true;
      return;
    }

    if (onLastPath && last.points.length > 0) {
      for (let i = last.points.length - 1; i >= 0; i--) {
        const p = last.points[i];
        const handleOut = p.handleOut || (() => {
          const next = last.points[i + 1];
          if (!next) return null;
          const dx = next.x - p.x;
          const dy = next.y - p.y;
          const d = Math.hypot(dx, dy) || 1;
          const handleLen = Math.min(Math.max(d, 8), 60);
          return { x: p.x + (dx / d) * handleLen, y: p.y + (dy / d) * handleLen };
        })();
        const handleIn = p.handleIn || (() => {
          const prev = last.points[i - 1];
          if (!prev) return null;
          const dx = p.x - prev.x;
          const dy = p.y - prev.y;
          const d = Math.hypot(dx, dy) || 1;
          const handleLen = Math.min(Math.max(d, 8), 60);
          return { x: p.x - (dx / d) * handleLen, y: p.y - (dy / d) * handleLen };
        })();
        if (handleOut && distance(coords, handleOut) < 10) {
          setActivePathIndex(activePathIndex);
          (context as any)._selectedPointForFreePen = { pathIdx: activePathIndex, pointIdx: i, handle: 'out' };
          (context as any)._freePenDrag = true;
          return;
        }
        if (handleIn && distance(coords, handleIn) < 10) {
          setActivePathIndex(activePathIndex);
          (context as any)._selectedPointForFreePen = { pathIdx: activePathIndex, pointIdx: i, handle: 'in' };
          (context as any)._freePenDrag = true;
          return;
        }
      }

      // Clicking near an existing anchor selects it for handle editing.
      for (let i = last.points.length - 1; i >= 0; i--) {
        if (distance(coords, last.points[i]) < HIT_THRESHOLD) {
          setActivePathIndex(activePathIndex);
          const pts = last.points.map((p: any) => ({ ...p }));
          const prev = pts[i - 1];
          const next = pts[i + 1];
          if (!pts[i].handleIn || !pts[i].handleOut) {
            let handleLen = 20;
            if (prev && next) {
              handleLen = Math.min(Math.max(Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y), Math.hypot(next.x - pts[i].x, next.y - pts[i].y)) * 0.4, 60);
            } else if (prev) {
              handleLen = Math.min(Math.hypot(pts[i].x - prev.x, pts[i].y - prev.y) * 0.4, 60);
            } else if (next) {
              handleLen = Math.min(Math.hypot(next.x - pts[i].x, next.y - pts[i].y) * 0.4, 60);
            }
            handleLen = Math.max(handleLen, 8);
            if (prev) {
              const dx = pts[i].x - prev.x;
              const dy = pts[i].y - prev.y;
              const d = Math.hypot(dx, dy) || 1;
              pts[i].handleIn = { x: pts[i].x - (dx / d) * handleLen, y: pts[i].y - (dy / d) * handleLen };
            }
            if (next) {
              const dx = next.x - pts[i].x;
              const dy = next.y - pts[i].y;
              const d = Math.hypot(dx, dy) || 1;
              pts[i].handleOut = { x: pts[i].x + (dx / d) * handleLen, y: pts[i].y + (dy / d) * handleLen };
            }
            const updated = [...vp];
            updated[updated.length - 1] = { ...last, points: pts, smooth: true };
            setVectorPaths(updated);
          }
          if (setSelectedPoint) setSelectedPoint({ pathIdx: activePathIndex, pointIdx: i });
          return;
        }
      }

      // Clicked on the path, but not on an anchor/handle: keep the current path active.
      setActivePathIndex(activePathIndex);
      return;
    }

    const newPath = { id: nanoid(), points: [{ x: coords.x, y: coords.y }], closed: false, smooth: false };
    setVectorPaths([...vp, newPath]);
    setActivePathIndex(vp.length);
    if (setSelectedPoint) setSelectedPoint(null);

    // Draw a solid dot so the initial click is visible immediately.
    if (ctx) {
      ctx.save();
      ctx.fillStyle = brushColor || '#000000';
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, (strokeWidth || 1) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },

  move(context: any) {
    const { coords, lastPoint, ctx } = context;
    if (!lastPoint || !coords || !ctx) return;

    const storeState = useStore.getState();
    const vectorPaths = storeState.vectorPaths ?? [];
    const activePathIndex = storeState.activePathIndex;
    if (!vectorPaths?.length || activePathIndex == null || activePathIndex !== vectorPaths.length - 1) return;
    const last = vectorPaths[vectorPaths.length - 1];
    if (!last) return;

    const selectedPoint = (context as any)._selectedPointForFreePen;
    const isDraggingHandle = (context as any)._freePenDrag || (selectedPoint?.pathIdx === activePathIndex && selectedPoint?.pointIdx != null);

    // Drag a selected anchor/handle to reshape the freehand path.
    if (isDraggingHandle && selectedPoint?.pathIdx === activePathIndex) {
      const ptIdx = selectedPoint.pointIdx;
      const pt = last.points[ptIdx];
      if (!pt) return;

      const dx = coords.x - pt.x;
      const dy = coords.y - pt.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) return;

      const handleLen = Math.min(dist * 0.4, 60);
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);

      const updated = [...vectorPaths];
      const newPoints = [...last.points];
      const newPt = { ...pt };

      if (selectedPoint.handle === 'out') {
        newPt.handleOut = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
        newPt.handleIn = { x: 2 * pt.x - (pt.x + nx * handleLen), y: 2 * pt.y - (pt.y + ny * handleLen) };
      } else if (selectedPoint.handle === 'in') {
        newPt.handleIn = { x: pt.x - nx * handleLen, y: pt.y - ny * handleLen };
        newPt.handleOut = { x: 2 * pt.x - (pt.x - nx * handleLen), y: 2 * pt.y - (pt.y - ny * handleLen) };
      } else {
        newPt.handleOut = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
        newPt.handleIn = { x: pt.x - nx * handleLen, y: pt.y - ny * handleLen };
      }

      newPoints[ptIdx] = newPt;
      updated[updated.length - 1] = { ...last, points: newPoints, smooth: true };
      storeState.setVectorPaths(updated);
      return;
    }

    // Continue freehand drawing: update path points; rendering is handled by the vector overlay.
    const newPoints = [...last.points, { x: coords.x, y: coords.y }];
    const updated = [...vectorPaths];
    updated[updated.length - 1] = { ...last, points: newPoints };
    storeState.setVectorPaths(updated);
  },

  end(context: any) {
    const storeState = useStore.getState();
    const vectorPaths = storeState.vectorPaths ?? [];
    const setVectorPaths = storeState.setVectorPaths;
    const setActivePathIndex = storeState.setActivePathIndex;
    const setSelectedPoint = storeState.setSelectedPoint;

    if (!vectorPaths?.length || !setVectorPaths) return;
    const last = vectorPaths[vectorPaths.length - 1];
    if (!last || last.points.length < 2) return;

    const simplified = simplifyPath(last.points, 2.5);
    const withHandles = addBezierHandles(simplified.length >= 2 ? simplified : last.points);
    const updated = [...vectorPaths];
    updated[updated.length - 1] = { ...last, points: withHandles, smooth: true };
    setVectorPaths(updated);

    if (setActivePathIndex) setActivePathIndex(updated.length - 1);
    if (setSelectedPoint) {
      setSelectedPoint({ pathIdx: updated.length - 1, pointIdx: withHandles.length - 1 });
    }

    delete (context as any)._freePenDrag;
    delete (context as any)._selectedPointForFreePen;
  },

  doubleClick() {},
};

function simplifyPath(points: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPath(points.slice(0, maxIdx + 1), tolerance);
    const right = simplifyPath(points.slice(maxIdx), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

function perpendicularDistance(point: { x: number; y: number }, lineStart: { x: number; y: number }, lineEnd: { x: number; y: number }): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq;
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(point.x - projX, point.y - projY);
}

// ---------------------------------------------------------------------------
// Add Anchor Point Tool
// ---------------------------------------------------------------------------

const addAnchorTool: ToolModule = {
  id: 'add_anchor',

  start(context: any) {
    const { coords, vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;
    if (!coords || !setVectorPaths) return;

    let bestPathIdx = activePathIndex;
    let bestSegIdx = -1;
    let bestDist = Infinity;

    vectorPaths?.forEach((path: any, pIdx: number) => {
      const pts = path.points;
      for (let i = 0; i < (path.closed ? pts.length : pts.length - 1); i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const d = pointToSegmentDist(coords, a, b);
        if (d < bestDist) {
          bestDist = d;
          bestPathIdx = pIdx;
          bestSegIdx = i;
        }
      }
    });

    if (bestPathIdx != null && bestSegIdx >= 0 && bestDist < 30 && vectorPaths[bestPathIdx]) {
      const path = vectorPaths[bestPathIdx];
      const prev = path.points[bestSegIdx];
      const next = path.points[(bestSegIdx + 2) % path.points.length];
      const newPoint: any = { x: coords.x, y: coords.y };
      if (path.smooth) {
        const handleLen = prev && next
          ? Math.min(Math.max(Math.hypot(coords.x - prev.x, coords.y - prev.y), Math.hypot(next.x - coords.x, next.y - coords.y)) * 0.4, 60)
          : 20;
        const handleIn = prev
          ? (() => {
              const dx = coords.x - prev.x;
              const dy = coords.y - prev.y;
              const d = Math.hypot(dx, dy) || 1;
              return { x: coords.x - (dx / d) * handleLen, y: coords.y - (dy / d) * handleLen };
            })()
          : { x: coords.x - handleLen, y: coords.y };
        const handleOut = next
          ? (() => {
              const dx = next.x - coords.x;
              const dy = next.y - coords.y;
              const d = Math.hypot(dx, dy) || 1;
              return { x: coords.x + (dx / d) * handleLen, y: coords.y + (dy / d) * handleLen };
            })()
          : { x: coords.x + handleLen, y: coords.y };
        newPoint.handleIn = handleIn;
        newPoint.handleOut = handleOut;
      }
      const newPoints = [...path.points];
      newPoints.splice(bestSegIdx + 1, 0, newPoint);
      const updated = [...vectorPaths];
      updated[bestPathIdx] = { ...path, points: newPoints };
      setVectorPaths(updated);
      setActivePathIndex(bestPathIdx);
      useStore.getState().recordHistory('Add Anchor Point');
    }
  },

  move() {},
  end() {},
  doubleClick() {},
};

// ---------------------------------------------------------------------------
// Delete Anchor Point Tool
// ---------------------------------------------------------------------------

const deleteAnchorTool: ToolModule = {
  id: 'delete_anchor',

  start(context: any) {
    const { coords, vectorPaths, activePathIndex, setVectorPaths, setActivePathIndex } = context;
    if (!coords || !setVectorPaths) return;

    for (let pIdx = vectorPaths.length - 1; pIdx >= 0; pIdx--) {
      const path = vectorPaths[pIdx];
      for (let ptIdx = path.points.length - 1; ptIdx >= 0; ptIdx--) {
        if (distance(coords, path.points[ptIdx]) < HIT_THRESHOLD) {
          if (path.points.length <= 2) {
            const updated = vectorPaths.filter((_: any, i: number) => i !== pIdx);
            setVectorPaths(updated);
            if (activePathIndex === pIdx) setActivePathIndex(updated.length > 0 ? 0 : null);
            else if (activePathIndex != null && activePathIndex > pIdx) setActivePathIndex(activePathIndex - 1);
          } else {
            const newPoints = path.points.filter((_: any, i: number) => i !== ptIdx);
            const updated = [...vectorPaths];
            updated[pIdx] = { ...path, points: newPoints };
            setVectorPaths(updated);
          }
          useStore.getState().recordHistory('Delete Anchor Point');
          return;
        }
      }
    }
  },

  move() {},
  end() {},
  doubleClick() {},
};

// ---------------------------------------------------------------------------
// Convert Point Tool
// ---------------------------------------------------------------------------

const convertPointTool: ToolModule = {
  id: 'convert_point',

  start(context: any) {
    const { coords, vectorPaths, setVectorPaths, setSelectedPoint, setActivePathIndex } = context;
    if (!coords || !setVectorPaths) return;

    const STRAIGHTEN_FACTOR = 0.4;

    for (let pIdx = vectorPaths.length - 1; pIdx >= 0; pIdx--) {
      const path = vectorPaths[pIdx];
      const points = path.points;
      for (let ptIdx = points.length - 1; ptIdx >= 0; ptIdx--) {
        if (distance(coords, points[ptIdx]) < HIT_THRESHOLD) {
          const updated = [...vectorPaths];
          const newPath = { ...path, points: points.map((p: any) => ({ ...p })) };
          const pt = newPath.points[ptIdx];

          if (pt.handleIn || pt.handleOut) {
            // Progressive straightening: reduce handle length toward anchor
            const shrink = (handle: { x: number; y: number } | undefined) => {
              if (!handle) return undefined;
              const dx = handle.x - pt.x;
              const dy = handle.y - pt.y;
              const newLen = Math.hypot(dx, dy) * (1 - STRAIGHTEN_FACTOR);
              if (newLen < 1) return undefined;
              const len = Math.hypot(dx, dy);
              return len > 0 ? { x: pt.x + (dx / len) * newLen, y: pt.y + (dy / len) * newLen } : handle;
            };
            pt.handleIn = shrink(pt.handleIn);
            pt.handleOut = shrink(pt.handleOut);
          } else {
            // Corner → smooth: restore handles from adjacent points so direction
            // handles (bezier control points) appear on the straight-line point.
            const len = newPath.points.length;
            const next = newPath.points[(ptIdx + 1) % len];
            const prev = newPath.points[(ptIdx - 1 + len) % len];
            const dxOut = next.x - pt.x;
            const dyOut = next.y - pt.y;
            const distOut = Math.hypot(dxOut, dyOut);
            const handleLen = Math.min(distOut * 0.4, 60) || 20;
            const nx = dxOut / (distOut || 1);
            const ny = dyOut / (distOut || 1);
            pt.handleOut = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
            // Mirror an incoming handle from the previous segment for a smooth join.
            const dxIn = prev.x - pt.x;
            const dyIn = prev.y - pt.y;
            const distIn = Math.hypot(dxIn, dyIn);
            const inLen = Math.min(distIn * 0.4, 60) || 20;
            const inx = dxIn / (distIn || 1);
            const iny = dyIn / (distIn || 1);
            pt.handleIn = { x: pt.x + inx * inLen, y: pt.y + iny * inLen };
          }

          updated[pIdx] = newPath;
          setVectorPaths(updated);
          // Remember the point so a subsequent drag (in move) can bend the
          // segment into a curve by pulling the newly-created handles. Set the
          // active path too so VectorOverlay renders the direction handles.
          if (setActivePathIndex) setActivePathIndex(pIdx);
          if (setSelectedPoint) setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx });
          useStore.getState().recordHistory('Convert Point');
          return;
        }
      }
    }
  },

  move(context: any) {
    const { coords, lastPoint, selectedPoint, vectorPaths, setVectorPaths } = context;
    if (!lastPoint || !coords || !selectedPoint || !setVectorPaths) return;
    const path = vectorPaths?.[selectedPoint.pathIdx];
    if (!path) return;

    const dx = coords.x - lastPoint.x;
    const dy = coords.y - lastPoint.y;
    if (Math.hypot(dx, dy) < 0.01) return;

    const updated = [...vectorPaths];
    const newPoints = [...path.points];
    const pt = { ...newPoints[selectedPoint.pointIdx] };

    // Grab the handle whose endpoint is nearest the cursor so the user can bend
    // whichever side of the segment they are dragging.
    let grab: 'in' | 'out';
    if (pt.handleOut && pt.handleIn) {
      grab = distance(coords, pt.handleOut) <= distance(coords, pt.handleIn) ? 'out' : 'in';
    } else if (pt.handleOut) {
      grab = 'out';
    } else if (pt.handleIn) {
      grab = 'in';
    } else {
      // Fallback: no handles yet — create a mirrored pair toward the cursor.
      const len = Math.hypot(coords.x - pt.x, coords.y - pt.y) || 1;
      const nx = (coords.x - pt.x) / len;
      const ny = (coords.y - pt.y) / len;
      const handleLen = Math.min(len * 0.4, 60);
      pt.handleOut = { x: pt.x + nx * handleLen, y: pt.y + ny * handleLen };
      pt.handleIn = { x: pt.x - nx * handleLen, y: pt.y - ny * handleLen };
      grab = 'out';
    }

    const handleKey = grab === 'out' ? 'handleOut' : 'handleIn';
    const current = pt[handleKey] || { x: pt.x, y: pt.y };
    const newHandle = { x: current.x + dx, y: current.y + dy };
    pt[handleKey] = newHandle;
    // Mirror the opposite handle across the anchor to keep the curve smooth.
    const oppositeKey = grab === 'out' ? 'handleIn' : 'handleOut';
    pt[oppositeKey] = { x: 2 * pt.x - newHandle.x, y: 2 * pt.y - newHandle.y };

    newPoints[selectedPoint.pointIdx] = pt;
    updated[selectedPoint.pathIdx] = { ...path, points: newPoints, smooth: true };
    setVectorPaths(updated);
  },

  end(context: any) {
    const { setSelectedPoint } = context;
    if (setSelectedPoint) setSelectedPoint(null);
  },

  doubleClick() {},
};

// ---------------------------------------------------------------------------
// Path Select Tool
// ---------------------------------------------------------------------------

const pathSelectTool: ToolModule = {
  id: 'path_select',

  start(context: any) {
    const { coords, vectorPaths, setActivePathIndex } = context;
    if (!coords || !setActivePathIndex) return;

    for (let pIdx = vectorPaths.length - 1; pIdx >= 0; pIdx--) {
      if (isPointInPath(coords, vectorPaths[pIdx])) {
        setActivePathIndex(pIdx);
        return;
      }
    }
    setActivePathIndex(null);
  },

  move() {},
  end() {},
  doubleClick() {},
};

// ---------------------------------------------------------------------------
// Direct Select Tool
// ---------------------------------------------------------------------------

const directSelectTool: ToolModule = {
  id: 'direct_select',

  start(context: any) {
    const { coords, vectorPaths, activePathIndex, setActivePathIndex, setSelectedPoint, setVectorPaths } = context;
    if (!coords || !setActivePathIndex || !setSelectedPoint) return;

    if (activePathIndex != null && vectorPaths?.[activePathIndex]) {
      const path = vectorPaths[activePathIndex];
      // Check handles first (works on smooth AND straight anchors with handles)
      for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
        const p = path.points[ptIdx];
        if (p.handleOut && distance(coords, p.handleOut) < 10) {
          setActivePathIndex(activePathIndex);
          setSelectedPoint({ pathIdx: activePathIndex, pointIdx: ptIdx, handle: 'out' });
          return;
        }
        if (p.handleIn && distance(coords, p.handleIn) < 10) {
          setActivePathIndex(activePathIndex);
          setSelectedPoint({ pathIdx: activePathIndex, pointIdx: ptIdx, handle: 'in' });
          return;
        }
      }
      // Fall back to ghost-handle positions for straight anchors so the user
      // can grab a handle wherever VectorOverlay shows one.
      for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
        const p = path.points[ptIdx];
        if (!p.handleOut) {
          const next = path.points[(ptIdx + 1) % path.points.length];
          const ghost = ghostHandlePosition(p, next);
          if (ghost && distance(coords, ghost) < 10) {
            // Promote the ghost to a real handle so dragging persists it.
            const updated = [...vectorPaths];
            const newPoints = path.points.map((pp: any, i: number) => i === ptIdx ? { ...pp, handleOut: ghost } : pp);
            updated[activePathIndex] = { ...path, points: newPoints, smooth: true };
            setVectorPaths(updated);
            setSelectedPoint({ pathIdx: activePathIndex, pointIdx: ptIdx, handle: 'out' });
            return;
          }
        }
        if (!p.handleIn) {
          const prev = path.points[(ptIdx - 1 + path.points.length) % path.points.length];
          const ghost = ghostHandlePosition(p, prev);
          if (ghost && distance(coords, ghost) < 10) {
            const updated = [...vectorPaths];
            const newPoints = path.points.map((pp: any, i: number) => i === ptIdx ? { ...pp, handleIn: ghost } : pp);
            updated[activePathIndex] = { ...path, points: newPoints, smooth: true };
            setVectorPaths(updated);
            setSelectedPoint({ pathIdx: activePathIndex, pointIdx: ptIdx, handle: 'in' });
            return;
          }
        }
      }
      for (let ptIdx = path.points.length - 1; ptIdx >= 0; ptIdx--) {
        if (distance(coords, path.points[ptIdx]) < HIT_THRESHOLD) {
          setSelectedPoint({ pathIdx: activePathIndex, pointIdx: ptIdx });
          return;
        }
      }
    }

    for (let pIdx = vectorPaths.length - 1; pIdx >= 0; pIdx--) {
      const path = vectorPaths[pIdx];
      for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
        const p = path.points[ptIdx];
        if (p.handleOut && distance(coords, p.handleOut) < 10) {
          setActivePathIndex(pIdx);
          setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx, handle: 'out' });
          return;
        }
        if (p.handleIn && distance(coords, p.handleIn) < 10) {
          setActivePathIndex(pIdx);
          setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx, handle: 'in' });
          return;
        }
      }
      // Ghost-handle fallback across all paths.
      for (let ptIdx = 0; ptIdx < path.points.length; ptIdx++) {
        const p = path.points[ptIdx];
        if (!p.handleOut) {
          const next = path.points[(ptIdx + 1) % path.points.length];
          const ghost = ghostHandlePosition(p, next);
          if (ghost && distance(coords, ghost) < 10) {
            const updated = [...vectorPaths];
            const newPoints = path.points.map((pp: any, i: number) => i === ptIdx ? { ...pp, handleOut: ghost } : pp);
            updated[pIdx] = { ...path, points: newPoints, smooth: true };
            setVectorPaths(updated);
            setActivePathIndex(pIdx);
            setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx, handle: 'out' });
            return;
          }
        }
        if (!p.handleIn) {
          const prev = path.points[(ptIdx - 1 + path.points.length) % path.points.length];
          const ghost = ghostHandlePosition(p, prev);
          if (ghost && distance(coords, ghost) < 10) {
            const updated = [...vectorPaths];
            const newPoints = path.points.map((pp: any, i: number) => i === ptIdx ? { ...pp, handleIn: ghost } : pp);
            updated[pIdx] = { ...path, points: newPoints, smooth: true };
            setVectorPaths(updated);
            setActivePathIndex(pIdx);
            setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx, handle: 'in' });
            return;
          }
        }
      }
      for (let ptIdx = path.points.length - 1; ptIdx >= 0; ptIdx--) {
        if (distance(coords, path.points[ptIdx]) < HIT_THRESHOLD) {
          setActivePathIndex(pIdx);
          setSelectedPoint({ pathIdx: pIdx, pointIdx: ptIdx });
          return;
        }
      }
    }

    setSelectedPoint(null);
  },

  move(context: any) {
    const { coords, lastPoint, selectedPoint, vectorPaths, setVectorPaths } = context;
    if (!lastPoint || !coords || !selectedPoint || !setVectorPaths || !vectorPaths?.[selectedPoint.pathIdx]) return;

    const dx = coords.x - lastPoint.x;
    const dy = coords.y - lastPoint.y;
    const updated = [...vectorPaths];
    const path = updated[selectedPoint.pathIdx];
    const newPoints = [...path.points];
    const pt = { ...newPoints[selectedPoint.pointIdx] };

    if (selectedPoint.handle === 'out' || selectedPoint.handle === 'in') {
      const handleKey = selectedPoint.handle === 'out' ? 'handleOut' : 'handleIn';
      const currentHandle = pt[handleKey] || { x: pt.x, y: pt.y };
      const newHandle = {
        x: currentHandle.x + dx,
        y: currentHandle.y + dy,
      };
      pt[handleKey] = newHandle;
      // Mirror opposite handle across the anchor to maintain smooth curve
      const oppositeKey = selectedPoint.handle === 'out' ? 'handleIn' : 'handleOut';
      pt[oppositeKey] = {
        x: 2 * pt.x - newHandle.x,
        y: 2 * pt.y - newHandle.y,
      };
    } else {
      // Move anchor and both handles together
      pt.x += dx;
      pt.y += dy;
      if (pt.handleIn) {
        pt.handleIn = { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy };
      }
      if (pt.handleOut) {
        pt.handleOut = { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy };
      }
    }

    newPoints[selectedPoint.pointIdx] = pt;
    updated[selectedPoint.pathIdx] = { ...path, points: newPoints };
    setVectorPaths(updated);
  },

  end() {},
  doubleClick() {},
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function pointToSegmentDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return distance(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

function isPointInPath(p: { x: number; y: number }, path: { points: { x: number; y: number }[]; closed: boolean }): boolean {
  const pts = path.points;
  if (pts.length < 2) return false;
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if ((yi > p.y) !== (yj > p.y) && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function addBezierHandles(points: { x: number; y: number }[]): { x: number; y: number; handleIn: { x: number; y: number }; handleOut: { x: number; y: number } }[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const pt = points[0];
    return [{ ...pt, handleIn: { x: pt.x - 20, y: pt.y }, handleOut: { x: pt.x + 20, y: pt.y } }];
  }

  const len = points.length;
  const handleLens = points.map((pt, i) => {
    const prev = points[(i - 1 + len) % len];
    const next = points[(i + 1) % len];
    const dPrev = prev ? Math.hypot(pt.x - prev.x, pt.y - prev.y) : 0;
    const dNext = next ? Math.hypot(next.x - pt.x, next.y - pt.y) : 0;
    const best = dPrev > 0 || dNext > 0 ? Math.max(dPrev, dNext) : 20;
    return Math.max(Math.min(best * 0.4, 60), 8);
  });

  return points.map((pt, i) => {
    const prev = points[(i - 1 + len) % len];
    const next = points[(i + 1) % len];

    const handleIn = prev
      ? (() => {
          const dx = pt.x - prev.x;
          const dy = pt.y - prev.y;
          const d = Math.hypot(dx, dy) || 1;
          return { x: pt.x - (dx / d) * handleLens[i], y: pt.y - (dy / d) * handleLens[i] };
        })()
      : { x: pt.x - handleLens[i], y: pt.y };

    const handleOut = next
      ? (() => {
          const dx = next.x - pt.x;
          const dy = next.y - pt.y;
          const d = Math.hypot(dx, dy) || 1;
          return { x: pt.x + (dx / d) * handleLens[i], y: pt.y + (dy / d) * handleLens[i] };
        })()
      : { x: pt.x + handleLens[i], y: pt.y };

    return { ...pt, handleIn, handleOut };
  });
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const vectorTools: ToolModule[] = [
  penTool,
  curvaturePenTool,
  freePenTool,
  addAnchorTool,
  deleteAnchorTool,
  convertPointTool,
  pathSelectTool,
  directSelectTool,
];

import type { ToolModule } from './types';
import { warpPerspective } from '../utils/canvasUtils';

export const transformTools: ToolModule[] = [
  {
    id: 'hand',
    start: ({ setIsInteracting }) => {
      setIsInteracting(true);
    }
  },
  {
    id: 'move',
    move: ({ coords, lastPoint, activeLayerId, layers, updateLayer }) => {
      if (!lastPoint || !activeLayerId) return;
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer && !activeLayer.locked) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        updateLayer(activeLayerId, { 
          position: { 
            x: activeLayer.position.x + dx, 
            y: activeLayer.position.y + dy 
          } 
        });
      }
    }
  },
  {
    id: 'artboard',
    start: ({ coords, setSelectionRect, setIsInteracting }) => {
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({
        x: Math.min(startCoords.x, coords.x),
        y: Math.min(startCoords.y, coords.y),
        w: Math.abs(coords.x - startCoords.x),
        h: Math.abs(coords.y - startCoords.y)
      }, 'rect');
    },
    end: ({ selectionRect, setDocumentSize, setSelectionRect, recordHistory, setIsInteracting }) => {
      if (selectionRect && selectionRect.w > 10 && selectionRect.h > 10) {
        setDocumentSize({ w: Math.round(selectionRect.w), h: Math.round(selectionRect.h) });
        recordHistory('Resize Artboard');
      }
      setSelectionRect(null);
      setIsInteracting(false);
    }
  },
  {
    id: 'crop',
    start: ({ coords, setSelectionRect, setIsInteracting }) => {
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({
        x: Math.min(startCoords.x, coords.x),
        y: Math.min(startCoords.y, coords.y),
        w: Math.abs(coords.x - startCoords.x),
        h: Math.abs(coords.y - startCoords.y)
      }, 'rect');
    },
    end: ({ selectionRect, setCropRect, setSelectionRect, setIsInteracting }) => {
      if (selectionRect && selectionRect.w > 10 && selectionRect.h > 10) {
        setCropRect(selectionRect);
      }
      setSelectionRect(null);
      setIsInteracting(false);
    }
  },
  {
    id: 'perspective_crop',
    start: ({ coords, setIsInteracting, zoom, lassoPaths }) => {
      const threshold = 25 / (zoom || 1);
      
      // If lassoPaths is empty (e.g. after Undo), clear internal state
      if (!lassoPaths || lassoPaths.length === 0 || lassoPaths[0].length !== 4) {
        delete (window as any)._pcPoints;
        delete (window as any)._pcDragIdx;
      }

      const points = (window as any)._pcPoints;
      if (points && points.length === 4) {
        // Check corners first (0-3)
        let dragIdx = points.findIndex((p: any) => Math.hypot(p.x - coords.x, p.y - coords.y) < threshold);
        
        // Check midpoints (4-7)
        if (dragIdx === -1) {
          const midpoints = [
            { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }, // Top
            { x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2 }, // Right
            { x: (points[2].x + points[3].x) / 2, y: (points[2].y + points[3].y) / 2 }, // Bottom
            { x: (points[3].x + points[0].x) / 2, y: (points[3].y + points[0].y) / 2 }  // Left
          ];
          dragIdx = midpoints.findIndex((p: any) => Math.hypot(p.x - coords.x, p.y - coords.y) < threshold);
          if (dragIdx !== -1) dragIdx += 4;
        }

        // Check if inside the quad (8)
        if (dragIdx === -1) {
          const isInside = (p: {x:number, y:number}, poly: any[]) => {
            let inside = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
              if (((poly[i].y > p.y) !== (poly[j].y > p.y)) &&
                  (p.x < (poly[j].x - poly[i].x) * (p.y - poly[i].y) / (poly[j].y - poly[i].y) + poly[i].x)) {
                inside = !inside;
              }
            }
            return inside;
          };
          if (isInside(coords, points)) dragIdx = 8;
        }

        if (dragIdx !== -1) {
          (window as any)._pcDragIdx = dragIdx;
          (window as any)._pcStartPoint = { ...coords };
          (window as any)._pcOrigPoints = JSON.parse(JSON.stringify(points));
          setIsInteracting(true);
          return;
        }
      }
      
      // Prepare for a potential new quad (but wait for move)
      (window as any)._pcPendingCoords = { ...coords };
      setIsInteracting(true);
    },
    move: ({ coords, setLassoPaths, zoom }) => {
      let points = (window as any)._pcPoints;
      let dragIdx = (window as any)._pcDragIdx;
      
      // Check if we need to start a new quad (min movement 5px)
      if (dragIdx === undefined && (window as any)._pcPendingCoords) {
        const start = (window as any)._pcPendingCoords;
        const dist = Math.hypot(coords.x - start.x, coords.y - start.y);
        if (dist > 5 / (zoom || 1)) {
          (window as any)._pcPoints = [ { ...start }, { ...start }, { ...start }, { ...start } ];
          (window as any)._pcDragIdx = 2; // Bottom right
          (window as any)._pcIsInitialDrag = true;
          delete (window as any)._pcPendingCoords;
          dragIdx = 2;
          points = (window as any)._pcPoints;
        } else {
          return; // Still in dead zone
        }
      }

      if (!points || dragIdx === undefined) return;
      
      const startPoint = (window as any)._pcStartPoint;
      const origPoints = (window as any)._pcOrigPoints;

      if ((window as any)._pcIsInitialDrag) {
        const start = points[0];
        points = [
          { x: start.x, y: start.y },
          { x: coords.x, y: start.y },
          { x: coords.x, y: coords.y },
          { x: start.x, y: coords.y }
        ];
        (window as any)._pcPoints = points;
      } else if (dragIdx < 4) {
        // Dragging a corner
        points[dragIdx] = { ...coords };
      } else if (dragIdx === 8) {
        // Moving the whole quad
        if (startPoint && origPoints) {
          const dx = coords.x - startPoint.x;
          const dy = coords.y - startPoint.y;
          points = origPoints.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
          (window as any)._pcPoints = points;
        }
      } else {
        // Dragging a midpoint
        if (startPoint && origPoints) {
          const dx = coords.x - startPoint.x;
          const dy = coords.y - startPoint.y;
          const midIdx = dragIdx - 4;
          // midIdx: 0=top(0,1), 1=right(1,2), 2=bottom(2,3), 3=left(3,0)
          const p1Idx = midIdx;
          const p2Idx = (midIdx + 1) % 4;

          // Calculate normal vector of the edge
          const edgeX = origPoints[p2Idx].x - origPoints[p1Idx].x;
          const edgeY = origPoints[p2Idx].y - origPoints[p1Idx].y;
          const len = Math.hypot(edgeX, edgeY);
          if (len > 0) {
            const nx = -edgeY / len;
            const ny = edgeX / len;
            const projection = dx * nx + dy * ny;
            const constrainedDx = nx * projection;
            const constrainedDy = ny * projection;
            points[p1Idx] = { x: origPoints[p1Idx].x + constrainedDx, y: origPoints[p1Idx].y + constrainedDy };
            points[p2Idx] = { x: origPoints[p2Idx].x + constrainedDx, y: origPoints[p2Idx].y + constrainedDy };
          }
        }
      }
      setLassoPaths([points]);
    },
    end: ({ setLassoPaths }) => {
      (window as any)._pcIsInitialDrag = false;
      const points = (window as any)._pcPoints;
      if (points) setLassoPaths([points]);
    },
    doubleClick: ({ canvas, ctx, setLassoPaths, recordHistory, setDocumentSize, setIsInteracting, activeLayerId, updateLayer }) => {
      const points = (window as any)._pcPoints;
      if (points && points.length === 4 && canvas && ctx) {
        // Calculate target dimensions based on top and left edge lengths
        const w = Math.round(Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        const h = Math.round(Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y));
        
        if (w > 1 && h > 1) {
          const warpedData = warpPerspective(ctx, points, w, h);
          setDocumentSize({ w, h });
          const newCanvas = document.createElement('canvas');
          newCanvas.width = w; newCanvas.height = h;
          newCanvas.getContext('2d')!.putImageData(warpedData, 0, 0);
          updateLayer(activeLayerId!, { dataUrl: newCanvas.toDataURL(), position: { x: 0, y: 0 } });
          recordHistory('Perspective Crop');
        }
      }
      delete (window as any)._pcPoints;
      setLassoPaths([]);
      setIsInteracting(false);
    }
  },
  {
    id: 'slice',
    start: ({ coords, setSelectionRect, setIsInteracting }) => {
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect }) => {
      if (!startCoords) return;
      setSelectionRect({
        x: Math.min(startCoords.x, coords.x),
        y: Math.min(startCoords.y, coords.y),
        w: Math.abs(coords.x - startCoords.x),
        h: Math.abs(coords.y - startCoords.y)
      }, 'rect');
    },
    end: ({ selectionRect, setSelectionRect, addSlice, recordHistory, setIsInteracting }) => {
      if (selectionRect && selectionRect.w > 5 && selectionRect.h > 5) {
        addSlice(selectionRect);
        recordHistory('Add Slice');
      }
      setSelectionRect(null);
      setIsInteracting(false);
    }
  },
  {
    id: 'slice_select',
    start: ({ coords, slices, setIsInteracting }) => {
      const idx = slices.findIndex(s => 
        coords.x >= s.rect.x && coords.x <= s.rect.x + s.rect.w &&
        coords.y >= s.rect.y && coords.y <= s.rect.y + s.rect.h
      );
      if (idx !== -1) {
        (window as any)._sliceDragIdx = idx;
        (window as any)._sliceLastClickedIdx = idx;
        (window as any)._sliceStartRect = { ...slices[idx].rect };
        (window as any)._sliceStartCoords = { ...coords };
        setIsInteracting(true);
      } else {
        delete (window as any)._sliceLastClickedIdx;
      }
    },
    move: ({ coords, slices, setSlices }) => {
      const idx = (window as any)._sliceDragIdx;
      const startRect = (window as any)._sliceStartRect;
      const startCoords = (window as any)._sliceStartCoords;
      if (idx !== undefined && startRect && startCoords) {
        const dx = coords.x - startCoords.x;
        const dy = coords.y - startCoords.y;
        const nextSlices = [...slices];
        nextSlices[idx] = { 
          ...nextSlices[idx], 
          rect: { ...startRect, x: startRect.x + dx, y: startRect.y + dy } 
        };
        setSlices(nextSlices);
      }
    },
    end: ({ recordHistory, setIsInteracting }) => {
      if ((window as any)._sliceDragIdx !== undefined) {
        recordHistory('Move Slice');
      }
      delete (window as any)._sliceDragIdx;
      delete (window as any)._sliceStartRect;
      delete (window as any)._sliceStartCoords;
      setIsInteracting(false);
    }
  }
];

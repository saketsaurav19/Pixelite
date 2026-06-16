import type { ToolModule } from '../types';
import { warpPerspective } from '../../utils/canvasUtils';
import { toolState } from '../toolState';
import { findLayerById } from '../../utils/layerUtils';


const getLayerAtCoords = (
  layersList: any[],
  coords: { x: number; y: number },
  canvasRefs: any,
  parentOffset: { x: number; y: number } = { x: 0, y: 0 }
): string | null => {
  for (let i = layersList.length - 1; i >= 0; i--) {
    const layer = layersList[i];
    if (!layer.visible) continue;

    if (layer.type === 'group' || layer.type === 'artboard') {
      const layerX = (layer.position?.x || 0) + parentOffset.x;
      const layerY = (layer.position?.y || 0) + parentOffset.y;

      if (layer.type === 'artboard') {
        const w = layer.width || 0;
        const h = layer.height || 0;
        // Bounds check using absolute position
        if (coords.x < layerX || coords.x > layerX + w || coords.y < layerY || coords.y > layerY + h) {
          continue;
        }
        // Clicking inside an artboard always selects the artboard itself
        // (Move tool should move the whole artboard, not individual child layers)
        return layer.id;
      }

      if (layer.children) {
        // For groups (non-artboards), recurse into children with same offset
        const found = getLayerAtCoords(layer.children, coords, canvasRefs, parentOffset);
        if (found) return found;
      }
    } else {
      const canvas = canvasRefs?.current?.[layer.id];
      if (!canvas) continue;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      // Child position is LOCAL within parent; add parentOffset to get absolute
      const absX = (layer.position?.x || 0) + parentOffset.x;
      const absY = (layer.position?.y || 0) + parentOffset.y;
      const localX = Math.round(coords.x - absX);
      const localY = Math.round(coords.y - absY);

      if (localX >= 0 && localX < canvas.width && localY >= 0 && localY < canvas.height) {
        try {
          const imgData = ctx.getImageData(localX, localY, 1, 1);
          if (imgData.data[3] > 10) {
            return layer.id;
          }
        } catch (e) {
          console.error("Error reading pixel data", e);
        }
      }
    }
  }
  return null;
};

export const transformTools: ToolModule[] = [
  {
    id: 'hand',
    start: ({ setIsInteracting }) => {
      setIsInteracting(true);
    }
  },
  {
    id: 'move',
    start: ({ coords, layers, canvasRefs, setActiveLayer, moveAutoSelect, setIsInteracting }) => {
      if (setIsInteracting) setIsInteracting(true);
      if (moveAutoSelect && canvasRefs && setActiveLayer) {
        const targetLayerId = getLayerAtCoords(layers, coords, canvasRefs);
        if (targetLayerId) {
          setActiveLayer(targetLayerId);
        }
      }
    },
    move: ({ coords, lastPoint, activeLayerId, layers, updateLayer }) => {
      if (!lastPoint || !activeLayerId) return;
      // Search deeply — active layer may be nested inside an artboard
      const activeLayer = findLayerById(layers, activeLayerId);
      // Only check the layer's OWN lock — not descendants' locks (those are just visual indicators)
      if (activeLayer && !activeLayer.locked && !activeLayer.lockPosition) {
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;
        updateLayer(activeLayerId, { 
          position: { 
            x: (activeLayer.position?.x || 0) + dx, 
            y: (activeLayer.position?.y || 0) + dy 
          } 
        });
      }
    }
  },

  {
    id: 'artboard',
    start: ({ coords, setSelectionRect, setIsInteracting, activeCropHandle }) => {
      // Allow dragging handles from ArtboardOverlay
      if (activeCropHandle) return;

      // Start drawing a new artboard selection rect
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect, activeCropHandle, activeLayerId, layers, updateLayer }) => {
      if (activeCropHandle && activeLayerId) {
        // Manipulating an existing artboard via handles
        const artboard = layers.find(l => l.id === activeLayerId);
        if (artboard && startCoords) {
           const dx = coords.x - startCoords.x;
           const dy = coords.y - startCoords.y;

           let x = artboard.position?.x || 0;
           let y = artboard.position?.y || 0;
           let w = artboard.width || 0;
           let h = artboard.height || 0;

           if (activeCropHandle === 'tl') { x += dx; y += dy; w -= dx; h -= dy; }
           else if (activeCropHandle === 'tr') { y += dy; w += dx; h -= dy; }
           else if (activeCropHandle === 'bl') { x += dx; w -= dx; h += dy; }
           else if (activeCropHandle === 'br') { w += dx; h += dy; }
           else if (activeCropHandle === 'tm') { y += dy; h -= dy; }
           else if (activeCropHandle === 'bm') { h += dy; }
           else if (activeCropHandle === 'lm') { x += dx; w -= dx; }
           else if (activeCropHandle === 'rm') { w += dx; }
           // For move handle (we can use 'move')
           else if (activeCropHandle === 'move') { x += dx; y += dy; }

           // Update the active layer properties
           updateLayer(activeLayerId, { position: { x, y }, width: w, height: h });
        }
        return;
      }

      if (!startCoords) return;

      // Creating a new artboard
      setSelectionRect({
        x: Math.min(startCoords.x, coords.x),
        y: Math.min(startCoords.y, coords.y),
        w: Math.abs(coords.x - startCoords.x),
        h: Math.abs(coords.y - startCoords.y)
      }, 'rect');
    },
    end: ({ selectionRect, setDocumentSize, setSelectionRect, recordHistory, setIsInteracting, addLayer, documentSize, activeCropHandle }) => {
      if (!activeCropHandle && selectionRect && selectionRect.w > 10 && selectionRect.h > 10) {
        const w = Math.round(selectionRect.w);
        const h = Math.round(selectionRect.h);
        const x = Math.round(selectionRect.x);
        const y = Math.round(selectionRect.y);

        addLayer({
          name: 'Artboard',
          type: 'artboard',
          position: { x, y },
          width: w,
          height: h,
          children: []
        });

        // Auto-expand document if needed
        let newDocW = documentSize.w;
        let newDocH = documentSize.h;
        if (x + w > documentSize.w) newDocW = x + w;
        if (y + h > documentSize.h) newDocH = y + h;
        if (newDocW !== documentSize.w || newDocH !== documentSize.h) {
          setDocumentSize({ w: newDocW, h: newDocH });
        }

        recordHistory('Create Artboard');
      }
      setSelectionRect(null);
      setIsInteracting(false);
    }
  },
  {
    id: 'crop',
    start: ({ coords, setSelectionRect, setIsInteracting, activeCropHandle }) => {
      // If we are already manipulating a handle (set by CropOverlay), don't start a new rect
      if (activeCropHandle) return;
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect, cropRect, activeCropHandle, setCropRect, lastPoint }) => {
      if (activeCropHandle && cropRect && lastPoint) {
        const { x, y, w, h } = cropRect;
        const dx = coords.x - lastPoint.x;
        const dy = coords.y - lastPoint.y;

        if (activeCropHandle === 'move') {
          setCropRect({ ...cropRect, x: x + dx, y: y + dy });
          return;
        }

        const nr = { ...cropRect };
        if (activeCropHandle === 'tl') { nr.x = coords.x; nr.y = coords.y; nr.w = w + (x - coords.x); nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'tr') { nr.y = coords.y; nr.w = coords.x - x; nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'bl') { nr.x = coords.x; nr.w = w + (x - coords.x); nr.h = coords.y - y; }
        else if (activeCropHandle === 'br') { nr.w = coords.x - x; nr.h = coords.y - y; }
        else if (activeCropHandle === 'tm') { nr.y = coords.y; nr.h = h + (y - coords.y); }
        else if (activeCropHandle === 'bm') { nr.h = coords.y - y; }
        else if (activeCropHandle === 'lm') { nr.x = coords.x; nr.w = w + (x - coords.x); }
        else if (activeCropHandle === 'rm') { nr.w = coords.x - x; }
        setCropRect(nr);
        return;
      }

      if (!startCoords) return;
      setSelectionRect({
        x: Math.min(startCoords.x, coords.x),
        y: Math.min(startCoords.y, coords.y),
        w: Math.abs(coords.x - startCoords.x),
        h: Math.abs(coords.y - startCoords.y)
      }, 'rect');
    },
    end: ({ selectionRect, setCropRect, setSelectionRect, setIsInteracting, activeCropHandle }) => {
      if (!activeCropHandle && selectionRect && selectionRect.w > 10 && selectionRect.h > 10) {
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
        delete toolState._pcPoints;
        delete toolState._pcDragIdx;
      }

      const points = toolState._pcPoints;
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
          toolState._pcDragIdx = dragIdx;
          toolState._pcStartPoint = { ...coords };
          toolState._pcOrigPoints = JSON.parse(JSON.stringify(points));
          setIsInteracting(true);
          return;
        }
      }
      
      // Prepare for a potential new quad (but wait for move)
      toolState._pcPendingCoords = { ...coords };
      setIsInteracting(true);
    },
    move: ({ coords, setLassoPaths, zoom }) => {
      let points = toolState._pcPoints;
      let dragIdx = toolState._pcDragIdx;
      
      // Check if we need to start a new quad (min movement 5px)
      if (dragIdx === undefined && toolState._pcPendingCoords) {
        const start = toolState._pcPendingCoords;
        const dist = Math.hypot(coords.x - start.x, coords.y - start.y);
        if (dist > 5 / (zoom || 1)) {
          toolState._pcPoints = [ { ...start }, { ...start }, { ...start }, { ...start } ];
          toolState._pcDragIdx = 2; // Bottom right
          toolState._pcIsInitialDrag = true;
          delete toolState._pcPendingCoords;
          dragIdx = 2;
          points = toolState._pcPoints;
        } else {
          return; // Still in dead zone
        }
      }

      if (!points || dragIdx === undefined) return;
      
      const startPoint = toolState._pcStartPoint;
      const origPoints = toolState._pcOrigPoints;

      if (toolState._pcIsInitialDrag) {
        const start = points[0];
        points = [
          { x: start.x, y: start.y },
          { x: coords.x, y: start.y },
          { x: coords.x, y: coords.y },
          { x: start.x, y: coords.y }
        ];
        toolState._pcPoints = points;
      } else if (dragIdx < 4) {
        // Dragging a corner
        points[dragIdx] = { ...coords };
      } else if (dragIdx === 8) {
        // Moving the whole quad
        if (startPoint && origPoints) {
          const dx = coords.x - startPoint.x;
          const dy = coords.y - startPoint.y;
          points = origPoints.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
          toolState._pcPoints = points;
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
      toolState._pcIsInitialDrag = false;
      const points = toolState._pcPoints;
      if (points) setLassoPaths([points]);
    },
    doubleClick: ({ canvas, ctx, setLassoPaths, recordHistory, setDocumentSize, setIsInteracting, activeLayerId, updateLayer }) => {
      const points = toolState._pcPoints;
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
      delete toolState._pcPoints;
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
        toolState._sliceDragIdx = idx;
        toolState._sliceLastClickedIdx = idx;
        toolState._sliceStartRect = { ...slices[idx].rect };
        toolState._sliceStartCoords = { ...coords };
        setIsInteracting(true);
      } else {
        delete toolState._sliceLastClickedIdx;
      }
    },
    move: ({ coords, slices, setSlices }) => {
      const idx = toolState._sliceDragIdx;
      const startRect = toolState._sliceStartRect;
      const startCoords = toolState._sliceStartCoords;
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
      if (toolState._sliceDragIdx !== undefined) {
        recordHistory('Move Slice');
      }
      delete toolState._sliceDragIdx;
      delete toolState._sliceStartRect;
      delete toolState._sliceStartCoords;
      setIsInteracting(false);
    }
  }
];

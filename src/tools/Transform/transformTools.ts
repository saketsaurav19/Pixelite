import type { ToolModule } from '../types';
import { warpPerspective, getFontFamilyString } from '../../utils/canvasUtils';
import { toolState } from '../toolState';
import { findLayerById } from '../../utils/layerUtils';
import { useStore } from '../../store/useStore';

const getLayerCorners = (layer: any) => {
  if (layer.corners && layer.corners.length === 4) {
    return layer.corners.map((c: any) => ({ ...c }));
  }
  const x = layer.position?.x || 0;
  const y = layer.position?.y || 0;
  const w = layer.width || 100;
  const h = layer.height || 100;
  const rot = ((layer.rotation || 0) * Math.PI) / 180;
  const cosT = Math.cos(rot);
  const sinT = Math.sin(rot);

  return [
    { x, y }, // TL
    { x: x + w * cosT, y: y + w * sinT }, // TR
    { x: x + w * cosT - h * sinT, y: y + w * sinT + h * cosT }, // BR
    { x: x - h * sinT, y: y + h * cosT } // BL
  ];
};

const getBilinearPoint = (corners: { x: number; y: number }[], u: number, v: number) => {
  const [p0, p1, p2, p3] = corners;
  const x = (1 - u) * (1 - v) * p0.x + u * (1 - v) * p1.x + u * v * p2.x + (1 - u) * v * p3.x;
  const y = (1 - u) * (1 - v) * p0.y + u * (1 - v) * p1.y + u * v * p2.y + (1 - u) * v * p3.y;
  return { x, y };
};

const initWarpGrid = (corners: { x: number; y: number }[]) => {
  const grid: { x: number; y: number }[] = [];
  for (let r = 0; r < 4; r++) {
    const v = r / 3;
    for (let c = 0; c < 4; c++) {
      const u = c / 3;
      grid.push(getBilinearPoint(corners, u, v));
    }
  }
  return grid;
};

const rasterizeVectorLayer = (layer: any, canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  if (layer.type === 'text') {
    const fontSize = layer.fontSize || 16;
    const textColor = layer.color || '#000000';
    const fontWeight = layer.fontWeight || 'normal';
    const text = layer.textContent || '';
    const cleanFamily = getFontFamilyString(layer.fontFamily, layer.fontChecksum);
    ctx.font = `${layer.fontStyle || 'normal'} ${fontWeight} ${fontSize}px ${cleanFamily}`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'alphabetic';
    const metrics = ctx.measureText('M');
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    const baselineOffset = (ascent !== undefined && descent !== undefined)
      ? (fontSize + ascent - descent) / 2
      : fontSize * 0.85;

    if (layer.isVertical) {
      const lines = text.split('\n');
      lines.forEach((line: string, i: number) => {
        const chars = line.split('');
        chars.forEach((char: string, j: number) => {
          ctx.fillText(char, i * fontSize * 1.2, j * fontSize + baselineOffset);
        });
      });
    } else {
      const lines = text.split('\n');
      lines.forEach((line: string, i: number) => {
        ctx.fillText(line, 0, i * fontSize + baselineOffset);
      });
    }
  } else if (layer.type === 'shape' && layer.shapeData) {
    const { type, w, h, points, fill, stroke, strokeWidth } = layer.shapeData;
    const sw = strokeWidth || 0;
    ctx.fillStyle = fill || 'transparent';
    ctx.strokeStyle = stroke || 'transparent';
    ctx.lineWidth = sw;

    if (type === 'rect') {
      ctx.beginPath();
      ctx.rect(sw/2, sw/2, w - sw, h - sw);
      ctx.fill();
      if (sw > 0) ctx.stroke();
    } else if (type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(w/2, h/2, w/2 - sw/2, h/2 - sw/2, 0, 0, Math.PI * 2);
      ctx.fill();
      if (sw > 0) ctx.stroke();
    } else if (type === 'path' && points && points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      if (layer.shapeData.closed) ctx.closePath();
      ctx.fill();
      if (sw > 0) ctx.stroke();
    }
  }

  ctx.restore();
};

const getLayerAtCoords = (
  layersList: any[],
  coords: { x: number; y: number },
  canvasRefs: any,
  parentOffset: { x: number; y: number } = { x: 0, y: 0 }
): string | null => {
  for (let i = 0; i < layersList.length; i++) {
    const layer = layersList[i];
    if (!layer.visible) continue;
    if (layer.isPdfBackground) continue;

    if (layer.type === 'group' || layer.type === 'artboard') {
      const layerX = (layer.position?.x || 0) + parentOffset.x;
      const layerY = (layer.position?.y || 0) + parentOffset.y;

      if (layer.children) {
        const found = getLayerAtCoords(layer.children, coords, canvasRefs, { x: layerX, y: layerY });
        if (found) return found;
      }

      if (layer.type === 'artboard') {
        const w = layer.width || 0;
        const h = layer.height || 0;
        if (coords.x >= layerX && coords.x <= layerX + w && coords.y >= layerY && coords.y <= layerY + h) {
          return layer.id;
        }
      }
    } else {
      const canvas = canvasRefs?.current?.[layer.id];
      if (!canvas) continue;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      const absX = (layer.position?.x || 0) + parentOffset.x;
      const absY = (layer.position?.y || 0) + parentOffset.y;
      const localX = Math.round(coords.x - absX);
      const localY = Math.round(coords.y - absY);

      // Display dimensions: what the user sees (CSS pixels)
      const dispW = layer.width || canvas.width;
      const dispH = layer.height || canvas.height;

      if (localX >= 0 && localX < dispW && localY >= 0 && localY < dispH) {
        if (layer.type === 'text') {
          return layer.id;
        }
        // Scale from display coordinates to canvas pixel coordinates
        // Canvas pixel dimensions may differ from display dimensions
        // (e.g. placed images use native resolution for the canvas)
        const scaleX = canvas.width / dispW;
        const scaleY = canvas.height / dispH;
        const pixelX = Math.round(localX * scaleX);
        const pixelY = Math.round(localY * scaleY);

        try {
          const imgData = ctx.getImageData(pixelX, pixelY, 1, 1);
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
    start: ({ coords, layers, canvasRefs, setActiveLayer, moveAutoSelect, setIsInteracting, activeLayerId }) => {
      if (setIsInteracting) setIsInteracting(true);

      let targetId = activeLayerId;
      if (moveAutoSelect && canvasRefs && setActiveLayer) {
        const targetLayerId = getLayerAtCoords(layers, coords, canvasRefs);
        if (targetLayerId) {
          setActiveLayer(targetLayerId);
          targetId = targetLayerId;
        }
      }

      toolState._moveTargetId = targetId;

      if (targetId) {
        const activeLayer = findLayerById(layers, targetId);
        if (activeLayer) {
          toolState._moveStartLayerPos = {
            x: activeLayer.position?.x || 0,
            y: activeLayer.position?.y || 0
          };
        }
      }
    },
    move: ({ coords, lastPoint, layers, updateLayer, isShift, startCoords }) => {
      const targetId = toolState._moveTargetId;
      if (!lastPoint || !targetId) return;
      const activeLayer = findLayerById(layers, targetId);
      if (activeLayer && !activeLayer.locked && !activeLayer.lockPosition) {
        let dx = coords.x - lastPoint.x;
        let dy = coords.y - lastPoint.y;

        if (isShift && startCoords && toolState._moveStartLayerPos) {
          const totalDx = coords.x - startCoords.x;
          const totalDy = coords.y - startCoords.y;

          if (Math.abs(totalDx) >= Math.abs(totalDy)) {
            // Dragging along X axis (horizontal): lock Y coordinate to starting layer Y position
            const startY = toolState._moveStartLayerPos.y;
            const currentY = activeLayer.position?.y || 0;
            dy = startY - currentY;
          } else {
            // Dragging along Y axis (vertical): lock X coordinate to starting layer X position
            const startX = toolState._moveStartLayerPos.x;
            const currentX = activeLayer.position?.x || 0;
            dx = startX - currentX;
          }
        }
        
        // If layer has corners or warpGrid, move them as well
        const updates: any = {
          position: { 
            x: (activeLayer.position?.x || 0) + dx, 
            y: (activeLayer.position?.y || 0) + dy 
          }
        };
        if (activeLayer.corners) {
          updates.corners = activeLayer.corners.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
        }
        if (activeLayer.warpGrid) {
          updates.warpGrid = activeLayer.warpGrid.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
        }

        updateLayer(targetId, updates);
      }
    },
    end: () => {
      delete toolState._moveStartLayerPos;
      delete toolState._moveTargetId;
    }
  },

  {
    id: 'artboard',
    start: ({ coords, setSelectionRect, setIsInteracting, activeCropHandle }) => {
      if (activeCropHandle) return;
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 }, 'rect');
      setIsInteracting(true);
    },
    move: ({ coords, startCoords, setSelectionRect, activeCropHandle, activeLayerId, layers, updateLayer }) => {
      if (activeCropHandle && activeLayerId) {
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
           else if (activeCropHandle === 'move') { x += dx; y += dy; }

           updateLayer(activeLayerId, { position: { x, y }, width: w, height: h });
        }
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
      
      if (!lassoPaths || lassoPaths.length === 0 || lassoPaths[0].length !== 4) {
        delete toolState._pcPoints;
        delete toolState._pcDragIdx;
      }

      const points = toolState._pcPoints;
      if (points && points.length === 4) {
        let dragIdx = points.findIndex((p: any) => Math.hypot(p.x - coords.x, p.y - coords.y) < threshold);
        
        if (dragIdx === -1) {
          const midpoints = [
            { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 },
            { x: (points[1].x + points[2].x) / 2, y: (points[1].y + points[2].y) / 2 },
            { x: (points[2].x + points[3].x) / 2, y: (points[2].y + points[3].y) / 2 },
            { x: (points[3].x + points[0].x) / 2, y: (points[3].y + points[0].y) / 2 }
          ];
          dragIdx = midpoints.findIndex((p: any) => Math.hypot(p.x - coords.x, p.y - coords.y) < threshold);
          if (dragIdx !== -1) dragIdx += 4;
        }

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
      
      toolState._pcPendingCoords = { ...coords };
      setIsInteracting(true);
    },
    move: ({ coords, setLassoPaths, zoom }) => {
      let points = toolState._pcPoints;
      let dragIdx = toolState._pcDragIdx;
      
      if (dragIdx === undefined && toolState._pcPendingCoords) {
        const start = toolState._pcPendingCoords;
        const dist = Math.hypot(coords.x - start.x, coords.y - start.y);
        if (dist > 5 / (zoom || 1)) {
          toolState._pcPoints = [ { ...start }, { ...start }, { ...start }, { ...start } ];
          toolState._pcDragIdx = 2;
          toolState._pcIsInitialDrag = true;
          delete toolState._pcPendingCoords;
          dragIdx = 2;
          points = toolState._pcPoints;
        } else {
          return;
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
        points[dragIdx] = { ...coords };
      } else if (dragIdx === 8) {
        if (startPoint && origPoints) {
          const dx = coords.x - startPoint.x;
          const dy = coords.y - startPoint.y;
          points = origPoints.map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
          toolState._pcPoints = points;
        }
      } else {
        if (startPoint && origPoints) {
          const dx = coords.x - startPoint.x;
          const dy = coords.y - startPoint.y;
          const midIdx = dragIdx - 4;
          const p1Idx = midIdx;
          const p2Idx = (midIdx + 1) % 4;

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
  },
  {
    id: 'transform',
    start: ({ activeLayerId, layers, updateLayer, setIsInteracting, coords }) => {
      setIsInteracting(true);
      if (!activeLayerId) return;
      let layer = findLayerById(layers, activeLayerId);
      if (!layer) return;

      if (layer.dataUrl) {
        const img = new Image();
        img.src = layer.dataUrl;
        toolState.transformOriginalImage = img;
      }

      const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
      if (canvas) {
        const copy = document.createElement('canvas');
        copy.width = canvas.width;
        copy.height = canvas.height;
        const copyCtx = copy.getContext('2d');
        if (copyCtx) {
          copyCtx.drawImage(canvas, 0, 0);
          toolState.transformOriginalCanvas = copy;
        }
      }

      const mode = useStore.getState().transformMode;
      const startCorners = getLayerCorners(layer);
      toolState._transformStartCornersList = startCorners;

      if (['skew', 'distort', 'perspective', 'warp'].includes(mode)) {
        if (layer.type === 'text' || layer.type === 'shape') {
          const canvas = document.createElement('canvas');
          canvas.width = layer.width || 100;
          canvas.height = layer.height || 100;
          rasterizeVectorLayer(layer, canvas);
          
          updateLayer(activeLayerId, {
            type: 'paint',
            dataUrl: canvas.toDataURL(),
            textContent: undefined,
            shapeData: undefined,
            corners: startCorners
          });

          layer = {
            ...layer,
            type: 'paint',
            dataUrl: canvas.toDataURL(),
            corners: startCorners
          };
        } else if (!layer.corners) {
          updateLayer(activeLayerId, { corners: startCorners });
        }
      }

      if (mode === 'warp') {
        const currentCorners = layer.corners || startCorners;
        if (!layer.warpGrid) {
          const grid = initWarpGrid(currentCorners);
          updateLayer(activeLayerId, { warpGrid: grid });
          toolState._warpStartGrid = grid;
        } else {
          toolState._warpStartGrid = layer.warpGrid.map((p: any) => ({ ...p }));
        }

        // transformOriginalCanvas is now cached globally in the start phase

        const grid = layer.warpGrid || initWarpGrid(currentCorners);
        const zoom = useStore.getState().zoom || 1;
        const threshold = 20 / zoom;
        let closestIdx = -1;
        let minDist = Infinity;
        grid.forEach((pt: any, idx: number) => {
          const dist = Math.hypot(pt.x - coords.x, pt.y - coords.y);
          if (dist < threshold && dist < minDist) {
            minDist = dist;
            closestIdx = idx;
          }
        });
        toolState._warpActivePointIdx = closestIdx;
        toolState._warpStartCoords = { ...coords };
      }
    },
    move: ({ coords, activeLayerId, layers, updateLayer, isShift }) => {
      if (!activeLayerId) return;
      const activeLayer = findLayerById(layers, activeLayerId);
      if (!activeLayer) return;

      const mode = useStore.getState().transformMode;

      if (mode === 'warp' && activeLayer.warpGrid) {
        const startGrid = toolState._warpStartGrid;
        const startCoords = toolState._warpStartCoords;
        const ptIdx = toolState._warpActivePointIdx;

        if (startGrid && startCoords) {
          const dx = coords.x - startCoords.x;
          const dy = coords.y - startCoords.y;
          const newGrid = startGrid.map((p: any, idx: number) => {
            if (ptIdx === undefined || ptIdx === -1) {
              return { x: p.x + dx, y: p.y + dy };
            } else if (idx === ptIdx) {
              return { x: p.x + dx, y: p.y + dy };
            }
            return { ...p };
          });

          const p0 = newGrid[0];
          const p1 = newGrid[3];
          const p2 = newGrid[15];
          const p3 = newGrid[12];

          updateLayer(activeLayerId, {
            warpGrid: newGrid,
            corners: [p0, p1, p2, p3]
          });
        }
        return;
      }

      if (['skew', 'distort', 'perspective'].includes(mode)) {
        const startCorners = toolState._transformStartCornersList || getLayerCorners(activeLayer);
        const handle = toolState._transformActiveHandle;
        if (!handle) return;

        const startCoords = toolState._transformStartCoords;
        if (!startCoords) return;

        const dx = coords.x - startCoords.x;
        const dy = coords.y - startCoords.y;

        let [p0, p1, p2, p3] = startCorners.map((p: any) => ({ ...p }));

        if (mode === 'distort') {
          if (handle === 'tl') p0 = { x: p0.x + dx, y: p0.y + dy };
          else if (handle === 'tr') p1 = { x: p1.x + dx, y: p1.y + dy };
          else if (handle === 'br') p2 = { x: p2.x + dx, y: p2.y + dy };
          else if (handle === 'bl') p3 = { x: p3.x + dx, y: p3.y + dy };
          else if (handle === 'tm') { p0 = { x: p0.x + dx, y: p0.y + dy }; p1 = { x: p1.x + dx, y: p1.y + dy }; }
          else if (handle === 'bm') { p2 = { x: p2.x + dx, y: p2.y + dy }; p3 = { x: p3.x + dx, y: p3.y + dy }; }
          else if (handle === 'ml') { p0 = { x: p0.x + dx, y: p0.y + dy }; p3 = { x: p3.x + dx, y: p3.y + dy }; }
          else if (handle === 'mr') { p1 = { x: p1.x + dx, y: p1.y + dy }; p2 = { x: p2.x + dx, y: p2.y + dy }; }
          else if (handle === 'move') {
            p0 = { x: p0.x + dx, y: p0.y + dy };
            p1 = { x: p1.x + dx, y: p1.y + dy };
            p2 = { x: p2.x + dx, y: p2.y + dy };
            p3 = { x: p3.x + dx, y: p3.y + dy };
          }
        } else if (mode === 'skew') {
          if (handle === 'tm' || handle === 'bm') {
            const ux = p1.x - p0.x;
            const uy = p1.y - p0.y;
            const len = Math.hypot(ux, uy);
            if (len > 0) {
              const nx = ux / len;
              const ny = uy / len;
              const dot = dx * nx + dy * ny;
              const sx = nx * dot;
              const sy = ny * dot;
              if (handle === 'tm') {
                p0 = { x: p0.x + sx, y: p0.y + sy };
                p1 = { x: p1.x + sx, y: p1.y + sy };
              } else {
                p2 = { x: p2.x + sx, y: p2.y + sy };
                p3 = { x: p3.x + sx, y: p3.y + sy };
              }
            }
          } else if (handle === 'ml' || handle === 'mr') {
            const ux = p3.x - p0.x;
            const uy = p3.y - p0.y;
            const len = Math.hypot(ux, uy);
            if (len > 0) {
              const nx = ux / len;
              const ny = uy / len;
              const dot = dx * nx + dy * ny;
              const sx = nx * dot;
              const sy = ny * dot;
              if (handle === 'ml') {
                p0 = { x: p0.x + sx, y: p0.y + sy };
                p3 = { x: p3.x + sx, y: p3.y + sy };
              } else {
                p1 = { x: p1.x + sx, y: p1.y + sy };
                p2 = { x: p2.x + sx, y: p2.y + sy };
              }
            }
          } else if (handle === 'move') {
            p0 = { x: p0.x + dx, y: p0.y + dy };
            p1 = { x: p1.x + dx, y: p1.y + dy };
            p2 = { x: p2.x + dx, y: p2.y + dy };
            p3 = { x: p3.x + dx, y: p3.y + dy };
          }
        } else if (mode === 'perspective') {
          const ux = p1.x - p0.x;
          const uy = p1.y - p0.y;
          const lenX = Math.hypot(ux, uy);

          const vx = p3.x - p0.x;
          const vy = p3.y - p0.y;
          const lenY = Math.hypot(vx, vy);

          if (lenX > 0 && lenY > 0) {
            const ux_norm = { x: ux / lenX, y: uy / lenX };
            const uy_norm = { x: vx / lenY, y: vy / lenY };

            const projX = dx * ux_norm.x + dy * ux_norm.y;
            const projY = dx * uy_norm.x + dy * uy_norm.y;

            const dispX = { x: ux_norm.x * projX, y: ux_norm.y * projX };
            const dispY = { x: uy_norm.x * projY, y: uy_norm.y * projY };

            if (handle === 'tl') {
              p0 = { x: p0.x + dispX.x + dispY.x, y: p0.y + dispX.y + dispY.y };
              p1 = { x: p1.x - dispX.x + dispY.x, y: p1.y - dispX.y + dispY.y };
              p3 = { x: p3.x + dispX.x - dispY.x, y: p3.y + dispX.y - dispY.y };
            } else if (handle === 'tr') {
              p1 = { x: p1.x + dispX.x + dispY.x, y: p1.y + dispX.y + dispY.y };
              p0 = { x: p0.x - dispX.x + dispY.x, y: p0.y - dispX.y + dispY.y };
              p2 = { x: p2.x + dispX.x - dispY.x, y: p2.y + dispX.y - dispY.y };
            } else if (handle === 'br') {
              p2 = { x: p2.x + dispX.x + dispY.x, y: p2.y + dispX.y + dispY.y };
              p3 = { x: p3.x - dispX.x + dispY.x, y: p3.y - dispX.y + dispY.y };
              p1 = { x: p1.x + dispX.x - dispY.x, y: p1.y + dispX.y - dispY.y };
            } else if (handle === 'bl') {
              p3 = { x: p3.x + dispX.x + dispY.x, y: p3.y + dispX.y + dispY.y };
              p2 = { x: p2.x - dispX.x + dispY.x, y: p2.y - dispX.y + dispY.y };
              p0 = { x: p0.x + dispX.x - dispY.x, y: p0.y + dispX.y - dispY.y };
            } else if (handle === 'move') {
              p0 = { x: p0.x + dx, y: p0.y + dy };
              p1 = { x: p1.x + dx, y: p1.y + dy };
              p2 = { x: p2.x + dx, y: p2.y + dy };
              p3 = { x: p3.x + dx, y: p3.y + dy };
            }
          }
        }
        updateLayer(activeLayerId, { corners: [p0, p1, p2, p3] });
        return;
      }

      const handle = toolState._transformActiveHandle;
      if (!handle) return;

      const startCoords = toolState._transformStartCoords;
      const startPos = toolState._transformStartLayerPos;
      const startSize = toolState._transformStartLayerSize;
      const startRot = toolState._transformStartLayerRotation;

      if (!startCoords || !startPos || !startSize) return;

      const dx = coords.x - startCoords.x;
      const dy = coords.y - startCoords.y;

      const theta = (startRot * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const ux = { x: cosT, y: sinT };
      const uy = { x: -sinT, y: cosT };

      const dpx = dx * ux.x + dy * ux.y;
      const dpy = dx * uy.x + dy * uy.y;

      if (handle === 'move') {
        const nextX = startPos.x + dx;
        const nextY = startPos.y + dy;
        updateLayer(activeLayerId, { position: { x: nextX, y: nextY } });
        return;
      }

      if (mode === 'rotate' || handle === 'rot') {
        const cx = startPos.x + (startSize.w / 2) * cosT - (startSize.h / 2) * sinT;
        const cy = startPos.y + (startSize.w / 2) * sinT + (startSize.h / 2) * cosT;

        const phi = Math.atan2(coords.y - cy, coords.x - cx);

        let newRot = ((phi + Math.PI / 2) * 180) / Math.PI;
        newRot = ((newRot + 180) % 360) - 180;
        if (newRot < -180) newRot += 360;

        const newRotRad = (newRot * Math.PI) / 180;
        const nextX = cx - (startSize.w / 2) * Math.cos(newRotRad) + (startSize.h / 2) * Math.sin(newRotRad);
        const nextY = cy - (startSize.w / 2) * Math.sin(newRotRad) - (startSize.h / 2) * Math.cos(newRotRad);

        updateLayer(activeLayerId, {
          rotation: newRot,
          position: { x: nextX, y: nextY }
        });
        return;
      }

      let w = startSize.w;
      let h = startSize.h;

      const getAnchorCanvasPos = (localAnchor: { x: number; y: number }) => {
        return {
          x: startPos.x + localAnchor.x * cosT - localAnchor.y * sinT,
          y: startPos.y + localAnchor.x * sinT + localAnchor.y * cosT
        };
      };

      let anchor = { x: 0, y: 0 };
      if (handle === 'br') anchor = getAnchorCanvasPos({ x: 0, y: 0 });
      else if (handle === 'bl') anchor = getAnchorCanvasPos({ x: startSize.w, y: 0 });
      else if (handle === 'tr') anchor = getAnchorCanvasPos({ x: 0, y: startSize.h });
      else if (handle === 'tl') anchor = getAnchorCanvasPos({ x: startSize.w, y: startSize.h });
      else if (handle === 'mr') anchor = getAnchorCanvasPos({ x: 0, y: 0 });
      else if (handle === 'ml') anchor = getAnchorCanvasPos({ x: startSize.w, y: 0 });
      else if (handle === 'bm') anchor = getAnchorCanvasPos({ x: 0, y: 0 });
      else if (handle === 'tm') anchor = getAnchorCanvasPos({ x: 0, y: startSize.h });

      if (handle === 'br') {
        w = startSize.w + dpx;
        h = startSize.h + dpy;
      } else if (handle === 'bl') {
        w = startSize.w - dpx;
        h = startSize.h + dpy;
      } else if (handle === 'tr') {
        w = startSize.w + dpx;
        h = startSize.h - dpy;
      } else if (handle === 'tl') {
        w = startSize.w - dpx;
        h = startSize.h - dpy;
      } else if (handle === 'mr') {
        w = startSize.w + dpx;
      } else if (handle === 'ml') {
        w = startSize.w - dpx;
      } else if (handle === 'bm') {
        h = startSize.h + dpy;
      } else if (handle === 'tm') {
        h = startSize.h - dpy;
      }

      if (isShift && ['tl', 'tr', 'bl', 'br'].includes(handle)) {
        const scale = Math.max(w / startSize.w, h / startSize.h);
        w = startSize.w * scale;
        h = startSize.h * scale;
      }

      if (w < 5) w = 5;
      if (h < 5) h = 5;

      let nextX = startPos.x;
      let nextY = startPos.y;

      if (handle === 'br' || handle === 'mr' || handle === 'bm') {
        nextX = anchor.x;
        nextY = anchor.y;
      } else if (handle === 'tl') {
        nextX = anchor.x - w * cosT + h * sinT;
        nextY = anchor.y - w * sinT - h * cosT;
      } else if (handle === 'tr' || handle === 'tm') {
        nextX = anchor.x + h * sinT;
        nextY = anchor.y - h * cosT;
      } else if (handle === 'bl' || handle === 'ml') {
        nextX = anchor.x - w * cosT;
        nextY = anchor.y - w * sinT;
      }

      let targetW = w;
      let targetH = h;
      let targetX = nextX;
      let targetY = nextY;
      
      const isWarped = activeLayer && activeLayer.type === 'text' && activeLayer.textWarp && activeLayer.textWarp.style !== 'None';
      if (isWarped) {
        const unpaddedW = Math.max(10, (w - 40) / 1.6);
        const unpaddedH = Math.max(10, (h - 40) / 2.6);
        const padX = Math.round(unpaddedW * 0.3) + 20;
        const padY = Math.round(unpaddedH * 0.8) + 20;
        
        targetW = unpaddedW;
        targetH = unpaddedH;
        targetX = nextX + padX;
        targetY = nextY + padY;
      }

      updateLayer(activeLayerId, {
        position: { x: targetX, y: targetY },
        width: Math.round(targetW),
        height: Math.round(targetH)
      });
    },
    end: ({ setIsInteracting }) => {
      setIsInteracting(false);
      delete toolState._warpActivePointIdx;
      delete toolState.transformOriginalImage;
    }
  }
];

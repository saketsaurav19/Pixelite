import { useEffect } from 'react';
import type { Layer } from '../../../store/types';
import { mapBlendModeToCanvas } from '../../../utils/blendModes';
import type { CanvasRefs } from '../types';
import { useStore } from '../../../store/useStore';
import { applyPixiAdjustments } from '../../../utils/pixiUtils';
import { flattenTree } from '../../../utils/layerUtils';
import { drawTrianglesWarp, getFontFamilyString } from '../../../utils/canvasUtils';
import { renderDelaunayMesh } from '../../../utils/puppetWarpUtils';
import { applyWarpDeformation } from '../../../utils/textWarpUtils';
import { toolState } from '../../../tools/toolState';
import { pdfiumManager } from '../../../services/import/PdfiumManager';
import { combineShapes as combineShapesUtil, type BooleanOp as ShapeBooleanOp } from '../../../utils/shapeBooleanOps';

// Cache compound-shape rasterizations so re-renders triggered by unrelated
// state (selection, zoom, etc.) don't re-rasterize. Keyed by a tuple of
// (childIds, op, child signature) where the signature captures positions,
// fillRule and the svgPath hash. We don't cache across mount cycles.
const compoundCache = new WeakMap<Layer, { path: Path2D; bbox: { x: number; y: number; w: number; h: number }; deps: string }>();

const compoundDeps = (compound: Layer, allLayers: Layer[]): string => {
  const childIds = (compound.shapeData?.childIds || []).join(',');
  const op = compound.shapeData?.booleanOp || 'union';
  const sig = (compound.shapeData?.childIds || [])
    .map((id) => {
      const c = allLayers.find((l) => l.id === id);
      if (!c || !c.shapeData) return `${id}:missing`;
      const sd = c.shapeData as any;
      const pos = c.position || { x: 0, y: 0 };
      return [
        id,
        c.visible ? 1 : 0,
        pos.x.toFixed(2),
        pos.y.toFixed(2),
        sd.type,
        (sd.w || 0).toFixed(2),
        (sd.h || 0).toFixed(2),
        sd.svgPath || '',
        (sd.points || []).map((p: any) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(';'),
      ].join('|');
    })
    .join('::');
  return `${childIds}#${op}#${sig}`;
};

// Compute (or fetch from cache) the Path2D that renders a compound shape
// over its children. Returns null if there are fewer than two valid children.
const renderCompoundShape = (
  compound: Layer,
  allLayers: Layer[]
): { path: Path2D; bbox: { x: number; y: number; w: number; h: number } } | null => {
  const childIds = compound.shapeData?.childIds || [];
  if (childIds.length < 1) return null;

  const sd = compound.shapeData as any;
  const op = (sd.booleanOp as ShapeBooleanOp) || 'union';

  // Resolve children in the order stored on the compound, then project to
  // (shape, position) pairs in document coordinates.
  const inputs = childIds
    .map((id) => allLayers.find((l) => l.id === id))
    .filter((l): l is Layer => !!l && !!l.shapeData)
    .map((l) => ({
      shapeData: l.shapeData as any,
      position: l.position || { x: 0, y: 0 },
    }));

  if (inputs.length < 2) {
    // 1-child case: just paint the single child as a flat path.
    const only = inputs[0];
    if (!only || !only.shapeData) return null;
    const sd2 = only.shapeData;
    if (sd2.type === 'path' && sd2.svgPath) {
      // Translate path so its local origin matches the compound's position (0,0).
      const p = new Path2D();
      p.addPath(new Path2D(sd2.svgPath), new DOMMatrix().translate(only.position.x, only.position.y));
      return {
        path: p,
        bbox: { x: only.position.x, y: only.position.y, w: 0, h: 0 },
      };
    }
    return null;
  }

  const deps = compoundDeps(compound, allLayers);
  const cached = compoundCache.get(compound);
  if (cached && cached.deps === deps) return cached;

  const result = combineShapesUtil(inputs, op);
  if (!result) return null;
  const localPath = result.polygons
    .map((poly) => {
      let d = '';
      if (poly.length < 3) return '';
      d += `M ${poly[0].x.toFixed(2)} ${poly[0].y.toFixed(2)} `;
      for (let i = 1; i < poly.length; i++) {
        d += `L ${poly[i].x.toFixed(2)} ${poly[i].y.toFixed(2)} `;
      }
      d += 'Z ';
      return d;
    })
    .join(' ')
    .trim();
  if (!localPath) return null;
  const path = new Path2D(localPath);
  compoundCache.set(compound, { path, bbox: result.bbox, deps });
  return { path, bbox: result.bbox };
};

const renderLayer = (
  layer: Layer,
  documentSize: { w: number; h: number },
  canvasRefs: CanvasRefs,
  isInteracting: boolean,
  activeLayerId: string | null,
  activeAdjustmentModal: string | null,
  allLayers: Layer[]
): void => {
  // Skip re-rendering the active layer if we are currently interacting with it or if the Filter Gallery / Layer Style dialogs are open
  if (
    (isInteracting && layer.id === activeLayerId && useStore.getState().activeTool !== 'transform') ||
    (useStore.getState().isFilterGalleryDialogOpen && layer.id === activeLayerId) ||
    (useStore.getState().isLayerStyleDialogOpen && layer.id === activeLayerId)
  ) {
    return;
  }

  // If it's a group, recursively render children in bottom-to-top order
  if ((layer.type === 'group' || layer.type === 'artboard') && layer.children) {
    [...layer.children].reverse().forEach(child => {
      renderLayer(child, documentSize, canvasRefs, isInteracting, activeLayerId, activeAdjustmentModal, allLayers);
    });
    return;
  }

  const canvas = canvasRefs.current[layer.id];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx || !canvas) return;

  if (layer.type === 'adjustment') {
    // If we are currently interacting with/editing this adjustment layer, let AdjustmentDialog handle it (via dataUrl)
    if (activeAdjustmentModal && activeLayerId === layer.id) {
      if (layer.dataUrl) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        };
        img.src = layer.dataUrl;
      }
      return;
    }

    // Otherwise, dynamically render the adjustment layer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = documentSize.w;
    tempCanvas.height = documentSize.h;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const flat = flattenTree(allLayers);
    const adjIdx = flat.findIndex(l => l.id === layer.id);
    if (adjIdx !== -1) {
      // Draw visible layers below bottom-up
      for (let k = flat.length - 1; k > adjIdx; k--) {
        const l = flat[k];
        if (!l.visible || l.type === 'group' || l.type === 'artboard') continue;

        const lCanvas = canvasRefs.current[l.id];
        if (lCanvas) {
          tempCtx.save();
          tempCtx.globalAlpha = l.opacity ?? 1;
          tempCtx.globalCompositeOperation = mapBlendModeToCanvas(l.blendMode);
          const lx = l.position?.x || 0;
          const ly = l.position?.y || 0;
          tempCtx.drawImage(lCanvas, lx, ly);
          tempCtx.restore();
        }
      }
    }

    if (layer.adjustmentData?.settings) {
      applyPixiAdjustments(tempCanvas, layer.adjustmentData.settings)
        .then((resultDataUrl) => {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
          };
          img.src = resultDataUrl;
        })
        .catch((err) => {
          console.error('Failed to render adjustment layer:', err);
        });
    }
    return;
  }

  if (layer.isPdfBackground && layer.pdfData && layer.pdfPageIndex !== undefined) {
    pdfiumManager.renderPage(layer.pdfData, layer.pdfPageIndex, canvas.width, canvas.height, canvas)
      .catch((err) => console.error('Failed to dynamically render PDF page:', err));
  } else if (layer.dataUrl) {
    const activeTool = useStore.getState().activeTool;
    const transformMode = useStore.getState().transformMode;

    // Consider this layer "transforming" if:
    // a) the transform tool is active with an original image captured (classic modes), OR
    // b) puppet mode is active and the layer has a live mesh with pins
    const hasPuppetWarp =
      activeTool === 'transform' &&
      transformMode === 'puppet' &&
      layer.id === activeLayerId &&
      !!layer.puppetRestPoints &&
      !!layer.warpGrid &&
      !!layer.puppetTriangles &&
      !!toolState.transformOriginalCanvas;

    const isTransformingThisLayer =
      (activeTool === 'transform' && layer.id === activeLayerId && !!toolState.transformOriginalImage) ||
      hasPuppetWarp;

    if (isTransformingThisLayer) {
      // While transforming, paint the LIVE deformed result.
      const origCanvas = toolState.transformOriginalCanvas;
      let paintedWarp = false;

      if (origCanvas && layer.warpGrid) {
        if (
          transformMode === 'puppet' &&
          layer.puppetTriangles &&
          layer.puppetRestPoints &&
          layer.puppetRestPoints.length === layer.warpGrid.length
        ) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          renderDelaunayMesh(
            ctx,
            origCanvas,
            layer.puppetRestPoints.map((p: any) => ({ x: p.x, y: p.y })),
            layer.warpGrid.map((p: any) => ({ x: p.x, y: p.y })),
            layer.puppetTriangles
          );
          paintedWarp = true;
        }
      }

      if (!paintedWarp) {
        const img = toolState.transformOriginalImage as HTMLImageElement;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      }
    } else {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = layer.dataUrl;
    }
  } else if (layer.type === 'paint' && layer.name === 'Background') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, documentSize.w, documentSize.h);
  } else if (layer.type === 'text' && layer.textContent) {
    const isWarped = layer.textWarp && layer.textWarp.style !== 'None';
    const origW = layer.width || 0;
    const origH = layer.height || 0;
    const padX = isWarped ? Math.round(origW * 0.3) + 20 : 0;
    const padY = isWarped ? Math.round(origH * 0.8) + 20 : 0;

    const targetCtx = isWarped ? document.createElement('canvas').getContext('2d')! : ctx;
    if (isWarped) {
      targetCtx.canvas.width = origW + 2 * padX;
      targetCtx.canvas.height = origH + 2 * padY;
    }

    targetCtx.save();
    targetCtx.clearRect(0, 0, targetCtx.canvas.width, targetCtx.canvas.height);
    if (isWarped) {
      targetCtx.translate(padX, padY);
    } else if (layer.rotation) {
      const rad = (layer.rotation * Math.PI) / 180;
      const normalizedRot = ((layer.rotation % 360) + 360) % 360;
      if (normalizedRot === 90) {
        targetCtx.translate(canvas.width, 0);
      } else if (normalizedRot === 180) {
        targetCtx.translate(canvas.width, canvas.height);
      } else if (normalizedRot === 270) {
        targetCtx.translate(0, canvas.height);
      }
      targetCtx.rotate(rad);
    }
    targetCtx.fillStyle = layer.color || '#000000';
    targetCtx.textAlign = layer.textAlign || 'left';
    const fs = layer.fontSize || 40;

    const fontFamily = getFontFamilyString(layer.fontFamily, layer.fontChecksum);

    targetCtx.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'normal'} ${fs}px ${fontFamily}`;
    targetCtx.textBaseline = 'alphabetic';
    const metrics = targetCtx.measureText('M');
    const ascent = metrics.fontBoundingBoxAscent;
    const descent = metrics.fontBoundingBoxDescent;
    const baselineOffset = (ascent !== undefined && descent !== undefined)
      ? (fs + ascent - descent) / 2
      : fs * 0.85;

    layer.textContent.split('\n').forEach((line: string, i: number) => {
      if (layer.isVertical) {
        const chars = line.split('');
        const xPos = i * fs * 1.2;
        chars.forEach((char: string, j: number) => {
          const yPos = j * fs + baselineOffset;
          if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
            targetCtx.strokeStyle = layer.strokeColor;
            targetCtx.lineWidth = layer.strokeWidth;
            targetCtx.strokeText(char, xPos, yPos);
          }
          targetCtx.fillText(char, xPos, yPos);
        });
      } else {
        const yPos = i * fs + baselineOffset;
        let xPos = 0;
        if (layer.textAlign === 'center') {
          xPos = origW / 2;
        } else if (layer.textAlign === 'right') {
          xPos = origW;
        }
        if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
          targetCtx.strokeStyle = layer.strokeColor;
          targetCtx.lineWidth = layer.strokeWidth;
          targetCtx.strokeText(line, xPos, yPos);
        }
        targetCtx.fillText(line, xPos, yPos);
      }
    });
    targetCtx.restore();

    if (isWarped) {
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (layer.rotation) {
        const rad = (layer.rotation * Math.PI) / 180;
        const normalizedRot = ((layer.rotation % 360) + 360) % 360;
        if (normalizedRot === 90) {
          ctx.translate(canvas.width, 0);
        } else if (normalizedRot === 180) {
          ctx.translate(canvas.width, canvas.height);
        } else if (normalizedRot === 270) {
          ctx.translate(0, canvas.height);
        }
        ctx.rotate(rad);
      }

      const gridW = 10;
      const gridH = 10;
      const srcGrid: { x: number; y: number }[] = [];
      const dstGrid: { x: number; y: number }[] = [];

      for (let y = 0; y < gridH; y++) {
        const vVal = y / (gridH - 1);
        for (let x = 0; x < gridW; x++) {
          const uVal = x / (gridW - 1);
          const px = uVal * (origW + 2 * padX);
          const py = vVal * (origH + 2 * padY);
          srcGrid.push({ x: px, y: py });

          const uNorm = (px - padX) / origW;
          const vNorm = (py - padY) / origH;

          const deformed = applyWarpDeformation(uNorm, vNorm, origW, origH, layer.textWarp!);
          dstGrid.push({
            x: deformed.x + padX,
            y: deformed.y + padY
          });
        }
      }

      drawTrianglesWarp(ctx, targetCtx.canvas, srcGrid, dstGrid, gridW, gridH);
      ctx.restore();
    }
  } else if (layer.type === 'shape' && layer.shapeData) {
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (layer.rotation) {
      const rad = (layer.rotation * Math.PI) / 180;
      const normalizedRot = ((layer.rotation % 360) + 360) % 360;
      if (normalizedRot === 90) {
        ctx.translate(canvas.width, 0);
      } else if (normalizedRot === 180) {
        ctx.translate(canvas.width, canvas.height);
      } else if (normalizedRot === 270) {
        ctx.translate(0, canvas.height);
      }
      ctx.rotate(rad);
    }
    const { type, w, h, points, fill, stroke, strokeWidth } = layer.shapeData as any;
    const sw = strokeWidth || 0;

    if (type === 'compound') {
      // Live mode: compose children into a Path2D and fill/stroke that.
      const composed = renderCompoundShape(layer, allLayers);
      if (composed) {
        const fillRule = layer.shapeData.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill(composed.path, fillRule as CanvasFillRule);
        }
        if (stroke && sw > 0) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = sw;
          ctx.stroke(composed.path);
        }
      }
      ctx.restore();
      return;
    }

    if (type === 'rect' || !type) {
      ctx.beginPath();
      ctx.rect(sw/2, sw/2, (w || 100) - sw, (h || 100) - sw);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke && sw > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sw;
        ctx.stroke();
      }
    } else if (type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(w / 2, h / 2, Math.max(0, Math.abs(w / 2) - sw / 2), Math.max(0, Math.abs(h / 2) - sw / 2), 0, 0, Math.PI * 2);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke && sw > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sw;
        ctx.stroke();
      }
    } else if (type === 'path') {
      if (layer.shapeData.svgPath) {
        const p = new Path2D(layer.shapeData.svgPath);
        const fillRule = layer.shapeData.fillRule === 'evenodd' ? 'evenodd' : 'nonzero';
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill(p, fillRule as CanvasFillRule);
        }
        if (stroke && sw > 0) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = sw;
          ctx.stroke(p);
        }
      } else if (points && points.length > 0) {
        ctx.beginPath();
        if (layer.shapeData.smooth && points.length >= 3) {
          ctx.moveTo(points[0].x, points[0].y);
          const len = points.length;
          for (let i = 0; i < (layer.shapeData.closed ? len : len - 1); i++) {
            const p1 = points[i % len];
            const p2 = points[(i + 1) % len];
            const p0 = points[(i - 1 + len) % len];
            const p3 = points[(i + 2) % len];

            const cp1x = (p1 as any).handleOut?.x ?? p1.x + (p2.x - p0.x) / 6;
            const cp1y = (p1 as any).handleOut?.y ?? p1.y + (p2.y - p0.y) / 6;
            const cp2x = (p2 as any).handleIn?.x ?? p2.x - (p3.x - p1.x) / 6;
            const cp2y = (p2 as any).handleIn?.y ?? p2.y - (p3.y - p1.y) / 6;

            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        } else {
          ctx.moveTo(points[0].x, points[0].y);
          points.forEach((p: any) => ctx.lineTo(p.x, p.y));
        }

        if (layer.shapeData.closed || layer.shapeData.smooth) ctx.closePath();

        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill();
        }
        if (stroke && sw > 0) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = sw;
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
};

export const useLayerRendering = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs,
  isInteracting: boolean,
  activeLayerId: string | null
) => {
  const activeAdjustmentModal = useStore((state) => state.activeAdjustmentModal);
  const zoom = useStore((state) => state.zoom || 1);
  const isFilterGalleryDialogOpen = useStore((state) => state.isFilterGalleryDialogOpen);
  const isLayerStyleDialogOpen = useStore((state) => state.isLayerStyleDialogOpen);

  useEffect(() => {
    // Render bottom-to-top so adjustment layers composite correctly
    const reversedLayers = [...layers].reverse();
    reversedLayers.forEach(layer => {
      renderLayer(layer, documentSize, canvasRefs, isInteracting, activeLayerId, activeAdjustmentModal, layers);
    });
  }, [layers, documentSize, isInteracting, activeLayerId, activeAdjustmentModal, zoom, isFilterGalleryDialogOpen, isLayerStyleDialogOpen]);
};

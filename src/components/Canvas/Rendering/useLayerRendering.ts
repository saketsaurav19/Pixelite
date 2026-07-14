import { useEffect } from 'react';
import type { Layer } from '../../../store/types';
import type { CanvasRefs } from '../types';
import { useStore } from '../../../store/useStore';
import { applyPixiAdjustments } from '../../../utils/pixiUtils';
import { flattenTree } from '../../../utils/layerUtils';
import { drawTrianglesWarp } from '../../../utils/canvasUtils';
import { applyWarpDeformation } from '../../../utils/textWarpUtils';
import { toolState } from '../../../tools/toolState';
import { pdfiumManager } from '../../../services/import/PdfiumManager';

const renderLayer = (
  layer: Layer,
  documentSize: { w: number; h: number },
  canvasRefs: CanvasRefs,
  isInteracting: boolean,
  activeLayerId: string | null,
  activeAdjustmentModal: string | null,
  allLayers: Layer[]
): void => {
  // Skip re-rendering the active layer if we are currently interacting with it
  if (isInteracting && layer.id === activeLayerId && useStore.getState().activeTool !== 'transform') return;

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
    const isTransformingThisLayer = activeTool === 'transform' && layer.id === activeLayerId && toolState.transformOriginalImage;

    if (isTransformingThisLayer) {
      const img = toolState.transformOriginalImage as HTMLImageElement;
      if (img.width && img.height && (canvas.width !== img.width || canvas.height !== img.height)) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    } else {
      const img = new Image();
      img.onload = () => {
        if (img.width && img.height && (canvas.width !== img.width || canvas.height !== img.height)) {
          canvas.width = img.width;
          canvas.height = img.height;
        }
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

    const hasCustomFont = !!layer.fontChecksum;
    const customFontKey = hasCustomFont ? `pdf-font-${layer.fontChecksum}` : '';
    const isGeneric = !layer.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(layer.fontFamily.toLowerCase());

    const fontFamily = hasCustomFont
      ? `"${customFontKey}", "${layer.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
      : isGeneric
        ? `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif, Arial`
        : `"${layer.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif, Arial`;

    targetCtx.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'normal'} ${fs}px ${fontFamily}`;

    layer.textContent.split('\n').forEach((line: string, i: number) => {
      if (layer.isVertical) {
        const chars = line.split('');
        const xPos = i * fs * 1.2;
        chars.forEach((char: string, j: number) => {
          const yPos = (j + 1) * fs;
          if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
            targetCtx.strokeStyle = layer.strokeColor;
            targetCtx.lineWidth = layer.strokeWidth;
            targetCtx.strokeText(char, xPos, yPos);
          }
          targetCtx.fillText(char, xPos, yPos);
        });
      } else {
        const yPos = (i + 1) * fs;
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
        if (fill) {
          ctx.fillStyle = fill;
          ctx.fill(p);
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
          for (let i = 0; i < (layer.shapeData.closed ? points.length : points.length - 1); i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i % points.length];
            const p2 = points[(i + 1) % points.length];
            const p3 = points[(i + 2) % points.length];

            const cp1x = p1.x + (p2.x - p0.x) / 6;
            const cp1y = p1.y + (p2.y - p0.y) / 6;
            const cp2x = p2.x - (p3.x - p1.x) / 6;
            const cp2y = p2.y - (p3.y - p1.y) / 6;

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

  useEffect(() => {
    // Render bottom-to-top so adjustment layers composite correctly
    const reversedLayers = [...layers].reverse();
    reversedLayers.forEach(layer => {
      renderLayer(layer, documentSize, canvasRefs, isInteracting, activeLayerId, activeAdjustmentModal, layers);
    });
  }, [layers, documentSize, isInteracting, activeLayerId, activeAdjustmentModal, zoom]);
};

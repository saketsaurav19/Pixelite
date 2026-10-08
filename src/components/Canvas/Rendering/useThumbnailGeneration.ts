import { useEffect, useRef } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

const MAX_THUMB = 48;

/**
 * Draw a vector path directly onto a canvas context.
 * Supports straight lines and Catmull-Rom smooth curves.
 */
function drawPathOnCanvas(
  ctx: CanvasRenderingContext2D,
  points: { x: number; y: number }[],
  closed: boolean,
  smooth: boolean,
  fill: string,
  stroke: string,
  strokeWidth: number
): void {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (!smooth) {
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  } else {
    const len = points.length;
    for (let i = 0; i < (closed ? len : len - 1); i++) {
      const p0 = points[(i - 1 + len) % len];
      const p1 = points[i % len];
      const p2 = points[(i + 1) % len];
      const p3 = points[(i + 2) % len];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

/**
 * Build a compact cache key for a layer.
 * Excludes `thumbnail` (we generate it) and avoids stringifying the full dataUrl
 * (huge base64 string) — instead tracks just the first 200 chars as a signature.
 */
function cacheKey(layer: Layer, docW: number, docH: number): string {
  const dataUrl = (layer as any).dataUrl as string | undefined;
  const dataUrlSig = dataUrl
    ? `${dataUrl.length}_${dataUrl.slice(-120)}`
    : '';
  const shapeData = (layer as any).shapeData || {};
  return [
    layer.id,
    layer.type,
    layer.width ?? 0,
    layer.height ?? 0,
    layer.position?.x ?? 0,
    layer.position?.y ?? 0,
    layer.opacity ?? 1,
    layer.visible ? 1 : 0,
    (layer as any).textContent ?? '',
    (layer as any).color ?? '',
    shapeData.fill ?? '',
    shapeData.stroke ?? '',
    shapeData.strokeWidth ?? '',
    Array.isArray(shapeData.points) ? shapeData.points.length : '',
    shapeData.closed ? '1' : '0',
    shapeData.smooth ? '1' : '0',
    docW, docH,
    dataUrlSig,
  ].join('|');
}

function thumbSize(srcW: number, srcH: number) {
  const aspect = srcW / srcH;
  return aspect > 1
    ? { w: MAX_THUMB, h: Math.max(1, Math.round(MAX_THUMB / aspect)) }
    : { w: Math.max(1, Math.round(MAX_THUMB * aspect)), h: MAX_THUMB };
}

const generateThumbnail = (
  layer: Layer,
  documentSize: { w: number; h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void,
  lastKeyRef: React.MutableRefObject<{ [key: string]: string }>,
  pendingRef: React.MutableRefObject<{ [key: string]: boolean }>,
  parentArtboard?: Layer
): void => {

  // ── Groups / Artboards ─────────────────────────────────────────────────
  if ((layer.type === 'group' || layer.type === 'artboard') && layer.children) {
    layer.children.forEach(child =>
      generateThumbnail(child, documentSize, canvasRefs, updateLayer, lastKeyRef, pendingRef,
        layer.type === 'artboard' ? layer : parentArtboard)
    );

    const key = cacheKey(layer, documentSize.w, documentSize.h);
    if (lastKeyRef.current[layer.id] === key) return;
    lastKeyRef.current[layer.id] = key;

    const refW = layer.width || documentSize.w;
    const refH = layer.height || documentSize.h;
    const { w: thumbW, h: thumbH } = thumbSize(refW, refH);
    const tc = document.createElement('canvas');
    tc.width = thumbW; tc.height = thumbH;
    const ctx = tc.getContext('2d');
    if (!ctx) return;

    if (layer.type === 'artboard') {
      ctx.fillStyle = layer.backgroundTransparent ? 'transparent' : (layer.backgroundColor || '#ffffff');
      ctx.fillRect(0, 0, thumbW, thumbH);
    }

    const scaleX = thumbW / refW;
    const scaleY = thumbH / refH;
    const drawChild = (node: Layer) => {
      if (!node.visible) return;
      if (node.type === 'group' || node.type === 'artboard') {
        node.children?.forEach(drawChild);
        return;
      }
      const c = canvasRefs.current[node.id];
      if (c) {
        ctx.drawImage(c, 0, 0, c.width, c.height,
          (node.position?.x || 0) * scaleX, (node.position?.y || 0) * scaleY,
          (node.width || c.width) * scaleX, (node.height || c.height) * scaleY);
      }
    };
    [...layer.children].reverse().forEach(drawChild);
    updateLayer(layer.id, { thumbnail: tc.toDataURL() });
    return;
  }

  const key = cacheKey(layer, documentSize.w, documentSize.h);
  if (lastKeyRef.current[layer.id] === key) return;

  // ── Text layers ────────────────────────────────────────────────────────
  if (layer.type === 'text') {
    lastKeyRef.current[layer.id] = key;
    const tc = document.createElement('canvas');
    tc.width = MAX_THUMB; tc.height = MAX_THUMB;
    const ctx = tc.getContext('2d');
    if (!ctx) return;
    const colorStr = (layer.color || '#000000').toLowerCase();
    const toFullHex = (h: string) =>
      h.length === 4
        ? `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
        : h;
    const bright = (hex: string) => {
      const full = toFullHex(hex);
      const r = parseInt(full.slice(1, 3), 16);
      const g = parseInt(full.slice(3, 5), 16);
      const b = parseInt(full.slice(5, 7), 16);
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const isLight = colorStr.startsWith('#') && bright(colorStr) > 220;
    ctx.fillStyle = isLight ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, MAX_THUMB, MAX_THUMB);
    ctx.fillStyle = layer.color || '#000000';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let txt = layer.textContent || 'T';
    if (txt.length > 5) txt = txt.slice(0, 4) + '..';
    ctx.fillText(txt, MAX_THUMB / 2, MAX_THUMB / 2);
    updateLayer(layer.id, { thumbnail: tc.toDataURL() });
    return;
  }

  // ── Shape layers ───────────────────────────────────────────────────────
  if (layer.type === 'shape') {
    const shapeData = (layer as any).shapeData || {};
    const points = shapeData.points || [];
    const closed = shapeData.closed !== false;
    const smooth = shapeData.smooth || false;
    const rawFill = shapeData.fill || '#888888';
    const rawStroke = shapeData.stroke || '#000000';
    const strokeWidth = shapeData.strokeWidth || 1;

    // Use the original color strings directly. Canvas 2D fillStyle/strokeStyle
    // accepts rgba(), so preserve alpha instead of flattening to hex.
    const normalizeColor = (candidate: string, fallback: string): string => {
      if (!candidate || candidate === 'none' || candidate === 'transparent') return fallback;
      if (candidate.startsWith('#')) return candidate;
      if (/^rgba?\(/.test(candidate)) return candidate;
      return fallback;
    };
    const fill = normalizeColor(rawFill, '#888888');
    const stroke = normalizeColor(rawStroke, '#000000');

    const tc = document.createElement('canvas');
    tc.width = MAX_THUMB;
    tc.height = MAX_THUMB;
    const ctx = tc.getContext('2d');
    if (!ctx) return;

    // Always generate a thumbnail for shape layers that are missing one.
    const hasThumbnail = !!(layer as any).thumbnail;
    const shouldDraw = !hasThumbnail || lastKeyRef.current[layer.id] !== key;

    if (!shouldDraw) return;

    // Choose a contrasting thumbnail background from the shape color.
    const toRgb = (c: string) => {
      const m = c.match(/^#([0-9a-fA-F]{6})$/);
      if (m) {
        const v = parseInt(m[1], 16);
        return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
      }
      const rm = c.match(/rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i);
      if (rm) {
        return { r: Math.round(parseFloat(rm[1])), g: Math.round(parseFloat(rm[2])), b: Math.round(parseFloat(rm[3])) };
      }
      return { r: 128, g: 128, b: 128 };
    };
    const pickContrast = (c: string) => {
      const { r, g, b } = toRgb(c);
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      return lum > 140 ? '#000000' : '#ffffff';
    };
    const bg = pickContrast(fill);

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, MAX_THUMB, MAX_THUMB);

    // Prefer the rasterized svgPath (e.g. text converted to a shape) so complex
    // glyph paths with interior holes render correctly. Fall back to the simple
    // points-based path otherwise.
    const svgPath = shapeData.svgPath as string | undefined;
    if (svgPath) {
      const p = new Path2D(svgPath);
      const fillRule = shapeData.fillRule === 'nonzero' ? 'nonzero' : 'evenodd';
      // Compute bounds from the path via a temporary measure.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const re = /(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
      let m: RegExpExecArray | null;
      const nums: number[] = [];
      while ((m = re.exec(svgPath)) !== null) nums.push(parseFloat(m[1]));
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = nums[i], y = nums[i + 1];
        if (x < minX) minX = x; if (y < minY) minY = y;
        if (x > maxX) maxX = x; if (y > maxY) maxY = y;
      }
      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 1; maxY = 1; }

      const padding = 4;
      const availW = MAX_THUMB - padding * 2;
      const availH = MAX_THUMB - padding * 2;
      const shapeW = (maxX - minX) || 1;
      const shapeH = (maxY - minY) || 1;
      const scale = Math.min(availW / shapeW, availH / shapeH);
      const offsetX = padding + (availW - shapeW * scale) / 2 - minX * scale;
      const offsetY = padding + (availH - shapeH * scale) / 2 - minY * scale;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.fillStyle = fill;
      ctx.fill(p, fillRule as CanvasFillRule);
      if (stroke && strokeWidth > 0) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = strokeWidth * scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke(p);
      }
      ctx.restore();
      lastKeyRef.current[layer.id] = key;
      updateLayer(layer.id, { thumbnail: tc.toDataURL() });
      return;
    }

    if (points.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      points.forEach((p: { x: number; y: number }) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });

      const padding = 4;
      const availW = MAX_THUMB - padding * 2;
      const availH = MAX_THUMB - padding * 2;
      const shapeW = maxX - minX || 1;
      const shapeH = maxY - minY || 1;
      const scale = Math.min(availW / shapeW, availH / shapeH);
      const offsetX = padding + (availW - shapeW * scale) / 2 - minX * scale;
      const offsetY = padding + (availH - shapeH * scale) / 2 - minY * scale;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);

      drawPathOnCanvas(ctx, points, closed, smooth, fill, stroke, strokeWidth * scale);

      ctx.restore();
      lastKeyRef.current[layer.id] = key;
      updateLayer(layer.id, { thumbnail: tc.toDataURL() });
      return;
    }

    ctx.fillStyle = fill;
    ctx.fillRect(4, 4, MAX_THUMB - 8, MAX_THUMB - 8);
    lastKeyRef.current[layer.id] = key;
    updateLayer(layer.id, { thumbnail: tc.toDataURL() });
    return;
  }

  // ── Image / DataUrl Layers (has dataUrl string) ────────────────────────
  if ((layer as any).dataUrl) {
    if (pendingRef.current[layer.id]) return;

    const refW = parentArtboard ? (parentArtboard.width || documentSize.w) : documentSize.w;
    const refH = parentArtboard ? (parentArtboard.height || documentSize.h) : documentSize.h;
    const { w: thumbW, h: thumbH } = thumbSize(refW, refH);
    const capturedKey = key;

    pendingRef.current[layer.id] = true;
    const img = new Image();
    img.onload = () => {
      pendingRef.current[layer.id] = false;
      lastKeyRef.current[layer.id] = capturedKey;

      const tc = document.createElement('canvas');
      tc.width = thumbW; tc.height = thumbH;
      const ctx = tc.getContext('2d');
      if (!ctx) return;

      const scaleX = thumbW / refW;
      const scaleY = thumbH / refH;
      const layerW = (layer.width && layer.width > 0) ? layer.width : refW;
      const layerH = (layer.height && layer.height > 0) ? layer.height : refH;
      const destX = (layer.position?.x || 0) * scaleX;
      const destY = (layer.position?.y || 0) * scaleY;
      const destW = layerW * scaleX;
      const destH = layerH * scaleY;

      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
        destX, destY, destW, destH);
      updateLayer(layer.id, { thumbnail: tc.toDataURL() });
    };
    img.onerror = () => { pendingRef.current[layer.id] = false; };
    img.src = (layer as any).dataUrl;
    return;
  }

  // ── Paint / Live DOM Canvas Fallback Layers ────────────────────────────
  const liveCanvas = canvasRefs.current[layer.id];
  if (liveCanvas && liveCanvas.width > 0 && liveCanvas.height > 0) {
    lastKeyRef.current[layer.id] = key;
    const refW = parentArtboard ? (parentArtboard.width || documentSize.w) : documentSize.w;
    const refH = parentArtboard ? (parentArtboard.height || documentSize.h) : documentSize.h;
    const { w: thumbW, h: thumbH } = thumbSize(refW, refH);
    const tc = document.createElement('canvas');
    tc.width = thumbW;
    tc.height = thumbH;
    const ctx = tc.getContext('2d');
    if (!ctx) return;

    const scaleX = thumbW / refW;
    const scaleY = thumbH / refH;
    const layerW = (layer.width && layer.width > 0) ? layer.width : refW;
    const layerH = (layer.height && layer.height > 0) ? layer.height : refH;
    const destX = (layer.position?.x || 0) * scaleX;
    const destY = (layer.position?.y || 0) * scaleY;
    const destW = layerW * scaleX;
    const destH = layerH * scaleY;

    ctx.drawImage(
      liveCanvas,
      0,
      0,
      liveCanvas.width,
      liveCanvas.height,
      destX,
      destY,
      destW,
      destH
    );
    updateLayer(layer.id, { thumbnail: tc.toDataURL() });
    return;
  }
};

export const useThumbnailGeneration = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void
) => {
  const lastKeyRef = useRef<{ [key: string]: string }>({});
  const pendingRef = useRef<{ [key: string]: boolean }>({});
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentIds = new Set(layers.map(l => l.id));
    knownIdsRef.current.forEach(id => {
      if (!currentIds.has(id)) delete lastKeyRef.current[id];
    });
    knownIdsRef.current = currentIds;

    layers.forEach(layer => {
      generateThumbnail(layer, documentSize, canvasRefs, updateLayer, lastKeyRef, pendingRef);
    });
  }, [layers, updateLayer, documentSize]);
};

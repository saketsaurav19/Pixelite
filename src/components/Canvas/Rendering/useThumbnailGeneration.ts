import { useEffect, useRef } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

const MAX_THUMB = 48;

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
    (layer as any).shapeData?.fill ?? '',
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
    lastKeyRef.current[layer.id] = key;
    const tc = document.createElement('canvas');
    tc.width = MAX_THUMB; tc.height = MAX_THUMB;
    const ctx = tc.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = (layer as any).shapeData?.fill || '#888888';
    ctx.fillRect(0, 0, MAX_THUMB, MAX_THUMB);
    const c = canvasRefs.current[layer.id];
    if (c) {
      const { w: dw, h: dh } = thumbSize(c.width, c.height);
      ctx.drawImage(c, 0, 0, c.width, c.height,
        (MAX_THUMB - dw) / 2, (MAX_THUMB - dh) / 2, dw, dh);
    }
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

  useEffect(() => {
    const timer = setTimeout(() => {
      layers.forEach(layer => {
        generateThumbnail(layer, documentSize, canvasRefs, updateLayer, lastKeyRef, pendingRef);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [layers, updateLayer, documentSize]);
};

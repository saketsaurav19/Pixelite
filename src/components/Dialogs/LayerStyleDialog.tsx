/**
 * Layer Style dialog — MU-2 rewire.
 *
 * Effects are pure store data now. Every control writes live to the store
 * (`updateLayerEffects` for effect parameters, `updateLayer` for blending
 * options) with no per-tick history, so the document updates in real time.
 * - On open: a deep clone of `activeLayer.effects` (or the model defaults) is
 *   snapshotted into a ref, along with opacity / fill / blendMode.
 * - On Apply: a single `recordHistory('Layer Styles')` entry is recorded; the
 *   store already holds the final values.
 * - On Cancel (or overlay click): the snapshot is restored with
 *   `setLayerEffects` + `updateLayer`. No history entry.
 *
 * The old destructive canvas-bake path is gone: no canvas resizing, no
 * backup/restore machinery, no baking effects into layer pixels. The only
 * canvas code left is the small 200x150 preview, which renders from the
 * CURRENT STORE values using a read-only preview-only copy of the layer
 * artwork. The real layer canvas is never touched.
 *
 * OUT OF SCOPE — kept as non-functional UI (local state only, not backed by
 * the LayerEffects model; separate Photoshop sub-features):
 * - Contour tab, Texture tab, Stroke Style tab, 3D tab.
 * - Blending tab extras: Channels toggles and Blend If (no model backing).
 * - Trimmed single controls with no model field (e.g. Drop Shadow noise,
 *   glow Technique/Range, Bevel contour/gloss/global-light) were removed;
 *   see TRIMMED_CONTROLS in src/utils/layerEffects.ts.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import { DEFAULT_LAYER_EFFECTS } from '../../utils/layerEffects';
import type { LayerEffects, BlendMode, BevelStyle, BevelTechnique } from '../../store/types';
import './Dialogs.css';

export const EFFECT_LIST = [
  { key: 'bevelAndEmboss', label: 'Bevel and Emboss' },
  { key: 'contour', label: 'Contour' },
  { key: 'texture', label: 'Texture' },
  { key: 'stroke', label: 'Stroke' },
  { key: 'dropShadow', label: 'Drop Shadow' },
  { key: 'innerShadow', label: 'Inner Shadow' },
  { key: 'innerGlow', label: 'Inner Glow' },
  { key: 'outerGlow', label: 'Outer Glow' },
  { key: 'satin', label: 'Satin' },
  { key: 'colorOverlay', label: 'Color Overlay' },
  { key: 'gradientOverlay', label: 'Gradient Overlay' },
  { key: 'patternOverlay', label: 'Pattern Overlay' },
  { key: 'strokeStyle', label: 'Stroke' },
  { key: 'd3d', label: '3D' },
] as const;

type EffectKey = (typeof EFFECT_LIST)[number]['key'];

/** Effect keys backed by the LayerEffects store model (MU-2). */
const MODEL_EFFECT_KEYS = [
  'bevelAndEmboss',
  'stroke',
  'dropShadow',
  'innerShadow',
  'innerGlow',
  'outerGlow',
  'satin',
  'colorOverlay',
  'gradientOverlay',
  'patternOverlay',
] as const;

type ModelEffectKey = (typeof MODEL_EFFECT_KEYS)[number];

const isModelEffectKey = (key: EffectKey): key is ModelEffectKey =>
  (MODEL_EFFECT_KEYS as readonly string[]).includes(key);

/** Merge store values over the model defaults so every field is always defined. */
const normalizeEffects = (e: LayerEffects | undefined): LayerEffects => ({
  dropShadow: { ...DEFAULT_LAYER_EFFECTS.dropShadow, ...e?.dropShadow },
  innerShadow: { ...DEFAULT_LAYER_EFFECTS.innerShadow, ...e?.innerShadow },
  outerGlow: { ...DEFAULT_LAYER_EFFECTS.outerGlow, ...e?.outerGlow },
  innerGlow: { ...DEFAULT_LAYER_EFFECTS.innerGlow, ...e?.innerGlow },
  bevelAndEmboss: { ...DEFAULT_LAYER_EFFECTS.bevelAndEmboss, ...e?.bevelAndEmboss },
  satin: { ...DEFAULT_LAYER_EFFECTS.satin, ...e?.satin },
  colorOverlay: { ...DEFAULT_LAYER_EFFECTS.colorOverlay, ...e?.colorOverlay },
  gradientOverlay: { ...DEFAULT_LAYER_EFFECTS.gradientOverlay, ...e?.gradientOverlay },
  patternOverlay: { ...DEFAULT_LAYER_EFFECTS.patternOverlay, ...e?.patternOverlay },
  stroke: { ...DEFAULT_LAYER_EFFECTS.stroke, ...e?.stroke },
});

const hexToRgba = (hex: string, alpha: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Pre-dialog values restored on Cancel. */
interface StyleDialogSnapshot {
  effects: LayerEffects | undefined;
  opacity: number; // 0-1
  fill: number | undefined; // 0-1
  blendMode: BlendMode;
}

export const LayerStyleDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isLayerStyleDialogOpen,
    setIsLayerStyleDialogOpen,
    layerStyleActiveTab,
    setLayerStyleActiveTab,
    activeLayerId,
    updateLayer,
    updateLayerEffects,
    setLayerEffects,
    recordHistory,
    layers,
  } = useStore();

  const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;

  // Live store-backed values (normalized over model defaults).
  const fx = normalizeEffects(activeLayer?.effects);
  const opacityPct = Math.round((activeLayer?.opacity ?? 1) * 100);
  const fillPct = Math.round((activeLayer?.fill ?? 1) * 100);
  const blendModeValue: BlendMode = activeLayer?.blendMode ?? 'source-over';

  /** Write one effect's fields live to the store (deep-merged per effect key). */
  const writeFx = (key: ModelEffectKey, patch: object): void => {
    if (!activeLayerId) return;
    updateLayerEffects(activeLayerId, { [key]: patch } as unknown as Partial<LayerEffects>);
  };

  /** Write blending options live to the store. */
  const writeBlending = (patch: { opacity?: number; fill?: number; blendMode?: BlendMode }): void => {
    if (!activeLayerId) return;
    updateLayer(activeLayerId, patch);
  };

  // Cancel snapshot (deep clone taken on open).
  const snapshotRef = useRef<StyleDialogSnapshot | null>(null);
  // Read-only artwork copy used ONLY by the small preview canvas.
  const previewSourceRef = useRef<HTMLCanvasElement | null>(null);

  // --- Non-functional UI state (out of scope for MU-2; kept as-is) ---
  // Blending tab extras with no model backing.
  const [fillChannels, setFillChannels] = useState({ r: true, g: true, b: true });
  const [blendIf, setBlendIf] = useState<'gray' | 'r' | 'g' | 'b'>('gray');
  const [blendIfRange, setBlendIfRange] = useState({ underlyingLow: 0, underlyingHigh: 255, blendLow: 0, blendHigh: 255 });
  // Effect-list checkboxes for the tabs not backed by the model.
  const [legacyToggles, setLegacyToggles] = useState<Record<string, boolean>>({});

  // Contour settings (out of scope — local UI only)
  const [contourColor, setContourColor] = useState('#000000');
  const [contourOpacity, setContourOpacity] = useState(75);
  const [contourRange, setContourRange] = useState(50);
  const [contourEdge, setContourEdge] = useState<'inside' | 'outside' | 'center'>('inside');
  const [contourShape, setContourShape] = useState<string>('linear');
  const [contourNoise, setContourNoise] = useState(0);
  const [contourAntiAliased, setContourAntiAliased] = useState(true);

  // Texture settings (out of scope — local UI only)
  const [texturePattern, setTexturePattern] = useState<string>('brick');
  const [textureScale, setTextureScale] = useState(100);
  const [textureDepth, setTextureDepth] = useState(50);
  const [textureInvert, setTextureInvert] = useState(false);
  const [textureLinkToLayer, setTextureLinkToLayer] = useState(true);
  const [textureOpacity, setTextureOpacity] = useState(100);

  // Stroke Style tab (out of scope — local UI only; separate from the Stroke effect)
  const [ssSize, setSsSize] = useState(3);
  const [ssColor, setSsColor] = useState('#ff0000');
  const [ssOpacity, setSsOpacity] = useState(100);
  const [ssPosition, setSsPosition] = useState<'outside' | 'inside' | 'center'>('outside');

  /**
   * Capture a read-only copy of the layer artwork for the preview only.
   * The real layer canvas is never resized, baked, or otherwise mutated.
   */
  const capturePreviewSource = useCallback((): void => {
    const layerCanvas = document.querySelector(
      `canvas[data-layer-id="${activeLayerId}"]`
    ) as HTMLCanvasElement | null;
    const src = document.createElement('canvas');
    if (layerCanvas && layerCanvas.width > 0 && layerCanvas.height > 0) {
      src.width = layerCanvas.width;
      src.height = layerCanvas.height;
      src.getContext('2d')?.drawImage(layerCanvas, 0, 0);
    } else {
      // Fallback shape so effect controls still show something in the preview.
      src.width = 120;
      src.height = 90;
      const c = src.getContext('2d');
      if (c) {
        c.fillStyle = '#4a90d9';
        c.fillRect(20, 18, 80, 54);
      }
    }
    previewSourceRef.current = src;
  }, [activeLayerId]);

  // Snapshot on open: deep-clone store values so Cancel can restore them.
  useEffect(() => {
    if (!isLayerStyleDialogOpen || !activeLayerId) return;
    const layer = findLayerById(useStore.getState().layers, activeLayerId);
    snapshotRef.current = {
      effects: layer?.effects ? (structuredClone(layer.effects) as LayerEffects) : undefined,
      opacity: layer?.opacity ?? 1,
      fill: layer?.fill,
      blendMode: layer?.blendMode ?? 'source-over',
    };
    setLayerStyleActiveTab('blending');
    capturePreviewSource();
  }, [isLayerStyleDialogOpen, activeLayerId, setLayerStyleActiveTab, capturePreviewSource]);

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Preview-only effect renderer. Paints the base artwork plus the enabled
   * style effects onto the given context, reading parameters from `fxNow`
   * (current store values). Never touches the real layer canvas.
   */
  const renderPreviewEffects = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    fxNow: LayerEffects,
    src: HTMLCanvasElement,
    opacityNow: number // 0-1
  ): void => {
    ctx.save();
    ctx.globalAlpha = opacityNow;

    // Draw base layer content first (single source of truth for the shape)
    ctx.drawImage(src, 0, 0);

    // Drop Shadow
    if (fxNow.dropShadow.enabled) {
      ctx.save();
      const rad = (fxNow.dropShadow.angle * Math.PI) / 180;
      ctx.shadowColor = hexToRgba(fxNow.dropShadow.color, fxNow.dropShadow.opacity / 100);
      ctx.shadowBlur = fxNow.dropShadow.size;
      ctx.shadowOffsetX = fxNow.dropShadow.distance * Math.cos(rad);
      ctx.shadowOffsetY = fxNow.dropShadow.distance * Math.sin(rad);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    }

    // Inner Shadow
    if (fxNow.innerShadow.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const rad = (fxNow.innerShadow.angle * Math.PI) / 180;

      tCtx.drawImage(src, 0, 0);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = fxNow.innerShadow.color;
      tCtx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.clip();
      ctx.shadowColor = hexToRgba(fxNow.innerShadow.color, fxNow.innerShadow.opacity / 100);
      ctx.shadowBlur = fxNow.innerShadow.size;
      ctx.shadowOffsetX = fxNow.innerShadow.distance * Math.cos(rad);
      ctx.shadowOffsetY = fxNow.innerShadow.distance * Math.sin(rad);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Outer Glow
    if (fxNow.outerGlow.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * fxNow.outerGlow.size);
        const dy = Math.round(Math.sin(angle) * fxNow.outerGlow.size);
        tCtx.drawImage(src, dx, dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = fxNow.outerGlow.color;
      tCtx.globalAlpha = fxNow.outerGlow.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Color Overlay
    if (fxNow.colorOverlay.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = fxNow.colorOverlay.color;
      tCtx.globalAlpha = fxNow.colorOverlay.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Gradient Overlay
    if (fxNow.gradientOverlay.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);
      tCtx.globalCompositeOperation = 'source-in';

      const stops = fxNow.gradientOverlay.stops;
      const grad = tCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, stops[0]?.color ?? '#ff0000');
      grad.addColorStop(1, stops[stops.length - 1]?.color ?? '#0000ff');
      tCtx.fillStyle = grad;
      tCtx.globalAlpha = fxNow.gradientOverlay.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Inner Glow
    if (fxNow.innerGlow.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);

      ctx.save();
      ctx.clip();
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * fxNow.innerGlow.size);
        const dy = Math.round(Math.sin(angle) * fxNow.innerGlow.size);
        tCtx.drawImage(src, dx, dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = fxNow.innerGlow.color;
      tCtx.globalAlpha = fxNow.innerGlow.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Satin
    if (fxNow.satin.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);
      tCtx.globalCompositeOperation = 'overlay';
      tCtx.fillStyle = fxNow.satin.color;
      tCtx.globalAlpha = fxNow.satin.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Pattern Overlay
    if (fxNow.patternOverlay.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = '#666';
      tCtx.globalAlpha = fxNow.patternOverlay.opacity / 100;
      const ps = 10;
      for (let x = 0; x < w; x += ps) {
        for (let y = 0; y < h; y += ps) {
          tCtx.fillRect(x, y, ps / 2, ps / 2);
        }
      }
      ctx.drawImage(temp, 0, 0);
    }

    // Stroke
    if (fxNow.stroke.enabled) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const steps = 32;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * fxNow.stroke.size);
        const dy = Math.round(Math.sin(angle) * fxNow.stroke.size);
        tCtx.drawImage(src, dx, dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = fxNow.stroke.color;
      tCtx.globalAlpha = fxNow.stroke.opacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Bevel and Emboss
    if (fxNow.bevelAndEmboss.enabled) {
      const bevel = fxNow.bevelAndEmboss;
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);

      ctx.save();

      // Use globalCompositeOperation to simulate emboss
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = bevel.depth / 100;

      // Outer bevel - highlight top-left, shadow bottom-right
      const rad = (bevel.angle * Math.PI) / 180;
      const highlightX = -Math.cos(rad) * bevel.size;
      const highlightY = -Math.sin(rad) * bevel.size;
      const shadowX = Math.cos(rad) * bevel.size;
      const shadowY = Math.sin(rad) * bevel.size;

      // Draw highlight layer
      if (bevel.style === 'innerBevel') {
        ctx.globalCompositeOperation = (bevel.highlightMode === 'screen' ? 'lighten' : bevel.highlightMode) as GlobalCompositeOperation;
        ctx.globalAlpha = (bevel.highlightOpacity / 100) * (bevel.depth / 100);
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = bevel.size;
        ctx.shadowOffsetX = highlightX;
        ctx.shadowOffsetY = highlightY;
        ctx.drawImage(temp, 0, 0);

        // Draw shadow layer
        ctx.globalCompositeOperation = (bevel.shadowMode === 'multiply' ? 'darken' : bevel.shadowMode) as GlobalCompositeOperation;
        ctx.globalAlpha = (bevel.shadowOpacity / 100) * (bevel.depth / 100);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = shadowX;
        ctx.shadowOffsetY = shadowY;
        ctx.drawImage(temp, 0, 0);
      } else {
        // Outer bevel
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = bevel.size;
        ctx.shadowOffsetX = highlightX;
        ctx.shadowOffsetY = highlightY;
        ctx.globalCompositeOperation = bevel.highlightMode as GlobalCompositeOperation;
        ctx.globalAlpha = (bevel.highlightOpacity / 100) * (bevel.depth / 100);
        ctx.drawImage(temp, 0, 0);
      }

      ctx.restore();
    }

    // Contour effect (out of scope — local UI state only)
    if (legacyToggles.contour) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);

      ctx.save();
      ctx.clip();

      // Create contour by drawing a gradient around the shape
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const opacity = (contourOpacity / 100) * Math.sin(t * Math.PI * parseInt(contourShape === 'linear' ? '1' : contourShape === 'sCurve' ? '3' : '2') * contourRange / 100);
        gradient.addColorStop(t, `rgba(0,0,0,${Math.max(0, opacity)})`);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = contourOpacity / 100;
      ctx.fillStyle = contourColor;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // Texture effect (out of scope — local UI state only)
    if (legacyToggles.texture) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(src, 0, 0);

      // Draw pattern texture with source-in to clip to layer shape
      const textureScaleFactor = textureScale / 100;
      const patternSize = Math.max(4, Math.floor(20 * textureScaleFactor));

      tCtx.globalCompositeOperation = 'source-in';
      tCtx.globalAlpha = textureOpacity / 100;

      // Fill with pattern color first
      if (textureInvert) {
        tCtx.fillStyle = '#000';
      } else {
        tCtx.fillStyle = '#fff';
      }
      tCtx.fillRect(0, 0, w, h);

      // Draw pattern overlay based on selected pattern
      const patternColor = textureInvert ? '#fff' : '#000';
      tCtx.fillStyle = patternColor;
      tCtx.globalAlpha = (textureOpacity / 100) * (textureDepth / 100);

      switch (texturePattern) {
        case 'brick':
          for (let y = 0; y < h + patternSize; y += patternSize) {
            const offsetX = (Math.floor(y / patternSize) % 2) * (patternSize / 2);
            for (let x = 0; x < w + patternSize; x += patternSize) {
              tCtx.fillRect(x + offsetX, y, patternSize, patternSize);
            }
          }
          break;
        case 'dots':
          for (let y = patternSize / 2; y < h + patternSize; y += patternSize) {
            for (let x = patternSize / 2; x < w + patternSize; x += patternSize) {
              tCtx.beginPath();
              tCtx.arc(x, y, patternSize / 4, 0, Math.PI * 2);
              tCtx.fill();
            }
          }
          break;
        case 'grid':
          for (let y = 0; y <= h; y += patternSize / 2) {
            tCtx.fillRect(0, y, w, 1);
          }
          for (let x = 0; x <= w; x += patternSize / 2) {
            tCtx.fillRect(x, 0, 1, h);
          }
          break;
        case 'waves':
          for (let y = 0; y < h; y += patternSize) {
            tCtx.beginPath();
            for (let x = 0; x <= w; x += 2) {
              const wave = Math.sin((x / patternSize) * Math.PI * 2) * (patternSize / 4);
              if (x === 0) tCtx.moveTo(x, y + wave);
              else tCtx.lineTo(x, y + wave);
            }
            tCtx.stroke();
          }
          break;
        case 'noise':
          for (let i = 0; i < (w * h) / 100; i++) {
            const nx = Math.random() * w;
            const ny = Math.random() * h;
            tCtx.fillRect(nx, ny, 1, 1);
          }
          break;
        case 'crosshatch':
          for (let y = 0; y < h + w; y += patternSize) {
            tCtx.beginPath();
            tCtx.moveTo(0, y);
            tCtx.lineTo(Math.min(w, y), 0);
            tCtx.stroke();
          }
          for (let x = 0; x < w + h; x += patternSize) {
            tCtx.beginPath();
            tCtx.moveTo(x, 0);
            tCtx.lineTo(0, Math.min(h, x));
            tCtx.stroke();
          }
          break;
      }

      ctx.drawImage(temp, 0, 0);
    }

    ctx.restore();
  };

  /**
   * Repaint the small preview canvas from current store values. Uses fresh
   * store state (not render-closure values) so slider ticks redraw correctly.
   */
  const renderPreview = useCallback((): void => {
    const previewCanvas = document.getElementById('layer-style-preview') as HTMLCanvasElement | null;
    if (!previewCanvas) return;
    const pCtx = previewCanvas.getContext('2d');
    if (!pCtx) return;
    const src = previewSourceRef.current;
    if (!src) return;

    const w = previewCanvas.width;
    const h = previewCanvas.height;

    pCtx.clearRect(0, 0, w, h);
    pCtx.fillStyle = '#2a2a2a';
    pCtx.fillRect(0, 0, w, h);
    const tileSize = 8;
    for (let x = 0; x < w; x += tileSize) {
      for (let y = 0; y < h; y += tileSize) {
        pCtx.fillStyle = (x + y) % (tileSize * 2) === 0 ? '#555' : '#3a3a3a';
        pCtx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Scale the rendered output to fit the 200x150 preview while preserving
    // the layer's aspect ratio, so the whole shape (and any outer effects)
    // remain visible and centered.
    const srcW = src.width;
    const srcH = src.height;
    const scale = Math.min(w / srcW, h / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawH) / 2;

    const st = useStore.getState();
    const layer = activeLayerId ? findLayerById(st.layers, activeLayerId) : undefined;

    pCtx.save();
    pCtx.translate(offsetX, offsetY);
    pCtx.scale(scale, scale);
    renderPreviewEffects(pCtx, srcW, srcH, normalizeEffects(layer?.effects), src, layer?.opacity ?? 1);
    pCtx.restore();
  }, [activeLayerId]);

  // Redraw the preview whenever the dialog is open and any backing value changes.
  useEffect(() => {
    if (!isLayerStyleDialogOpen) return;
    const raf = requestAnimationFrame(() => renderPreview());
    return () => cancelAnimationFrame(raf);
  }, [
    isLayerStyleDialogOpen, activeLayerId, renderPreview,
    activeLayer?.effects, activeLayer?.opacity,
    // Out-of-scope tabs still preview locally.
    legacyToggles,
    contourColor, contourOpacity, contourRange, contourShape,
    texturePattern, textureScale, textureDepth, textureInvert, textureOpacity,
  ]);

  if (!isLayerStyleDialogOpen || !activeLayer) return null;

  const toggleEffect = (key: EffectKey): void => {
    if (isModelEffectKey(key)) {
      writeFx(key, { enabled: !fx[key].enabled });
    } else {
      // Out-of-scope tabs: checkbox only, no store backing.
      setLegacyToggles((prev) => ({ ...prev, [key]: !prev[key] }));
    }
    setLayerStyleActiveTab(key);
  };

  const isEffectChecked = (key: EffectKey): boolean =>
    isModelEffectKey(key) ? fx[key].enabled : !!legacyToggles[key];

  const handleApply = (): void => {
    // All values already live in the store; record a single history entry.
    recordHistory('Layer Styles');
    snapshotRef.current = null;
    setIsLayerStyleDialogOpen(false);
  };

  const handleCancel = (): void => {
    // Restore the pre-dialog snapshot. No history entry.
    const snap = snapshotRef.current;
    if (activeLayerId && snap) {
      setLayerEffects(
        activeLayerId,
        snap.effects ? (structuredClone(snap.effects) as LayerEffects) : undefined
      );
      updateLayer(activeLayerId, {
        opacity: snap.opacity,
        fill: snap.fill,
        blendMode: snap.blendMode,
      });
    }
    snapshotRef.current = null;
    setIsLayerStyleDialogOpen(false);
  };

  return (
    <div className="dialog-overlay filter-gallery-overlay" onClick={handleCancel}>
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="layer-style-dialog"
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? {} : { width: '820px' }}
      >
        {/* Header */}
        <div
          className="dialog-header drag-handle layer-style-header"
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h3>Layer Style</h3>
          <div className="layer-style-header-actions">
            <button className="btn btn-sm btn-secondary" onClick={handleCancel}>
              Cancel
            </button>
            <button className="btn btn-sm btn-primary" onClick={handleApply}>
              OK
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="layer-style-body">
          {/* Left: Effects List */}
          <div className="layer-style-effects-list">
            {EFFECT_LIST.map(({ key, label }) => (
              <label key={key} className={`layer-style-effect-item ${(key === 'contour' || key === 'texture') ? 'layer-style-effect-sub-item' : ''} ${isEffectChecked(key) ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={isEffectChecked(key)}
                  onChange={() => toggleEffect(key)}
                />
                <span className="layer-style-effect-label">{label}</span>
              </label>
            ))}
          </div>

          {/* Middle: Settings Panel */}
          <div className="layer-style-settings">
            {layerStyleActiveTab === 'blending' && (
              <>
                <h4 className="settings-title">Blending Options</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select
                      className="setting-select"
                      value={blendModeValue}
                      onChange={(e) => writeBlending({ blendMode: e.target.value as BlendMode })}
                    >
                      <option value="source-over">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="darken">Darken</option>
                      <option value="lighten">Lighten</option>
                      <option value="color-dodge">Color Dodge</option>
                      <option value="color-burn">Color Burn</option>
                      <option value="hard-light">Hard Light</option>
                      <option value="soft-light">Soft Light</option>
                      <option value="difference">Difference</option>
                      <option value="exclusion">Exclusion</option>
                      <option value="hue">Hue</option>
                      <option value="saturation">Saturation</option>
                      <option value="color">Color</option>
                      <option value="luminosity">Luminosity</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={opacityPct}
                        onChange={(e) => writeBlending({ opacity: parseInt(e.target.value) / 100 })}
                        className="setting-slider"
                      />
                      <span className="setting-value">{opacityPct}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Fill Opacity</label>
                    <div className="setting-slider-row">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={fillPct}
                        onChange={(e) => writeBlending({ fill: parseInt(e.target.value) / 100 })}
                        className="setting-slider"
                      />
                      <span className="setting-value">{fillPct}%</span>
                    </div>
                  </div>
                  <div className="setting-row channels-row">
                    <label className="setting-label">Channels</label>
                    <div className="channel-toggles">
                      <label className="channel-toggle">
                        <input type="checkbox" checked={fillChannels.r} onChange={(e) => setFillChannels({ ...fillChannels, r: e.target.checked })} />
                        <span>R</span>
                      </label>
                      <label className="channel-toggle">
                        <input type="checkbox" checked={fillChannels.g} onChange={(e) => setFillChannels({ ...fillChannels, g: e.target.checked })} />
                        <span>G</span>
                      </label>
                      <label className="channel-toggle">
                        <input type="checkbox" checked={fillChannels.b} onChange={(e) => setFillChannels({ ...fillChannels, b: e.target.checked })} />
                        <span>B</span>
                      </label>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend If</label>
                    <select
                      className="setting-select blendif-select"
                      value={blendIf}
                      onChange={(e) => setBlendIf(e.target.value as any)}
                    >
                      <option value="gray">Gray</option>
                      <option value="r">Red</option>
                      <option value="g">Green</option>
                      <option value="b">Blue</option>
                    </select>
                    <span className="blendif-values">
                      <span>{blendIfRange.underlyingLow}</span>
                      <input
                        type="range"
                        className="blendif-range"
                        min="0"
                        max="255"
                        value={blendIfRange.underlyingLow}
                        onChange={(e) => setBlendIfRange({ ...blendIfRange, underlyingLow: parseInt(e.target.value) })}
                      />
                      <span>{blendIfRange.underlyingHigh}</span>
                      <span className="blendif-separator">255</span>
                    </span>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'dropShadow' && (
              <>
                <h4 className="settings-title">Drop Shadow</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.dropShadow.color} onChange={(e) => writeFx('dropShadow', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.dropShadow.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.dropShadow.opacity} onChange={(e) => writeFx('dropShadow', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.dropShadow.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={fx.dropShadow.angle} onChange={(e) => writeFx('dropShadow', { angle: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.dropShadow.angle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={fx.dropShadow.distance} onChange={(e) => writeFx('dropShadow', { distance: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.dropShadow.distance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={fx.dropShadow.size} onChange={(e) => writeFx('dropShadow', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.dropShadow.size}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Spread</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.dropShadow.spread} onChange={(e) => writeFx('dropShadow', { spread: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.dropShadow.spread}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'innerShadow' && (
              <>
                <h4 className="settings-title">Inner Shadow</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.innerShadow.color} onChange={(e) => writeFx('innerShadow', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.innerShadow.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.innerShadow.opacity} onChange={(e) => writeFx('innerShadow', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerShadow.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={fx.innerShadow.angle} onChange={(e) => writeFx('innerShadow', { angle: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerShadow.angle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={fx.innerShadow.distance} onChange={(e) => writeFx('innerShadow', { distance: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerShadow.distance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={fx.innerShadow.size} onChange={(e) => writeFx('innerShadow', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerShadow.size}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Choke</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.innerShadow.choke} onChange={(e) => writeFx('innerShadow', { choke: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerShadow.choke}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'stroke' && (
              <>
                <h4 className="settings-title">Stroke</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="50" value={fx.stroke.size} onChange={(e) => writeFx('stroke', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.stroke.size}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.stroke.color} onChange={(e) => writeFx('stroke', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.stroke.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.stroke.opacity} onChange={(e) => writeFx('stroke', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.stroke.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Position</label>
                    <div className="position-toggles">
                      {(['outside', 'inside', 'center'] as const).map(pos => (
                        <button
                          key={pos}
                          className={`position-btn ${fx.stroke.position === pos ? 'active' : ''}`}
                          onClick={() => writeFx('stroke', { position: pos })}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={fx.stroke.blendMode} onChange={(e) => writeFx('stroke', { blendMode: e.target.value })}>
                      <option value="source-over">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'bevelAndEmboss' && (
              <>
                <h4 className="settings-title">Bevel &amp; Emboss</h4>
                <div className="settings-section">
                  {/* Structure Sub-group */}
                  <div className="settings-subgroup">
                    <h5 className="subgroup-title">Structure</h5>
                    <div className="setting-row">
                      <label className="setting-label">Style</label>
                      <select className="setting-select" value={fx.bevelAndEmboss.style} onChange={(e) => writeFx('bevelAndEmboss', { style: e.target.value as BevelStyle })}>
                        <option value="innerBevel">Inner Bevel</option>
                        <option value="outerBevel">Outer Bevel</option>
                        <option value="emboss">Emboss</option>
                        <option value="pillowEmboss">Pillow Emboss</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Technique</label>
                      <select className="setting-select" value={fx.bevelAndEmboss.technique} onChange={(e) => writeFx('bevelAndEmboss', { technique: e.target.value as BevelTechnique })}>
                        <option value="smooth">Smooth</option>
                        <option value="chiselHard">Chisel Hard</option>
                        <option value="chiselSoft">Chisel Soft</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Depth</label>
                      <div className="setting-slider-row">
                        <input type="range" min="1" max="250" value={fx.bevelAndEmboss.depth} onChange={(e) => writeFx('bevelAndEmboss', { depth: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.depth}%</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Size</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="50" value={fx.bevelAndEmboss.size} onChange={(e) => writeFx('bevelAndEmboss', { size: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.size}px</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Soften</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="20" value={fx.bevelAndEmboss.soften} onChange={(e) => writeFx('bevelAndEmboss', { soften: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.soften}px</span>
                      </div>
                    </div>
                  </div>

                  {/* Shading Sub-group */}
                  <div className="settings-subgroup">
                    <h5 className="subgroup-title">Shading</h5>
                    <div className="setting-row">
                      <label className="setting-label">Angle</label>
                      <div className="setting-slider-row">
                        <input type="range" min="-180" max="180" value={fx.bevelAndEmboss.angle} onChange={(e) => writeFx('bevelAndEmboss', { angle: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.angle}°</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Altitude</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="90" value={fx.bevelAndEmboss.altitude} onChange={(e) => writeFx('bevelAndEmboss', { altitude: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.altitude}°</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Highlight Mode</label>
                      <select className="setting-select" value={fx.bevelAndEmboss.highlightMode} onChange={(e) => writeFx('bevelAndEmboss', { highlightMode: e.target.value })}>
                        <option value="screen">Screen</option>
                        <option value="multiply">Multiply</option>
                        <option value="overlay">Overlay</option>
                        <option value="normal">Normal</option>
                        <option value="softLight">Soft Light</option>
                        <option value="hardLight">Hard Light</option>
                        <option value="colorDodge">Color Dodge</option>
                        <option value="linearDodge">Linear Dodge</option>
                        <option value="pinLight">Pin Light</option>
                        <option value="vividLight">Vivid Light</option>
                        <option value="difference">Difference</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Highlight Opacity</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="100" value={fx.bevelAndEmboss.highlightOpacity} onChange={(e) => writeFx('bevelAndEmboss', { highlightOpacity: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.highlightOpacity}%</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Shadow Mode</label>
                      <select className="setting-select" value={fx.bevelAndEmboss.shadowMode} onChange={(e) => writeFx('bevelAndEmboss', { shadowMode: e.target.value })}>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                        <option value="normal">Normal</option>
                        <option value="softLight">Soft Light</option>
                        <option value="hardLight">Hard Light</option>
                        <option value="colorBurn">Color Burn</option>
                        <option value="linearBurn">Linear Burn</option>
                        <option value="pinLight">Pin Light</option>
                        <option value="vividLight">Vivid Light</option>
                        <option value="difference">Difference</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Shadow Opacity</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="100" value={fx.bevelAndEmboss.shadowOpacity} onChange={(e) => writeFx('bevelAndEmboss', { shadowOpacity: parseInt(e.target.value) })} className="setting-slider" />
                        <span className="setting-value">{fx.bevelAndEmboss.shadowOpacity}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'contour' && (
              <>
                <h4 className="settings-title">Contour</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={contourColor} onChange={(e) => setContourColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{contourColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={contourOpacity} onChange={(e) => setContourOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{contourOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Range</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={contourRange} onChange={(e) => setContourRange(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{contourRange}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Edge</label>
                    <div className="position-toggles">
                      {(['inside', 'outside', 'center'] as const).map(edge => (
                        <button
                          key={edge}
                          className={`position-btn ${contourEdge === edge ? 'active' : ''}`}
                          onClick={() => setContourEdge(edge)}
                        >
                          {edge}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Shape</label>
                    <select className="setting-select" value={contourShape} onChange={(e) => setContourShape(e.target.value)}>
                      <option value="linear">Linear</option>
                      <option value="sCurve">S-Curve</option>
                      <option value="cone">Cone</option>
                      <option value="coneInverted">Cone-Inverted</option>
                      <option value="cube">Cube</option>
                      <option value="halfRound">Half Round</option>
                      <option value="ringed">Ringed</option>
                      <option value="smooth">Smooth</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Noise</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={contourNoise} onChange={(e) => setContourNoise(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{contourNoise}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label checkbox-row">
                      <input type="checkbox" checked={contourAntiAliased} onChange={(e) => setContourAntiAliased(e.target.checked)} />
                      Anti-aliased
                    </label>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'texture' && (
              <>
                <h4 className="settings-title">Texture</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Pattern</label>
                    <select className="setting-select" value={texturePattern} onChange={(e) => setTexturePattern(e.target.value)}>
                      <option value="brick">Brick</option>
                      <option value="dots">Dots</option>
                      <option value="grid">Grid</option>
                      <option value="waves">Waves</option>
                      <option value="noise">Noise</option>
                      <option value="crosshatch">Crosshatch</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Scale</label>
                    <div className="setting-slider-row">
                      <input type="range" min="10" max="200" value={textureScale} onChange={(e) => setTextureScale(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{textureScale}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Depth</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={textureDepth} onChange={(e) => setTextureDepth(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{textureDepth}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={textureOpacity} onChange={(e) => setTextureOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{textureOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label checkbox-row">
                      <input type="checkbox" checked={textureInvert} onChange={(e) => setTextureInvert(e.target.checked)} />
                      Invert
                    </label>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label checkbox-row">
                      <input type="checkbox" checked={textureLinkToLayer} onChange={(e) => setTextureLinkToLayer(e.target.checked)} />
                      Link to Layer
                    </label>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'innerGlow' && (
              <>
                <h4 className="settings-title">Inner Glow</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.innerGlow.color} onChange={(e) => writeFx('innerGlow', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.innerGlow.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.innerGlow.opacity} onChange={(e) => writeFx('innerGlow', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerGlow.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.innerGlow.size} onChange={(e) => writeFx('innerGlow', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerGlow.size}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Choke</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.innerGlow.choke} onChange={(e) => writeFx('innerGlow', { choke: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.innerGlow.choke}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'outerGlow' && (
              <>
                <h4 className="settings-title">Outer Glow</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.outerGlow.color} onChange={(e) => writeFx('outerGlow', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.outerGlow.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.outerGlow.opacity} onChange={(e) => writeFx('outerGlow', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.outerGlow.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.outerGlow.size} onChange={(e) => writeFx('outerGlow', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.outerGlow.size}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Spread</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.outerGlow.spread} onChange={(e) => writeFx('outerGlow', { spread: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.outerGlow.spread}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'satin' && (
              <>
                <h4 className="settings-title">Satin</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.satin.color} onChange={(e) => writeFx('satin', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.satin.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.satin.opacity} onChange={(e) => writeFx('satin', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.satin.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={fx.satin.angle} onChange={(e) => writeFx('satin', { angle: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.satin.angle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.satin.distance} onChange={(e) => writeFx('satin', { distance: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.satin.distance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.satin.size} onChange={(e) => writeFx('satin', { size: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.satin.size}px</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'colorOverlay' && (
              <>
                <h4 className="settings-title">Color Overlay</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={fx.colorOverlay.color} onChange={(e) => writeFx('colorOverlay', { color: e.target.value })} className="color-input" />
                      <span className="setting-value">{fx.colorOverlay.color}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.colorOverlay.opacity} onChange={(e) => writeFx('colorOverlay', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.colorOverlay.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={fx.colorOverlay.blendMode} onChange={(e) => writeFx('colorOverlay', { blendMode: e.target.value })}>
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'gradientOverlay' && (
              <>
                <h4 className="settings-title">Gradient Overlay</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Start Color</label>
                    <div className="setting-controls">
                      <input
                        type="color"
                        value={fx.gradientOverlay.stops[0]?.color ?? '#ff0000'}
                        onChange={(e) => writeFx('gradientOverlay', {
                          stops: [
                            { offset: 0, color: e.target.value },
                            { offset: 1, color: fx.gradientOverlay.stops[1]?.color ?? '#0000ff' },
                          ],
                        })}
                        className="color-input"
                      />
                      <span className="setting-value">{fx.gradientOverlay.stops[0]?.color ?? '#ff0000'}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">End Color</label>
                    <div className="setting-controls">
                      <input
                        type="color"
                        value={fx.gradientOverlay.stops[1]?.color ?? '#0000ff'}
                        onChange={(e) => writeFx('gradientOverlay', {
                          stops: [
                            { offset: 0, color: fx.gradientOverlay.stops[0]?.color ?? '#ff0000' },
                            { offset: 1, color: e.target.value },
                          ],
                        })}
                        className="color-input"
                      />
                      <span className="setting-value">{fx.gradientOverlay.stops[1]?.color ?? '#0000ff'}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.gradientOverlay.opacity} onChange={(e) => writeFx('gradientOverlay', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.gradientOverlay.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={fx.gradientOverlay.angle} onChange={(e) => writeFx('gradientOverlay', { angle: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.gradientOverlay.angle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Style</label>
                    <select className="setting-select" value={fx.gradientOverlay.style} onChange={(e) => writeFx('gradientOverlay', { style: e.target.value as 'linear' | 'radial' })}>
                      <option value="linear">Linear</option>
                      <option value="radial">Radial</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'patternOverlay' && (
              <>
                <h4 className="settings-title">Pattern Overlay</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={fx.patternOverlay.opacity} onChange={(e) => writeFx('patternOverlay', { opacity: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.patternOverlay.opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={fx.patternOverlay.blendMode} onChange={(e) => writeFx('patternOverlay', { blendMode: e.target.value })}>
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Scale</label>
                    <div className="setting-slider-row">
                      <input type="range" min="10" max="200" value={fx.patternOverlay.scale} onChange={(e) => writeFx('patternOverlay', { scale: parseInt(e.target.value) })} className="setting-slider" />
                      <span className="setting-value">{fx.patternOverlay.scale}%</span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {(layerStyleActiveTab === 'strokeStyle') && (
              <>
                <h4 className="settings-title">Stroke Style</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="50" value={ssSize} onChange={(e) => setSsSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{ssSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={ssColor} onChange={(e) => setSsColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{ssColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={ssOpacity} onChange={(e) => setSsOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{ssOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Position</label>
                    <div className="position-toggles">
                      {(['outside', 'inside', 'center'] as const).map(pos => (
                        <button
                          key={pos}
                          className={`position-btn ${ssPosition === pos ? 'active' : ''}`}
                          onClick={() => setSsPosition(pos)}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {layerStyleActiveTab === 'd3d' && (
              <>
                <h4 className="settings-title">3D</h4>
                <div className="settings-section">
                  <div className="setting-row">
                    <label className="setting-label">Depth</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={50} onChange={() => {}} className="setting-slider" />
                      <span className="setting-value">50%</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right: Preview */}
          <div className="layer-style-preview-panel">
            <canvas
              id="layer-style-preview"
              width={200}
              height={150}
              className="layer-style-preview-canvas"
            />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

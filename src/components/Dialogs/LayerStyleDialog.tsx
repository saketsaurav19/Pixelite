import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';
import './Dialogs.css';

interface StyleEffects {
  bevelAndEmboss: boolean;
  contour: boolean;
  texture: boolean;
  stroke: boolean;
  dropShadow: boolean;
  innerShadow: boolean;
  innerGlow: boolean;
  outerGlow: boolean;
  satin: boolean;
  colorOverlay: boolean;
  gradientOverlay: boolean;
  patternOverlay: boolean;
  strokeStyle: boolean; // distinct from "stroke" effect
  d3d: boolean;
}

const INITIAL_EFFECTS: StyleEffects = {
  bevelAndEmboss: false,
  contour: false,
  texture: false,
  stroke: false,
  dropShadow: false,
  innerShadow: false,
  innerGlow: false,
  outerGlow: false,
  satin: false,
  colorOverlay: false,
  gradientOverlay: false,
  patternOverlay: false,
  strokeStyle: false,
  d3d: false,
};

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

export const LayerStyleDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isLayerStyleDialogOpen,
    setIsLayerStyleDialogOpen,
    layerStyleActiveTab,
    setLayerStyleActiveTab,
    activeLayerId,
    updateLayer,
    recordHistory,
    layers,
  } = useStore();

  const activeLayer = activeLayerId ? findLayerById(layers, activeLayerId) : undefined;

  const [opacity, setOpacity] = useState(100);
  const [blendMode, setBlendMode] = useState<string>('source-over');
  const [fillOpacity, setFillOpacity] = useState(100);
  const [fillChannels, setFillChannels] = useState({ r: true, g: true, b: true });
  const [blendIf, setBlendIf] = useState<'gray' | 'r' | 'g' | 'b'>('gray');
  const [blendIfRange, setBlendIfRange] = useState({ underlyingLow: 0, underlyingHigh: 255, blendLow: 0, blendHigh: 255 });
  const [effects, setEffects] = useState<StyleEffects>(INITIAL_EFFECTS);

  // Effect-specific settings
  const [shadowColor, setShadowColor] = useState('#000000');
  const [shadowOpacity, setShadowOpacity] = useState(75);
  const [shadowAngle, setShadowAngle] = useState(120);
  const [shadowDistance, setShadowDistance] = useState(5);
  const [shadowSize, setShadowSize] = useState(5);
  const [shadowChoke, setShadowChoke] = useState(0);
  const [shadowNoise, setShadowNoise] = useState(0);

  const [innerShadowColor, setInnerShadowColor] = useState('#000000');
  const [innerShadowOpacity, setInnerShadowOpacity] = useState(75);
  const [innerShadowAngle, setInnerShadowAngle] = useState(120);
  const [innerShadowDistance, setInnerShadowDistance] = useState(5);
  const [innerShadowSize, setInnerShadowSize] = useState(5);

  const [strokeSize, setStrokeSize] = useState(3);
  const [strokeColor, setStrokeColor] = useState('#ff0000');
  const [strokeOpacity, setStrokeOpacity] = useState(100);
  const [strokePosition, setStrokePosition] = useState<'outside' | 'inside' | 'center'>('outside');
  const [strokeBlendMode, setStrokeBlendMode] = useState('source-over');

  const [glowColor, setGlowColor] = useState('#ff0000');
  const [glowOpacity, setGlowOpacity] = useState(75);
  const [glowSize, setGlowSize] = useState(10);
  const [glowTechnique, setGlowTechnique] = useState('softer');
  const [glowRange, setGlowRange] = useState('50%');

  const [overlayColor, setOverlayColor] = useState('#ff0000');
  const [overlayOpacity, setOverlayOpacity] = useState(100);
  const [overlayBlendMode, setOverlayBlendMode] = useState('normal');

  const [gradientStart, setGradientStart] = useState('#ff0000');
  const [gradientEnd, setGradientEnd] = useState('#0000ff');
  const [gradientOpacity, setGradientOpacity] = useState(100);
  const [gradientAngle, setGradientAngle] = useState(90);
  const [gradientStyle, setGradientStyle] = useState('linear');

  // Bevel & Emboss settings
  const [bevelStyle, setBevelStyle] = useState<string>('innerBevel');
  const [bevelTechnique, setBevelTechnique] = useState<string>('smooth');
  const [bevelDepth, setBevelDepth] = useState(100);
  const [bevelSize, setBevelSize] = useState(5);
  const [bevelSoften, setBevelSoften] = useState(0);
  const [bevelAngle, setBevelAngle] = useState(30);
  const [bevelAltitude, setBevelAltitude] = useState(30);
  const [bevelGloss, setBevelGloss] = useState(0);
  const [bevelHighlightMode, setBevelHighlightMode] = useState<string>('screen');
  const [bevelHighlightOpacity, setBevelHighlightOpacity] = useState(75);
  const [bevelShadowMode, setBevelShadowMode] = useState<string>('multiply');
  const [bevelShadowOpacity, setBevelShadowOpacity] = useState(75);
  const [bevelUseGlobalAngle, setBevelUseGlobalAngle] = useState(true);
  const [bevelContour, setBevelContour] = useState<string>('linear');

  // Contour settings
  const [contourColor, setContourColor] = useState('#000000');
  const [contourOpacity, setContourOpacity] = useState(75);
  const [contourRange, setContourRange] = useState(50);
  const [contourEdge, setContourEdge] = useState<'inside' | 'outside' | 'center'>('inside');
  const [contourShape, setContourShape] = useState<string>('linear');
  const [contourNoise, setContourNoise] = useState(0);
  const [contourAntiAliased, setContourAntiAliased] = useState(true);

  // Texture settings
  const [texturePattern, setTexturePattern] = useState<string>('brick');
  const [textureScale, setTextureScale] = useState(100);
  const [textureDepth, setTextureDepth] = useState(50);
  const [textureInvert, setTextureInvert] = useState(false);
  const [textureLinkToLayer, setTextureLinkToLayer] = useState(true);
  const [textureOpacity, setTextureOpacity] = useState(100);

  const backupCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Original layer canvas size captured when the dialog opens. Used to grow
  // the canvas to accommodate outer effects (drop shadow, outer glow, stroke,
  // outer bevel) so they aren't clipped at the canvas boundary, and to restore
  // the size on cancel.
  const originalSizeRef = useRef<{ w: number; h: number; px: number; py: number } | null>(null);
  const layerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /**
   * Compute the padding (in canvas pixels) needed on each side of the content
   * to accommodate outer effects. Layer styles like drop shadow extend
   * `shadowSize` (blur) on every side and `shadowDistance` (offset) in one
   * direction. We pad equally on all sides so the offset direction doesn't
   * matter and the content stays visually anchored.
   */
  const computeEffectPadding = useCallback(() => {
    let pad = 0;
    if (effects.dropShadow) {
      pad = Math.max(pad, Math.ceil(shadowSize * 2 + Math.abs(shadowDistance)));
    }
    if (effects.outerGlow) {
      pad = Math.max(pad, Math.ceil(glowSize * 2));
    }
    if (effects.stroke) {
      pad = Math.max(pad, Math.ceil(strokeSize));
    }
    if (effects.bevelAndEmboss && bevelStyle === 'outerBevel') {
      pad = Math.max(pad, Math.ceil(bevelSize * 2));
    }
    return pad;
  }, [effects.dropShadow, effects.outerGlow, effects.stroke, effects.bevelAndEmboss, bevelStyle, shadowSize, shadowDistance, glowSize, strokeSize, bevelSize]);

  /**
   * Keep the store's `layer.width` / `layer.height` / `layer.position` in sync
   * with the (now-padded) canvas dimensions, so the wrapper div that hosts
   * the canvas grows to match. The visible artwork is at `(pad, pad)` inside
   * the canvas, so we shift the position back by `pad` to keep the artwork
   * anchored at its original document coordinate. `originalSizeRef` holds the
   * pre-dialog geometry so we can compute the un-padded reference position.
   */
  const syncStoreSize = useCallback((targetW: number, targetH: number, pad: number) => {
    if (!activeLayerId) return;
    const orig = originalSizeRef.current;
    if (!orig) return;
    // Only push updates that actually change the store, to avoid extra
    // CanvasLayer re-renders on every slider tick.
    const layer = findLayerById(useStore.getState().layers, activeLayerId);
    if (!layer) return;
    const needsSize = layer.width !== targetW || layer.height !== targetH;
    const newX = orig.px - pad;
    const newY = orig.py - pad;
    const needsPos = (layer.position?.x ?? 0) !== newX || (layer.position?.y ?? 0) !== newY;
    if (!needsSize && !needsPos) return;
    useStore.getState().updateLayer(activeLayerId, {
      ...(needsSize ? { width: targetW, height: targetH } : {}),
      ...(needsPos ? { position: { x: newX, y: newY } } : {}),
    });
  }, [activeLayerId]);

  /**
   * Grow or shrink the layer's actual canvas to `originalSize + 2*padding` and
   * re-anchor the content in the center. Returns the new width/height, or null
   * if no layer is available. Original size is captured the first time so the
   * canvas tracks the current padding through every effect toggle.
   */
  const ensureCanvasSized = useCallback(() => {
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement | null;
    if (!layerCanvas || !backupCanvasRef.current) return null;
    layerCanvasRef.current = layerCanvas;
    if (!originalSizeRef.current) {
      originalSizeRef.current = {
        w: layerCanvas.width,
        h: layerCanvas.height,
        px: activeLayer?.position?.x ?? 0,
        py: activeLayer?.position?.y ?? 0,
      };
    }
    const pad = computeEffectPadding();
    const orig = originalSizeRef.current;
    const targetW = orig.w + pad * 2;
    const targetH = orig.h + pad * 2;
    const prevW = layerCanvas.width;
    const prevH = layerCanvas.height;
    if (prevW === targetW && prevH === targetH) {
      // Canvas size already matches — still make sure the store's layer
      // dimensions track the padded size so the visible wrapper matches.
      syncStoreSize(targetW, targetH, pad);
      return { w: targetW, h: targetH, pad };
    }
    // Capture the original backup (centered at 0,0 within `orig.w x orig.h`).
    // We redraw from the backup, not the current canvas, so toggling effects
    // doesn't compound artifacts.
    const backup = backupCanvasRef.current;
    layerCanvas.width = targetW;
    layerCanvas.height = targetH;
    const ctx = layerCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, targetW, targetH);
      // Place the backup at (pad, pad) in the new canvas. The previous live
      // preview is discarded — effects re-render on top.
      ctx.drawImage(backup, pad, pad);
    }
    // Grow/shrink the layer's display dimensions in the store to match the
    // canvas, and shift the position so the visible content stays anchored at
    // the same document coordinate. Without this, the wrapper div stays at
    // the pre-dialog size and the shadow/glow pixels (which are drawn in the
    // padded region around the content) are clipped off-screen.
    syncStoreSize(targetW, targetH, pad);
    return { w: targetW, h: targetH, pad };
  }, [activeLayerId, activeLayer, computeEffectPadding]);

  /** Shrink the layer canvas back to its original size on cancel. */
  const restoreCanvasSize = useCallback(() => {
    const layerCanvas = layerCanvasRef.current;
    const orig = originalSizeRef.current;
    if (!layerCanvas || !orig) return;
    if (layerCanvas.width === orig.w && layerCanvas.height === orig.h) {
      // Canvas already at original size — make sure the store dimensions are
      // back to the original too (handleApply does this; handleCancel can
      // arrive here if no effects were ever enabled).
      if (activeLayerId) {
        const layer = findLayerById(useStore.getState().layers, activeLayerId);
        if (layer && (layer.width !== orig.w || layer.height !== orig.h ||
            (layer.position?.x ?? 0) !== orig.px || (layer.position?.y ?? 0) !== orig.py)) {
          useStore.getState().updateLayer(activeLayerId, {
            width: orig.w, height: orig.h, position: { x: orig.px, y: orig.py },
          });
        }
      }
      return;
    }
    // Crop back to original size from the top-left so the visible content
    // aligns with the pre-dialog document position.
    const temp = document.createElement('canvas');
    temp.width = layerCanvas.width;
    temp.height = layerCanvas.height;
    const tCtx = temp.getContext('2d');
    if (tCtx) tCtx.drawImage(layerCanvas, 0, 0);
    layerCanvas.width = orig.w;
    layerCanvas.height = orig.h;
    const ctx = layerCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, orig.w, orig.h);
      ctx.drawImage(temp, 0, 0);
    }
    // Restore the store's layer dimensions so the wrapper div shrinks back
    // to the pre-dialog size and the layer's document position is preserved.
    if (activeLayerId) {
      useStore.getState().updateLayer(activeLayerId, {
        width: orig.w, height: orig.h, position: { x: orig.px, y: orig.py },
      });
    }
  }, [activeLayerId]);

  // Mobile layout detection
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Set defaults when opening
  useEffect(() => {
    if (!isLayerStyleDialogOpen || !activeLayer) return;

    setOpacity(Math.round((activeLayer.opacity ?? 1) * 100));
    setFillOpacity(Math.round((activeLayer.fill ?? 1) * 100));
    setBlendMode(activeLayer.blendMode || 'source-over');
    setEffects(INITIAL_EFFECTS);
    setLayerStyleActiveTab('blending');
    setBevelStyle('innerBevel');
    setBevelTechnique('smooth');
    setBevelDepth(100);
    setBevelSize(5);
    setBevelSoften(0);
    setBevelAngle(30);
    setBevelAltitude(30);
    setBevelGloss(0);
    setBevelHighlightMode('screen');
    setBevelHighlightOpacity(75);
    setBevelShadowMode('multiply');
    setBevelShadowOpacity(75);
    setBevelUseGlobalAngle(true);
    setBevelContour('linear');
    setContourColor('#000000');
    setContourOpacity(75);
    setContourRange(50);
    setContourEdge('inside');
    setContourShape('linear');
    setContourNoise(0);
    setContourAntiAliased(true);
    setTexturePattern('brick');
    setTextureScale(100);
    setTextureDepth(50);
    setTextureInvert(false);
    setTextureLinkToLayer(true);
    setTextureOpacity(100);

    // Save backup canvas of the layer's original state
    const layerCanvas = document.querySelector(`canvas[data-layer-id="${activeLayer.id}"]`) as HTMLCanvasElement;
    if (layerCanvas) {
      const backup = document.createElement('canvas');
      backup.width = layerCanvas.width;
      backup.height = layerCanvas.height;
      const backupCtx = backup.getContext('2d');
      if (backupCtx) {
        backupCtx.drawImage(layerCanvas, 0, 0);
        backupCanvasRef.current = backup;
      }
    }
  }, [isLayerStyleDialogOpen, activeLayerId]);

  // Bake base layer content + all enabled style effects onto the given context.
  // Shared by the live preview AND the real "Apply" path so the main canvas
  // actually reflects the enabled effects (previously only the preview did).
  // `pad` is the padding offset of the base content from (0,0) — when the
  // canvas has been grown to fit outer effects, the original content is
  // anchored at (pad, pad) instead of (0, 0), and the effects need to be
  // drawn at the same offset so they line up with the base.
  const renderEffects = useCallback((
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    pad: number = 0
  ) => {
    if (!backupCanvasRef.current) return;

    ctx.save();
    ctx.globalAlpha = opacity / 100;

    // Draw base layer content first (single source of truth for the shape)
    if (backupCanvasRef.current) {
      ctx.drawImage(backupCanvasRef.current, pad, pad);
    }

    // Drop Shadow
    if (effects.dropShadow && backupCanvasRef.current) {
      ctx.save();
      const rad = (shadowAngle * Math.PI) / 180;
      ctx.shadowColor = `rgba(0,0,0,${shadowOpacity / 100})`;
      ctx.shadowBlur = shadowSize;
      ctx.shadowOffsetX = shadowDistance * Math.cos(rad);
      ctx.shadowOffsetY = shadowDistance * Math.sin(rad);
      ctx.drawImage(backupCanvasRef.current, pad, pad);
      ctx.restore();
    }

    // Inner Shadow
    if (effects.innerShadow && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const rad = (innerShadowAngle * Math.PI) / 180;

      tCtx.drawImage(backupCanvasRef.current, pad, pad);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = '#000';
      tCtx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.clip();
      ctx.shadowColor = `rgba(0,0,0,${innerShadowOpacity / 100})`;
      ctx.shadowBlur = innerShadowSize;
      ctx.shadowOffsetX = innerShadowDistance * Math.cos(rad);
      ctx.shadowOffsetY = innerShadowDistance * Math.sin(rad);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Outer Glow
    if (effects.outerGlow && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * glowSize);
        const dy = Math.round(Math.sin(angle) * glowSize);
        tCtx.drawImage(backupCanvasRef.current, pad + dx, pad + dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = glowColor;
      tCtx.globalAlpha = glowOpacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Color Overlay
    if (effects.colorOverlay && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = overlayColor;
      tCtx.globalAlpha = overlayOpacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Gradient Overlay
    if (effects.gradientOverlay && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);
      tCtx.globalCompositeOperation = 'source-in';

      const grad = tCtx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, gradientStart);
      grad.addColorStop(1, gradientEnd);
      tCtx.fillStyle = grad;
      tCtx.globalAlpha = gradientOpacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Inner Glow
    if (effects.innerGlow && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);

      ctx.save();
      ctx.clip();
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * glowSize);
        const dy = Math.round(Math.sin(angle) * glowSize);
        tCtx.drawImage(backupCanvasRef.current, pad + dx, pad + dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = glowColor;
      tCtx.globalAlpha = glowOpacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
      ctx.restore();
    }

    // Satin
    if (effects.satin && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);
      tCtx.globalCompositeOperation = 'overlay';
      tCtx.fillStyle = gradientStart;
      tCtx.globalAlpha = 0.5;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Pattern Overlay
    if (effects.patternOverlay && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = '#666';
      tCtx.globalAlpha = 0.3;
      const ps = 10;
      for (let x = 0; x < w; x += ps) {
        for (let y = 0; y < h; y += ps) {
          tCtx.fillRect(x, y, ps / 2, ps / 2);
        }
      }
      ctx.drawImage(temp, 0, 0);
    }

    // Stroke
    if (effects.stroke && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      const steps = 32;
      for (let i = 0; i < steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const dx = Math.round(Math.cos(angle) * strokeSize);
        const dy = Math.round(Math.sin(angle) * strokeSize);
        tCtx.drawImage(backupCanvasRef.current, pad + dx, pad + dy);
      }
      tCtx.globalCompositeOperation = 'source-in';
      tCtx.fillStyle = strokeColor;
      tCtx.globalAlpha = strokeOpacity / 100;
      tCtx.fillRect(0, 0, w, h);
      ctx.drawImage(temp, 0, 0);
    }

    // Bevel and Emboss
    if (effects.bevelAndEmboss && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);

      ctx.save();

      // Use globalCompositeOperation to simulate emboss
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = bevelDepth / 100;

      // Outer bevel - highlight top-left, shadow bottom-right
      const rad = (bevelAngle * Math.PI) / 180;
      const highlightX = -Math.cos(rad) * bevelSize;
      const highlightY = -Math.sin(rad) * bevelSize;
      const shadowX = Math.cos(rad) * bevelSize;
      const shadowY = Math.sin(rad) * bevelSize;

      // Draw highlight layer
      if (bevelStyle === 'innerBevel') {
        ctx.globalCompositeOperation = (bevelHighlightMode === 'screen' ? 'lighten' : bevelHighlightMode) as GlobalCompositeOperation;
        ctx.globalAlpha = (bevelHighlightOpacity / 100) * (bevelDepth / 100);
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = bevelSize;
        ctx.shadowOffsetX = highlightX;
        ctx.shadowOffsetY = highlightY;
        ctx.drawImage(temp, 0, 0);

        // Draw shadow layer
        ctx.globalCompositeOperation = (bevelShadowMode === 'multiply' ? 'darken' : bevelShadowMode) as GlobalCompositeOperation;
        ctx.globalAlpha = (bevelShadowOpacity / 100) * (bevelDepth / 100);
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowOffsetX = shadowX;
        ctx.shadowOffsetY = shadowY;
        ctx.drawImage(temp, 0, 0);
      } else {
        // Outer bevel
        ctx.shadowColor = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = bevelSize;
        ctx.shadowOffsetX = highlightX;
        ctx.shadowOffsetY = highlightY;
        ctx.globalCompositeOperation = bevelHighlightMode as GlobalCompositeOperation;
        ctx.globalAlpha = (bevelHighlightOpacity / 100) * (bevelDepth / 100);
        ctx.drawImage(temp, 0, 0);
      }

      ctx.restore();
    }

    // Contour effect
    if (effects.contour && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);

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

    // Texture effect
    if (effects.texture && backupCanvasRef.current) {
      const temp = document.createElement('canvas');
      temp.width = w;
      temp.height = h;
      const tCtx = temp.getContext('2d')!;
      tCtx.drawImage(backupCanvasRef.current, pad, pad);

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
  }, [opacity, blendMode, effects, bevelStyle, bevelTechnique, bevelDepth, bevelSize, bevelSoften, bevelAngle, bevelAltitude, bevelGloss, bevelHighlightMode, bevelHighlightOpacity, bevelShadowMode, bevelShadowOpacity, bevelUseGlobalAngle, bevelContour,
    contourColor, contourOpacity, contourRange, contourEdge, contourShape, contourNoise, contourAntiAliased,
    texturePattern, textureScale, textureDepth, textureInvert, textureLinkToLayer, textureOpacity,
    shadowColor, shadowOpacity, shadowAngle, shadowDistance, shadowSize, shadowChoke, shadowNoise,
    innerShadowColor, innerShadowOpacity, innerShadowAngle, innerShadowDistance, innerShadowSize,
    strokeSize, strokeColor, strokeOpacity, strokePosition, strokeBlendMode,
    glowColor, glowOpacity, glowSize, glowTechnique, glowRange,
    overlayColor, overlayOpacity, overlayBlendMode,
    gradientStart, gradientEnd, gradientOpacity, gradientAngle, gradientStyle]);

  // Preview-specific wrapper: paints the checkerboard, then shares the
  // exact same effect-baking logic as the real "Apply" path.
  const renderPreview = useCallback(() => {
    const previewCanvas = document.getElementById('layer-style-preview') as HTMLCanvasElement;
    if (!previewCanvas) return;
    const pCtx = previewCanvas.getContext('2d');
    if (!pCtx) return;

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

    // The preview canvas (200×150) is much smaller than the actual layer
    // canvas (often 500×500+). renderEffects draws the backup at its native
    // 1:1 scale, so on a 200×150 preview we would only see the top-left
    // corner of the content. Scale the rendered output to fit the preview
    // area while preserving the layer's aspect ratio, so the whole shape
    // (and any outer effects) remain visible and centered.
    const backup = backupCanvasRef.current;
    const srcW = backup ? backup.width : w;
    const srcH = backup ? backup.height : h;
    const scale = Math.min(w / srcW, h / srcH);
    const drawW = srcW * scale;
    const drawH = srcH * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawH) / 2;

    pCtx.save();
    pCtx.translate(offsetX, offsetY);
    pCtx.scale(scale, scale);
    renderEffects(pCtx, srcW, srcH);
    pCtx.restore();
  }, [renderEffects]);

  useEffect(() => {
    if (!isLayerStyleDialogOpen) return;
    requestAnimationFrame(() => {
      // Thumbnail preview (existing)
      renderPreview();
      // Live document preview: paint the real layer canvas too, so effects
      // like Texture update in real time without clicking OK. The render loop
      // (useLayerRendering) skips the active layer while this dialog is open,
      // and handleCancel restores the backup — so this is safe.
      // Grow the canvas first so outer effects (drop shadow, outer glow,
      // outer stroke, outer bevel) have room to extend beyond the content
      // without being clipped at the canvas boundary.
      const sized = ensureCanvasSized();
      const layerCanvas = layerCanvasRef.current;
      if (layerCanvas && backupCanvasRef.current) {
        const lCtx = layerCanvas.getContext('2d');
        if (lCtx) {
          // Clear and let renderEffects draw base + all effects. The base
          // is positioned at (pad, pad) so the original artwork keeps its
          // visual center within the (now-larger) canvas.
          const pad = sized?.pad ?? 0;
          lCtx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
          renderEffects(lCtx, layerCanvas.width, layerCanvas.height, pad);
        }
      }
    });
  }, [isLayerStyleDialogOpen, renderPreview, activeLayerId, renderEffects, ensureCanvasSized,
    // Effect settings — re-render the document canvas whenever any of them change,
    // so sliders/colors/checkboxes update the live document preview without
    // needing to click OK. The rAF inside coalesces rapid slider movement.
    effects, opacity, blendMode, fillOpacity, fillChannels, blendIf, blendIfRange,
    shadowColor, shadowOpacity, shadowAngle, shadowDistance, shadowSize, shadowChoke, shadowNoise,
    innerShadowColor, innerShadowOpacity, innerShadowAngle, innerShadowDistance, innerShadowSize,
    strokeSize, strokeColor, strokeOpacity, strokePosition, strokeBlendMode,
    glowColor, glowOpacity, glowSize, glowTechnique, glowRange,
    overlayColor, overlayOpacity, overlayBlendMode,
    gradientStart, gradientEnd, gradientOpacity, gradientAngle, gradientStyle,
    bevelStyle, bevelTechnique, bevelDepth, bevelSize, bevelSoften, bevelAngle, bevelAltitude, bevelGloss,
    bevelHighlightMode, bevelHighlightOpacity, bevelShadowMode, bevelShadowOpacity, bevelUseGlobalAngle, bevelContour,
    contourColor, contourOpacity, contourRange, contourEdge, contourShape, contourNoise, contourAntiAliased,
    texturePattern, textureScale, textureDepth, textureInvert, textureLinkToLayer, textureOpacity]);

  if (!isLayerStyleDialogOpen || !activeLayer) return null;

  const toggleEffect = (key: EffectKey) => {
    setEffects(prev => ({ ...prev, [key]: !prev[key] }));
    if (EFFECT_LIST.some(e => e.key === key)) {
      setLayerStyleActiveTab(key);
    }
  };

  const handleApply = () => {
    // Make sure the canvas has been grown to fit any outer effects.
    const sized = ensureCanvasSized();
    const layerCanvas = layerCanvasRef.current;
    if (layerCanvas && backupCanvasRef.current) {
      // Bake the enabled style effects (drop shadow, bevel, contour, TEXTURE,
      // strokes, etc.) onto the real layer canvas using the same logic as the
      // preview. Previously this only restored the unmodified backup, so no
      // effect ever reached the document canvas — hence "nothing changes".
      const ctx = layerCanvas.getContext('2d');
      if (ctx) {
        // Clear and let renderEffects draw base + all effects. The base is
        // positioned at (pad, pad) so the original artwork keeps its visual
        // center within the (now-larger) canvas.
        const pad = sized?.pad ?? 0;
        ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        renderEffects(ctx, layerCanvas.width, layerCanvas.height, pad);
        const orig = originalSizeRef.current;
        const newPosition = orig
          ? { x: orig.px - pad, y: orig.py - pad }
          : activeLayer?.position;
        updateLayer(activeLayerId, {
          opacity: opacity / 100,
          fill: fillOpacity / 100,
          blendMode,
          width: layerCanvas.width,
          height: layerCanvas.height,
          position: newPosition,
          dataUrl: layerCanvas.toDataURL(),
        });
        recordHistory('Layer Styles Applied');
      }
    }
    // Reset the size refs so the next open re-captures the (now-larger) size.
    originalSizeRef.current = null;
    layerCanvasRef.current = null;
    setIsLayerStyleDialogOpen(false);
  };

  const handleCancel = () => {
    const layerCanvas = layerCanvasRef.current;
    if (layerCanvas && backupCanvasRef.current) {
      // First restore the original canvas size (crop the live-preview result),
      // then redraw the unmodified backup so the layer is back to its pre-dialog
      // state.
      restoreCanvasSize();
      const ctx = layerCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, layerCanvas.width, layerCanvas.height);
        ctx.drawImage(backupCanvasRef.current, 0, 0);
      }
    }
    originalSizeRef.current = null;
    layerCanvasRef.current = null;
    updateLayer(activeLayerId, {
      opacity: activeLayer.opacity ?? 1,
      fill: activeLayer.fill,
      blendMode: activeLayer.blendMode,
    });
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
              <label key={key} className={`layer-style-effect-item ${(key === 'contour' || key === 'texture') ? 'layer-style-effect-sub-item' : ''} ${effects[key] ? 'active' : ''}`}>
                <input
                  type="checkbox"
                  checked={effects[key]}
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
                      value={blendMode}
                      onChange={(e) => setBlendMode(e.target.value)}
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
                        value={opacity}
                        onChange={(e) => setOpacity(parseInt(e.target.value))}
                        className="setting-slider"
                      />
                      <span className="setting-value">{opacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Fill Opacity</label>
                    <div className="setting-slider-row">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={fillOpacity}
                        onChange={(e) => setFillOpacity(parseInt(e.target.value))}
                        className="setting-slider"
                      />
                      <span className="setting-value">{fillOpacity}%</span>
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
                      <input type="color" value={shadowColor} onChange={(e) => setShadowColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{shadowColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={shadowOpacity} onChange={(e) => setShadowOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={shadowAngle} onChange={(e) => setShadowAngle(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowAngle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={shadowDistance} onChange={(e) => setShadowDistance(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowDistance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={shadowSize} onChange={(e) => setShadowSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Choke</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={shadowChoke} onChange={(e) => setShadowChoke(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowChoke}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Noise</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={shadowNoise} onChange={(e) => setShadowNoise(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowNoise}%</span>
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
                      <input type="color" value={innerShadowColor} onChange={(e) => setInnerShadowColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{innerShadowColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={innerShadowOpacity} onChange={(e) => setInnerShadowOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{innerShadowOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={innerShadowAngle} onChange={(e) => setInnerShadowAngle(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{innerShadowAngle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={innerShadowDistance} onChange={(e) => setInnerShadowDistance(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{innerShadowDistance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="150" value={innerShadowSize} onChange={(e) => setInnerShadowSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{innerShadowSize}px</span>
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
                      <input type="range" min="0" max="50" value={strokeSize} onChange={(e) => setStrokeSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{strokeSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{strokeColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={strokeOpacity} onChange={(e) => setStrokeOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{strokeOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Position</label>
                    <div className="position-toggles">
                      {(['outside', 'inside', 'center'] as const).map(pos => (
                        <button
                          key={pos}
                          className={`position-btn ${strokePosition === pos ? 'active' : ''}`}
                          onClick={() => setStrokePosition(pos)}
                        >
                          {pos}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={strokeBlendMode} onChange={(e) => setStrokeBlendMode(e.target.value)}>
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
                <h4 className="settings-title">Bevel & Emboss</h4>
                <div className="settings-section">
                  {/* Structure Sub-group */}
                  <div className="settings-subgroup">
                    <h5 className="subgroup-title">Structure</h5>
                    <div className="setting-row">
                      <label className="setting-label">Style</label>
                      <select className="setting-select" value={bevelStyle} onChange={(e) => setBevelStyle(e.target.value)}>
                        <option value="innerBevel">Inner Bevel</option>
                        <option value="outerBevel">Outer Bevel</option>
                        <option value="emboss">Emboss</option>
                        <option value="pillowEmboss">Pillow Emboss</option>
                        <option value="strokeEmboss">Stroke Emboss</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Technique</label>
                      <select className="setting-select" value={bevelTechnique} onChange={(e) => setBevelTechnique(e.target.value)}>
                        <option value="smooth">Smooth</option>
                        <option value="chiselHard">Chisel Hard</option>
                        <option value="chiselSoft">Chisel Soft</option>
                      </select>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Depth</label>
                      <div className="setting-slider-row">
                        <input type="range" min="1" max="250" value={bevelDepth} onChange={(e) => setBevelDepth(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelDepth}%</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Size</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="50" value={bevelSize} onChange={(e) => setBevelSize(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelSize}px</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Soften</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="20" value={bevelSoften} onChange={(e) => setBevelSoften(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelSoften}px</span>
                      </div>
                    </div>
                  </div>

                  {/* Shading Sub-group */}
                  <div className="settings-subgroup">
                    <h5 className="subgroup-title">Shading</h5>
                    <div className="setting-row">
                      <label className="setting-label">Angle</label>
                      <div className="setting-slider-row">
                        <input type="range" min="-180" max="180" value={bevelAngle} onChange={(e) => setBevelAngle(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelAngle}°</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Altitude</label>
                      <div className="setting-slider-row">
                        <input type="range" min="0" max="90" value={bevelAltitude} onChange={(e) => setBevelAltitude(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelAltitude}°</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Contour</label>
                      <select className="setting-select" value={bevelContour} onChange={(e) => setBevelContour(e.target.value)}>
                          <option value="linear">Linear</option>
                          <option value="cone">Cone</option>
                          <option value="coneInverted">Cone-Inverted</option>
                          <option value="cube">Cube</option>
                          <option value="halfRound">Half Round</option>
                          <option value="smooth">Smooth</option>
                          <option value="ringed">Ringed</option>
                          <option value="ringedDouble">Ringed Double</option>
                          <option value="sCurve">S-Curve</option>
                        </select>
                      </div>
                    <div className="setting-row">
                      <label className="setting-label">Highlight Mode</label>
                      <select className="setting-select" value={bevelHighlightMode} onChange={(e) => setBevelHighlightMode(e.target.value)}>
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
                        <input type="range" min="0" max="100" value={bevelHighlightOpacity} onChange={(e) => setBevelHighlightOpacity(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelHighlightOpacity}%</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label">Shadow Mode</label>
                      <select className="setting-select" value={bevelShadowMode} onChange={(e) => setBevelShadowMode(e.target.value)}>
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
                        <input type="range" min="0" max="100" value={bevelShadowOpacity} onChange={(e) => setBevelShadowOpacity(parseInt(e.target.value))} className="setting-slider" />
                        <span className="setting-value">{bevelShadowOpacity}%</span>
                      </div>
                    </div>
                    <div className="setting-row">
                      <label className="setting-label checkbox-row">
                        <input type="checkbox" checked={bevelUseGlobalAngle} onChange={(e) => setBevelUseGlobalAngle(e.target.checked)} />
                        Use Global Light
                      </label>
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
                      <input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{glowColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={glowOpacity} onChange={(e) => setGlowOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{glowOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={glowSize} onChange={(e) => setGlowSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{glowSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Technique</label>
                    <select className="setting-select" value={glowTechnique} onChange={(e) => setGlowTechnique(e.target.value)}>
                      <option value="softer">Softer</option>
                      <option value="precise">Precise</option>
                    </select>
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
                      <input type="color" value={glowColor} onChange={(e) => setGlowColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{glowColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={glowOpacity} onChange={(e) => setGlowOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{glowOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={glowSize} onChange={(e) => setGlowSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{glowSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Range</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={parseInt(glowRange)} onChange={(e) => setGlowRange(`${e.target.value}%`)} className="setting-slider" />
                      <span className="setting-value">{glowRange}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Technique</label>
                    <select className="setting-select" value={glowTechnique} onChange={(e) => setGlowTechnique(e.target.value)}>
                      <option value="softer">Softer</option>
                      <option value="precise">Precise</option>
                    </select>
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
                      <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="color-input" />
                      <span className="setting-value">{gradientStart}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{overlayOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={gradientAngle} onChange={(e) => setGradientAngle(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{gradientAngle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Distance</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-100" max="100" value={shadowDistance} onChange={(e) => setShadowDistance(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowDistance}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Size</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={shadowSize} onChange={(e) => setShadowSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{shadowSize}px</span>
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
                      <input type="color" value={overlayColor} onChange={(e) => setOverlayColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{overlayColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{overlayOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={overlayBlendMode} onChange={(e) => setOverlayBlendMode(e.target.value)}>
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
                      <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="color-input" />
                      <span className="setting-value">{gradientStart}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">End Color</label>
                    <div className="setting-controls">
                      <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="color-input" />
                      <span className="setting-value">{gradientEnd}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={gradientOpacity} onChange={(e) => setGradientOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{gradientOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Angle</label>
                    <div className="setting-slider-row">
                      <input type="range" min="-180" max="180" value={gradientAngle} onChange={(e) => setGradientAngle(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{gradientAngle}°</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Style</label>
                    <select className="setting-select" value={gradientStyle} onChange={(e) => setGradientStyle(e.target.value)}>
                      <option value="linear">Linear</option>
                      <option value="radial">Radial</option>
                      <option value="angle">Angle</option>
                      <option value="reflected">Reflected</option>
                      <option value="diamond">Diamond</option>
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
                      <input type="range" min="0" max="100" value={overlayOpacity} onChange={(e) => setOverlayOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{overlayOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Blend Mode</label>
                    <select className="setting-select" value={overlayBlendMode} onChange={(e) => setOverlayBlendMode(e.target.value)}>
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                    </select>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Scale</label>
                    <div className="setting-slider-row">
                      <input type="range" min="10" max="200" value={100} onChange={() => {}} className="setting-slider" />
                      <span className="setting-value">100%</span>
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
                      <input type="range" min="0" max="50" value={strokeSize} onChange={(e) => setStrokeSize(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{strokeSize}px</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Color</label>
                    <div className="setting-controls">
                      <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="color-input" />
                      <span className="setting-value">{strokeColor}</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Opacity</label>
                    <div className="setting-slider-row">
                      <input type="range" min="0" max="100" value={strokeOpacity} onChange={(e) => setStrokeOpacity(parseInt(e.target.value))} className="setting-slider" />
                      <span className="setting-value">{strokeOpacity}%</span>
                    </div>
                  </div>
                  <div className="setting-row">
                    <label className="setting-label">Position</label>
                    <div className="position-toggles">
                      {(['outside', 'inside', 'center'] as const).map(pos => (
                        <button
                          key={pos}
                          className={`position-btn ${strokePosition === pos ? 'active' : ''}`}
                          onClick={() => setStrokePosition(pos)}
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

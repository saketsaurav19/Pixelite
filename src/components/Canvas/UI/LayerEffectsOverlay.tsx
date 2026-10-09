import React, { useEffect } from 'react';
import type { Layer } from '../../../store/types';
import type { CanvasRefs } from '../types';
import {
  hasCanvasEffects,
  renderEffectsUnderlay,
  renderEffectsOverlay,
  effectExteriorPadding,
} from '../../../utils/layerEffects';

interface LayerEffectsOverlayProps {
  layer: Layer;
  canvasRefs: CanvasRefs;
}

// Attribute names used to find these canvases imperatively from renderLayer.
// (JSX attribute names must be literals, so these constants are only used for
// the querySelector side — keep the JSX below in sync.)
export const EFFECT_UNDERLAY_ATTR = 'data-effect-underlay-for';
export const EFFECT_OVERLAY_ATTR = 'data-effect-overlay-for';

/* ──────────────────────────────────────────────────────────────────────────
   Render approach (MU-2): HYBRID.
   The overlay/underlay <canvas> elements are mounted by the
   <LayerEffectsOverlay> React component (sized, positioned, pointer-events
   none), but they are *painted* imperatively — from the component's
   useEffect AND from renderLayer (useLayerRendering.ts) after every
   base-content repaint.

   A pure-React approach is unreliable here: renderLayer paints base pixels
   asynchronously (Image.onload for dataUrl layers, pdfium/pixi promises),
   and child effects run before the parent's renderLayer effect, so a
   useEffect-only overlay would permanently lag behind the base canvas
   (e.g. stale effects after every brush-stroke commit). The imperative
   hook repaints at each landing point — sync draws and inside every async
   completion — so the effect canvases can never drift from the base.

   Effects stay presentation-only: the layer's own working canvas
   (canvasRefs.current[layer.id]) is never mutated — painting tools
   serialize it on stroke end, so baking effects into it would corrupt
   layer data (same rule MU-1 followed with CSS mask-image).
   ────────────────────────────────────────────────────────────────────────── */
export const repaintLayerEffectCanvases = (
  layer: Pick<Layer, 'id' | 'effects'>,
  canvasRefs: CanvasRefs,
): void => {
  const effects = layer.effects;
  if (!effects || !hasCanvasEffects(effects)) return;
  const base = canvasRefs.current?.[layer.id];
  if (!base || base.width === 0 || base.height === 0) return;

  const paintTarget = (attr: string, rendered: HTMLCanvasElement | null) => {
    const target = document.querySelector(
      `canvas[${attr}="${CSS.escape(layer.id)}"]`,
    ) as HTMLCanvasElement | null;
    if (!target) return;
    const tctx = target.getContext('2d');
    if (!tctx) return;
    if (rendered && rendered.width > 0 && rendered.height > 0) {
      if (target.width !== rendered.width || target.height !== rendered.height) {
        target.width = rendered.width;
        target.height = rendered.height;
      } else {
        tctx.clearRect(0, 0, target.width, target.height);
      }
      tctx.drawImage(rendered, 0, 0);
    } else {
      tctx.clearRect(0, 0, target.width, target.height);
    }
  };

  // Drop shadow + outer glow are handled live by the CSS filter on
  // .layer-wrapper (see CanvasLayer), so the canvas underlay skips them.
  paintTarget(EFFECT_UNDERLAY_ATTR, renderEffectsUnderlay(base, effects, { skipShadowGlow: true }));
  paintTarget(EFFECT_OVERLAY_ATTR, renderEffectsOverlay(base, effects));
};

/**
 * Mounts the two effect canvases for a leaf layer inside its .layer-wrapper:
 * an underlay (exterior canvas effects: outside stroke, outer bevel ring)
 * positioned at -pad, and an overlay (interior effects: inner shadow/glow,
 * satin, bevel, color/gradient/pattern overlays, inside/center stroke) at 0,0.
 * Returns null when no canvas-composited effect is enabled.
 */
export const LayerEffectsOverlay: React.FC<LayerEffectsOverlayProps> = ({ layer, canvasRefs }) => {
  const { id, effects, dataUrl } = layer;

  // Best-effort refresh for the effect-parameter path: while the Layer Style
  // dialog is open, renderLayer skips the active layer, so the imperative
  // hook can't fire — the base canvas is already settled at that point.
  // dataUrl changes on stroke commit, when the base canvas already holds the
  // new pixels (tools paint it directly during the stroke).
  useEffect(() => {
    if (hasCanvasEffects(effects)) {
      repaintLayerEffectCanvases({ id, effects }, canvasRefs);
    }
  }, [id, effects, dataUrl, canvasRefs]);

  if (!hasCanvasEffects(effects)) return null;

  const pad = effectExteriorPadding(effects);
  const base = canvasRefs.current?.[id];
  const bw = base?.width ?? 0;
  const bh = base?.height ?? 0;

  return (
    <>
      {/* Underlay: padded exterior effects; base content sits at (pad, pad) */}
      <canvas
        data-effect-underlay-for={id}
        width={bw + pad * 2}
        height={bh + pad * 2}
        style={{
          position: 'absolute',
          left: -pad,
          top: -pad,
          width: `calc(100% + ${pad * 2}px)`,
          height: `calc(100% + ${pad * 2}px)`,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />
      {/* Overlay: interior effects, same box as the base canvas */}
      <canvas
        data-effect-overlay-for={id}
        width={bw}
        height={bh}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

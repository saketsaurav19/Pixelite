/**
 * layerEffects.ts — shared layer-styles (MU-2) render module for Pixelite.
 *
 * Generalizes the canvas effect logic that previously lived in
 * `LayerStyleDialog.tsx`'s `renderEffects` into pure, reusable functions
 * that work directly off the `LayerEffects` data model in `src/store/types.ts`.
 *
 * Two render paths:
 *  - LIVE DISPLAY: `buildEffectFilter()` produces a CSS `filter` chain for
 *    drop shadow / outer glow (the only exterior effects CSS can do).
 *    Per-effect blend modes CANNOT be expressed in a CSS filter, so the live
 *    path is an approximation — blend modes and spread are baked properly only
 *    in the canvas path below. `renderEffectsUnderlay()` accepts
 *    `{ skipShadowGlow: true }` so the live renderer can skip shadow/glow
 *    (done via CSS) while still getting the outside stroke on canvas.
 *  - EXPORT / BAKE: `drawLayerWithEffects()` composites underlay (exterior
 *    effects, padded) + base + overlay (interior effects) onto a target
 *    context, honoring each effect's blendMode through
 *    `mapBlendModeToCanvas`.
 *
 * Rules honored: the input `base` canvas is never mutated — every effect is
 * baked on temp canvases. This module never imports the zustand store (no
 * cycles); only types and the blend-mode mapper.
 *
 * What was deliberately trimmed vs Photoshop is documented in
 * TRIMMED_CONTROLS below.
 */

import type {
  BevelEmbossEffect,
  BlendMode,
  GradientStop,
  InnerGlowEffect,
  InnerShadowEffect,
  LayerEffects,
  SatinEffect,
  StrokeEffect,
} from '../store/types';
import { mapBlendModeToCanvas } from './blendModes';
import { hexToRgba } from '../components/Canvas/Core/colorUtils';

export { hexToRgba };

/* ==========================================================================
   TRIMMED_CONTROLS — what was deliberately trimmed vs Photoshop.
   ========================================================================== */
export const TRIMMED_CONTROLS: string = [
  'Drop Shadow: spread/choke is approximated by radially expanding the shadow',
  'silhouette before blurring (canvas shadows have no native spread); noise is trimmed.',
  'Outer Glow: gradient glow -> solid color only; softer/precise technique, range and',
  'jitter trimmed — a single soft falloff is rendered.',
  'Inner Glow: gradient glow -> solid color only; edge and center sources both supported.',
  'Bevel/Emboss: innerBevel and outerBevel fully implemented (smooth technique).',
  'emboss and pillowEmboss are approximated by compositing inner + outer bevel passes.',
  'chiselSoft/chiselHard reuse the smooth path with a tighter (harder) falloff.',
  'Contour curves, gloss contour, anti-aliasing and bevel texture are trimmed.',
  'Satin: single offset sheen (no contour curve); blur/size approximated by edge falloff.',
  'Color Overlay: full support.',
  'Gradient Overlay: multi-stop gradients, linear (angle) and radial (scale) styles.',
  'Reflected/diamond styles, dither, reverse and align-with-layer are trimmed.',
  'Pattern Overlay: only the built-in "checkerboard" tile + scale; a pattern library',
  'or preset picker is future work.',
  'Stroke: solid-color fill only (gradient/pattern fill trimmed); outside, inside and',
  'center positions supported.',
  'Live CSS path: drop-shadow() filter only — per-effect blend modes and spread are',
  'baked in the canvas path, not the CSS filter. Exterior-effect blend modes are baked',
  'inside the underlay group, which is an approximation of the true document-relative',
  'blend (the document backdrop is not known at bake time).',
  'Blend-if, fill channels, knockout, global-light sync and scale-effects-with-layer',
  'are trimmed.',
].join('\n');

/* ==========================================================================
   Defaults — Photoshop-ish initial values, taken from the useState
   initializers in LayerStyleDialog.tsx where the dialog had them.
   Every effect defaults to enabled: false.
   ========================================================================== */
export const DEFAULT_LAYER_EFFECTS: LayerEffects = {
  dropShadow: {
    enabled: false,
    blendMode: 'multiply',
    color: '#000000',
    opacity: 75,
    angle: 120,
    distance: 5,
    spread: 0,
    size: 5,
  },
  innerShadow: {
    enabled: false,
    blendMode: 'multiply',
    color: '#000000',
    opacity: 75,
    angle: 120,
    distance: 5,
    choke: 0,
    size: 5,
  },
  outerGlow: {
    enabled: false,
    blendMode: 'screen',
    color: '#ff0000',
    opacity: 75,
    spread: 0,
    size: 10,
  },
  innerGlow: {
    enabled: false,
    blendMode: 'screen',
    color: '#ff0000',
    opacity: 75,
    choke: 0,
    size: 10,
    source: 'edge',
  },
  bevelAndEmboss: {
    enabled: false,
    style: 'innerBevel',
    technique: 'smooth',
    depth: 100,
    direction: 'up',
    size: 5,
    soften: 0,
    angle: 30,
    altitude: 30,
    highlightMode: 'screen',
    highlightColor: '#ffffff',
    highlightOpacity: 75,
    shadowMode: 'multiply',
    shadowColor: '#000000',
    shadowOpacity: 75,
  },
  satin: {
    enabled: false,
    blendMode: 'overlay',
    color: '#ff0000',
    opacity: 50,
    angle: 120,
    distance: 11,
    size: 14,
    invert: false,
  },
  colorOverlay: {
    enabled: false,
    blendMode: 'normal',
    color: '#ff0000',
    opacity: 100,
  },
  gradientOverlay: {
    enabled: false,
    blendMode: 'normal',
    stops: [
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ],
    opacity: 100,
    style: 'linear',
    angle: 90,
    scale: 100,
  },
  patternOverlay: {
    enabled: false,
    blendMode: 'normal',
    opacity: 100,
    pattern: 'checkerboard',
    scale: 100,
  },
  stroke: {
    enabled: false,
    size: 3,
    position: 'outside',
    blendMode: 'source-over',
    color: '#ff0000',
    opacity: 100,
  },
};

/* ==========================================================================
   Predicates
   ========================================================================== */

/** True when at least one of the ten effects is enabled. */
export function hasAnyEffect(e?: LayerEffects | null): boolean {
  if (!e) return false;
  return !!(
    e.dropShadow?.enabled ||
    e.innerShadow?.enabled ||
    e.outerGlow?.enabled ||
    e.innerGlow?.enabled ||
    e.bevelAndEmboss?.enabled ||
    e.satin?.enabled ||
    e.colorOverlay?.enabled ||
    e.gradientOverlay?.enabled ||
    e.patternOverlay?.enabled ||
    e.stroke?.enabled
  );
}

/** True when an effect renderable via a CSS filter (drop shadow / outer glow) is enabled. */
export function hasCssEffects(e?: LayerEffects | null): boolean {
  if (!e) return false;
  return !!(e.dropShadow?.enabled || e.outerGlow?.enabled);
}

/** True when any effect that needs canvas compositing is enabled. */
export function hasCanvasEffects(e?: LayerEffects | null): boolean {
  if (!e) return false;
  return !!(
    e.innerShadow?.enabled ||
    e.innerGlow?.enabled ||
    e.bevelAndEmboss?.enabled ||
    e.satin?.enabled ||
    e.colorOverlay?.enabled ||
    e.gradientOverlay?.enabled ||
    e.patternOverlay?.enabled ||
    e.stroke?.enabled
  );
}

/**
 * Defensive normalization: deep-merge a possibly-partial LayerEffects object
 * over DEFAULT_LAYER_EFFECTS so renderers never see undefined fields.
 * (The store seeds defaults on write, but readers must not assume it —
 * a crash here unmounts the whole canvas tree.)
 */
export function normalizeLayerEffects(e?: LayerEffects | null): LayerEffects {
  const src = (e || {}) as Record<string, any>;
  const out: Record<string, any> = {};
  for (const key of Object.keys(DEFAULT_LAYER_EFFECTS) as (keyof LayerEffects)[]) {
    const d = (DEFAULT_LAYER_EFFECTS as any)[key] || {};
    const v = src[key as string];
    out[key as string] = v && typeof v === 'object' && !Array.isArray(v) ? { ...d, ...v } : { ...d };
  }
  return out as LayerEffects;
}

/* ==========================================================================
   Small math / color helpers
   ========================================================================== */

/**
 * Photoshop angle convention: 0° = east, 90° = south (down, +y in canvas
 * coordinates). Returns the offset vector for the given distance.
 */
export function shadowOffset(angleDeg: number, distance: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: distance * Math.cos(rad), y: distance * Math.sin(rad) };
}

/** Parse #rgb / #rrggbb into [r, g, b]. Returns null for invalid input. */
function parseHex(hex: string): [number, number, number] | null {
  let clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/**
 * Interpolate a multi-stop gradient at position t (0-1). Stops are sorted by
 * offset; t is clamped. Used by tests and available to future canvas
 * gradient code paths.
 */
export function lerpGradientColor(stops: GradientStop[], t: number): string {
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);
  if (sorted.length === 0) return 'rgb(0, 0, 0)';
  const tc = Math.min(1, Math.max(0, t));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (tc <= first.offset) return hexToCss(first.color);
  if (tc >= last.offset) return hexToCss(last.color);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (tc >= a.offset && tc <= b.offset) {
      const span = b.offset - a.offset || 1;
      const f = (tc - a.offset) / span;
      const ca = parseHex(a.color) ?? [0, 0, 0];
      const cb = parseHex(b.color) ?? [0, 0, 0];
      const r = Math.round(ca[0] + (cb[0] - ca[0]) * f);
      const g = Math.round(ca[1] + (cb[1] - ca[1]) * f);
      const bch = Math.round(ca[2] + (cb[2] - ca[2]) * f);
      return `rgb(${r}, ${g}, ${bch})`;
    }
  }
  return hexToCss(last.color);
}

function hexToCss(hex: string): string {
  const c = parseHex(hex);
  if (!c) return 'rgb(0, 0, 0)';
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

/* ==========================================================================
   Blend-mode safety
   ========================================================================== */

const KNOWN_GCO: ReadonlySet<string> = new Set([
  'source-over', 'source-in', 'source-out', 'source-atop',
  'destination-over', 'destination-in', 'destination-out', 'destination-atop',
  'lighter', 'copy', 'xor',
  'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'color-dodge', 'color-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity',
  'plus-lighter', 'plus-darker',
]);

/** Map an effect blend mode string through the repo mapper; fall back to source-over for unknown values. */
function safeBlend(mode: string | undefined | null): GlobalCompositeOperation {
  const mapped = mapBlendModeToCanvas(mode as BlendMode | undefined | null);
  return (KNOWN_GCO.has(mapped) ? mapped : 'source-over') as GlobalCompositeOperation;
}

/* ==========================================================================
   CSS live-display path
   ========================================================================== */

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * CSS filter chain for the LIVE display. Drop shadow becomes
 * `drop-shadow(xpx ypx blurpx rgba(...))`; outer glow becomes
 * `drop-shadow(0px 0px sizepx color)` appended after it. Returns '' when
 * neither is enabled.
 *
 * Approximation notes: CSS drop-shadow() cannot express spread/choke or
 * per-effect blend modes — those are baked only in the canvas path.
 */
export function buildEffectFilter(e?: LayerEffects | null): string {
  if (!e) return '';
  e = normalizeLayerEffects(e);
  const parts: string[] = [];
  const ds = e.dropShadow;
  if (ds.enabled) {
    const { x, y } = shadowOffset(ds.angle, ds.distance);
    parts.push(
      `drop-shadow(${round1(x)}px ${round1(y)}px ${round1(ds.size)}px ${hexToRgba(ds.color, ds.opacity / 100)})`
    );
  }
  const og = e.outerGlow;
  if (og.enabled) {
    parts.push(
      `drop-shadow(0px 0px ${round1(og.size)}px ${hexToRgba(og.color, og.opacity / 100)})`
    );
  }
  return parts.join(' ');
}

/**
 * Pixel padding needed around the content for exterior canvas effects:
 * drop shadow (distance + size), outer glow (size), outside-position stroke
 * (size), and the outer ring of outerBevel/emboss/pillowEmboss styles.
 * Used by export so nothing gets clipped.
 */
export function effectExteriorPadding(e?: LayerEffects | null): number {
  if (!e) return 0;
  e = normalizeLayerEffects(e);
  let pad = 0;
  const ds = e.dropShadow;
  if (ds.enabled) pad = Math.max(pad, ds.distance + ds.size);
  const og = e.outerGlow;
  if (og.enabled) pad = Math.max(pad, og.size);
  const st = e.stroke;
  if (st.enabled && st.position === 'outside') pad = Math.max(pad, st.size);
  const bv = e.bevelAndEmboss;
  if (bv.enabled && (bv.style === 'outerBevel' || bv.style === 'emboss' || bv.style === 'pillowEmboss')) {
    pad = Math.max(pad, bv.size + bv.soften);
  }
  return Math.ceil(pad);
}

/* ==========================================================================
   Canvas helpers (DOM-light: document.createElement only)
   ========================================================================== */

interface CanvasPair {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

function makeCanvas(w: number, h: number): CanvasPair | null {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  return { canvas, ctx };
}

/** Opaque silhouette of the base (alpha shape, black fill). */
function silhouette(base: HTMLCanvasElement): CanvasPair | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  pair.ctx.drawImage(base, 0, 0);
  pair.ctx.globalCompositeOperation = 'source-in';
  pair.ctx.fillStyle = '#000';
  pair.ctx.fillRect(0, 0, pair.canvas.width, pair.canvas.height);
  pair.ctx.globalCompositeOperation = 'source-over';
  return pair;
}

/** Draw `steps` copies of base arranged on a circle of `radius` around (cx, cy). */
function radialStamps(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  cx: number,
  cy: number,
  radius: number,
  steps: number
): void {
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    ctx.drawImage(base, cx + Math.round(Math.cos(a) * radius), cy + Math.round(Math.sin(a) * radius));
  }
}

/** Checkerboard tile used by the pattern overlay (dialog's renderer, parameterized by tile size). */
function makeCheckerboardTile(tile: number): HTMLCanvasElement | null {
  const pair = makeCanvas(tile * 2, tile * 2);
  if (!pair) return null;
  pair.ctx.fillStyle = '#808080';
  pair.ctx.fillRect(0, 0, tile * 2, tile * 2);
  pair.ctx.fillStyle = '#c0c0c0';
  pair.ctx.fillRect(0, 0, tile, tile);
  pair.ctx.fillRect(tile, tile, tile, tile);
  return pair.canvas;
}

/**
 * Paint helper for overlay effects: copies the accumulator, applies a blend
 * fill over the copy, confines the result to the silhouette, and draws it
 * back onto the accumulator. Each overlay effect blends against the
 * cumulative result so far (Photoshop stacking).
 */
function applyOverlayPaint(
  acc: CanvasPair,
  sil: HTMLCanvasElement,
  blendMode: string,
  alpha01: number,
  paint: (c: CanvasRenderingContext2D, w: number, h: number) => void
): void {
  const w = acc.canvas.width;
  const h = acc.canvas.height;
  const t = makeCanvas(w, h);
  if (!t) return;
  t.ctx.drawImage(acc.canvas, 0, 0);
  t.ctx.globalCompositeOperation = safeBlend(blendMode);
  t.ctx.globalAlpha = Math.min(1, Math.max(0, alpha01));
  paint(t.ctx, w, h);
  t.ctx.globalAlpha = 1;
  t.ctx.globalCompositeOperation = 'destination-in';
  t.ctx.drawImage(sil, 0, 0);
  acc.ctx.save();
  acc.ctx.globalCompositeOperation = 'source-over';
  acc.ctx.globalAlpha = 1;
  acc.ctx.drawImage(t.canvas, 0, 0);
  acc.ctx.restore();
}

/**
 * Draw a pre-baked effect mask (e.g. inner shadow, glow ring, bevel pass)
 * onto the accumulator with the effect's blend mode + opacity, confined to
 * the silhouette.
 */
function applyOverlayMask(
  acc: CanvasPair,
  sil: HTMLCanvasElement,
  mask: HTMLCanvasElement,
  blendMode: string,
  alpha01: number
): void {
  applyOverlayPaint(acc, sil, blendMode, alpha01, (c, w, h) => {
    c.drawImage(mask, 0, 0, w, h);
  });
}

/* ==========================================================================
   Exterior effects (underlay)
   ========================================================================== */

function buildDropShadowLayer(
  base: HTMLCanvasElement,
  fx: { color: string; opacity: number; angle: number; distance: number; spread: number; size: number }
): HTMLCanvasElement | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  const { ctx } = pair;
  // Spread approximation: radially expand the silhouette before blurring
  // (canvas shadows have no native spread control).
  const silCanvas = silhouette(base)?.canvas;
  const spreadRadius = (fx.spread / 100) * Math.max(1, fx.size) * 0.5;
  const shape: HTMLCanvasElement = (() => {
    if (spreadRadius >= 0.5 && silCanvas) {
      const ex = makeCanvas(base.width, base.height);
      if (ex) {
        radialStamps(ex.ctx, silCanvas, 0, 0, spreadRadius, 16);
        return ex.canvas;
      }
    }
    return silCanvas ?? base;
  })();
  const { x, y } = shadowOffset(fx.angle, fx.distance);
  ctx.save();
  ctx.shadowColor = hexToRgba(fx.color, fx.opacity / 100);
  ctx.shadowBlur = Math.max(0, fx.size);
  ctx.shadowOffsetX = x;
  ctx.shadowOffsetY = y;
  ctx.drawImage(shape, 0, 0);
  ctx.restore();
  return pair.canvas;
}

function buildGlowCanvas(
  base: HTMLCanvasElement,
  fx: { color: string; opacity: number; spread: number; size: number }
): HTMLCanvasElement | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  const { ctx } = pair;
  // Spread approximation: expand the silhouette before stamping the glow.
  const radius = Math.max(0, fx.size * (1 + fx.spread / 100));
  radialStamps(ctx, base, 0, 0, radius, 24);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = fx.color;
  ctx.globalAlpha = Math.min(1, Math.max(0, fx.opacity / 100));
  ctx.fillRect(0, 0, pair.canvas.width, pair.canvas.height);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return pair.canvas;
}

function buildStrokeRing(
  base: HTMLCanvasElement,
  fx: { size: number }
): HTMLCanvasElement | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  radialStamps(pair.ctx, base, 0, 0, Math.max(0, fx.size), 32);
  return pair.canvas;
}

/**
 * Renders exterior effects UNDER the base: drop shadow, outer glow, the outer
 * ring of outerBevel/emboss/pillowEmboss styles, and outside-position stroke
 * (Photoshop order, bottom to top).
 *
 * Note: the contract lists only shadow/glow/outside-stroke here, but the
 * outer bevel ring also belongs on this padded surface — it would be clipped
 * by the same-size overlay canvas otherwise.
 *
 * Returns a canvas of size (w + 2*pad) x (h + 2*pad) where `pad` is
 * `effectExteriorPadding(e)` and the base content is anchored at (pad, pad).
 * Callers positioning the underlay should draw it at (dx - pad, dy - pad).
 * Returns null when none of the exterior effects are enabled.
 *
 * `skipShadowGlow` lets the live display skip shadow/glow (rendered via CSS
 * `buildEffectFilter`) while export uses the full version.
 */
export function renderEffectsUnderlay(
  base: HTMLCanvasElement,
  e: LayerEffects,
  opts?: { skipShadowGlow?: boolean }
): HTMLCanvasElement | null {
  e = normalizeLayerEffects(e);
  const skip = opts?.skipShadowGlow === true;
  const wantShadow = e.dropShadow.enabled && !skip;
  const wantGlow = e.outerGlow.enabled && !skip;
  const wantStroke = e.stroke.enabled && e.stroke.position === 'outside';
  const wantOuterBevel =
    e.bevelAndEmboss.enabled &&
    (e.bevelAndEmboss.style === 'outerBevel' ||
      e.bevelAndEmboss.style === 'emboss' ||
      e.bevelAndEmboss.style === 'pillowEmboss');
  if (!wantShadow && !wantGlow && !wantStroke && !wantOuterBevel) return null;

  const pad = effectExteriorPadding(e);
  const pair = makeCanvas(base.width + pad * 2, base.height + pad * 2);
  if (!pair) return null;
  const { ctx } = pair;

  // Work on a padded copy of the base so offsets/blur never clip.
  const paddedBase = makeCanvas(base.width + pad * 2, base.height + pad * 2);
  if (!paddedBase) return pair.canvas;
  paddedBase.ctx.drawImage(base, pad, pad);
  const pb = paddedBase.canvas;

  // Drop shadow (bottom-most).
  if (wantShadow) {
    const layer = buildDropShadowLayer(pb, e.dropShadow);
    if (layer) {
      ctx.save();
      ctx.globalCompositeOperation = safeBlend(e.dropShadow.blendMode);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }
  // Outer glow.
  if (wantGlow) {
    const layer = buildGlowCanvas(pb, e.outerGlow);
    if (layer) {
      ctx.save();
      ctx.globalCompositeOperation = safeBlend(e.outerGlow.blendMode);
      ctx.drawImage(layer, 0, 0);
      ctx.restore();
    }
  }
  // Outer bevel ring (outerBevel / emboss / pillowEmboss) — padded so it
  // never clips; the base drawn on top covers nothing of it since it sits
  // strictly outside the shape.
  if (wantOuterBevel) {
    const silPair = silhouette(pb);
    if (silPair) drawOuterBevelRings(pair, pad, silPair.canvas, e.bevelAndEmboss);
  }
  // Outside stroke (top-most of the underlay).
  if (wantStroke) {
    const ring = buildStrokeRing(pb, e.stroke);
    if (ring) {
      const colored = makeCanvas(pair.canvas.width, pair.canvas.height);
      if (colored) {
        colored.ctx.drawImage(ring, 0, 0);
        colored.ctx.globalCompositeOperation = 'source-in';
        colored.ctx.fillStyle = e.stroke.color;
        colored.ctx.globalAlpha = Math.min(1, Math.max(0, e.stroke.opacity / 100));
        colored.ctx.fillRect(0, 0, colored.canvas.width, colored.canvas.height);
        ctx.save();
        ctx.globalCompositeOperation = safeBlend(e.stroke.blendMode);
        ctx.drawImage(colored.canvas, 0, 0);
        ctx.restore();
      }
    }
  }
  return pair.canvas;
}

/* ==========================================================================
   Interior effects (overlay)
   ========================================================================== */

function buildInnerShadowMask(
  base: HTMLCanvasElement,
  sil: HTMLCanvasElement,
  fx: InnerShadowEffect
): HTMLCanvasElement | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  const { ctx } = pair;
  const { x, y } = shadowOffset(fx.angle, fx.distance);
  ctx.save();
  ctx.shadowColor = hexToRgba(fx.color, 1);
  // Choke tightens the shadow; approximated by shrinking the blur radius.
  ctx.shadowBlur = Math.max(0, fx.size * (1 - (fx.choke / 100) * 0.5));
  ctx.shadowOffsetX = x;
  ctx.shadowOffsetY = y;
  ctx.drawImage(sil, 0, 0);
  ctx.restore();
  // Keep only the shadow that falls INSIDE the shape.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(sil, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return pair.canvas;
}

function buildInnerGlowMask(
  base: HTMLCanvasElement,
  sil: HTMLCanvasElement,
  fx: InnerGlowEffect
): HTMLCanvasElement | null {
  const pair = makeCanvas(base.width, base.height);
  if (!pair) return null;
  const { ctx } = pair;
  if (fx.source === 'center') {
    // Approximation: radial gradient fading from the center to the edges.
    const cx = base.width / 2;
    const cy = base.height / 2;
    const r = Math.max(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, hexToRgba(fx.color, 1));
    grad.addColorStop(1, hexToRgba(fx.color, 0));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, base.width, base.height);
  } else {
    const radius = Math.max(0, fx.size * (1 - fx.choke / 100));
    radialStamps(ctx, sil, 0, 0, radius, 24);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = fx.color;
    ctx.fillRect(0, 0, base.width, base.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  // Keep the glow inside the shape.
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(sil, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return pair.canvas;
}

/**
 * One bevel light pass: casts a blurred, offset copy of the silhouette in
 * `color`, then confines it inside (inner bevel) or outside (outer bevel)
 * the shape. Returns the pass canvas.
 */
function bevelPass(
  sil: HTMLCanvasElement,
  color: string,
  offsetX: number,
  offsetY: number,
  blur: number,
  keepInside: boolean
): HTMLCanvasElement | null {
  const pair = makeCanvas(sil.width, sil.height);
  if (!pair) return null;
  const { ctx } = pair;
  ctx.save();
  ctx.shadowColor = hexToRgba(color, 1);
  ctx.shadowBlur = Math.max(0, blur);
  ctx.shadowOffsetX = offsetX;
  ctx.shadowOffsetY = offsetY;
  ctx.drawImage(sil, 0, 0);
  ctx.restore();
  // Remove the crisp silhouette itself, leaving only the blurred light.
  ctx.globalCompositeOperation = 'destination-out';
  ctx.drawImage(sil, 0, 0);
  // Confine to the inner or outer edge band.
  ctx.globalCompositeOperation = keepInside ? 'destination-in' : 'destination-out';
  ctx.drawImage(sil, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return pair.canvas;
}

function applyBevelEmbossInner(
  acc: CanvasPair,
  sil: HTMLCanvasElement,
  fx: BevelEmbossEffect
): void {
  const rad = (fx.angle * Math.PI) / 180;
  const dirSign = fx.direction === 'down' ? -1 : 1;
  // Chisel techniques reuse the smooth path with a harder (tighter) falloff.
  const blur = fx.technique === 'smooth' ? fx.size + fx.soften : Math.max(1, (fx.size + fx.soften) / 3);
  const hx = -Math.cos(rad) * fx.size * dirSign;
  const hy = -Math.sin(rad) * fx.size * dirSign;
  const sx = Math.cos(rad) * fx.size * dirSign;
  const sy = Math.sin(rad) * fx.size * dirSign;

  const depthK = Math.min(10, Math.max(0, fx.depth / 100));
  const hlAlpha = (fx.highlightOpacity / 100) * depthK;
  const shAlpha = (fx.shadowOpacity / 100) * depthK;

  const innerHighlight = bevelPass(sil, fx.highlightColor, hx, hy, blur, true);
  const innerShadow = bevelPass(sil, fx.shadowColor, sx, sy, blur, true);

  switch (fx.style) {
    case 'innerBevel':
    case 'emboss':
      // emboss = inner bevel + outer bevel (outer ring is drawn in the underlay).
      if (innerHighlight) applyOverlayMask(acc, sil, innerHighlight, fx.highlightMode, hlAlpha);
      if (innerShadow) applyOverlayMask(acc, sil, innerShadow, fx.shadowMode, shAlpha);
      break;
    case 'pillowEmboss':
      // Approximation: inverted lighting — highlight sits inside.
      if (innerHighlight) applyOverlayMask(acc, sil, innerHighlight, fx.highlightMode, hlAlpha);
      break;
    case 'outerBevel':
      // Outer-only: nothing inside the shape.
      break;
  }
}

/**
 * Outer bevel light passes (the ring OUTSIDE the shape). Drawn onto the
 * padded underlay surface so they are not clipped.
 */
function drawOuterBevelRings(
  under: CanvasPair,
  pad: number,
  sil: HTMLCanvasElement,
  fx: BevelEmbossEffect
): void {
  if (fx.style !== 'outerBevel' && fx.style !== 'emboss' && fx.style !== 'pillowEmboss') return;
  const rad = (fx.angle * Math.PI) / 180;
  const dirSign = fx.direction === 'down' ? -1 : 1;
  const blur = fx.technique === 'smooth' ? fx.size + fx.soften : Math.max(1, (fx.size + fx.soften) / 3);
  const hx = -Math.cos(rad) * fx.size * dirSign;
  const hy = -Math.sin(rad) * fx.size * dirSign;
  const sx = Math.cos(rad) * fx.size * dirSign;
  const sy = Math.sin(rad) * fx.size * dirSign;

  const depthK = Math.min(10, Math.max(0, fx.depth / 100));
  const hlAlpha = (fx.highlightOpacity / 100) * depthK;
  const shAlpha = (fx.shadowOpacity / 100) * depthK;

  const outerHighlight = bevelPass(sil, fx.highlightColor, hx, hy, blur, false);
  const outerShadow = bevelPass(sil, fx.shadowColor, sx, sy, blur, false);

  const draw = (mask: HTMLCanvasElement | null, blend: string, alpha: number) => {
    if (!mask) return;
    under.ctx.save();
    under.ctx.globalCompositeOperation = safeBlend(blend);
    under.ctx.globalAlpha = Math.min(1, Math.max(0, alpha));
    under.ctx.drawImage(mask, pad, pad);
    under.ctx.restore();
  };
  // emboss: outer ring mirrors the inner light; pillowEmboss inverts it.
  if (fx.style === 'outerBevel' || fx.style === 'emboss') {
    draw(outerHighlight, fx.highlightMode, hlAlpha);
    draw(outerShadow, fx.shadowMode, shAlpha);
  } else {
    draw(outerShadow, fx.shadowMode, shAlpha);
  }
}

function applySatin(acc: CanvasPair, sil: HTMLCanvasElement, fx: SatinEffect): void {
  const rad = (fx.angle * Math.PI) / 180;
  const sign = fx.invert ? -1 : 1;
  const dx = Math.cos(rad) * fx.distance * sign;
  const dy = Math.sin(rad) * fx.distance * sign;
  // Sheen = intersection of the silhouette with its offset copy.
  const shifted = makeCanvas(sil.width, sil.height);
  if (!shifted) return;
  shifted.ctx.drawImage(sil, dx, dy);
  shifted.ctx.globalCompositeOperation = 'destination-in';
  shifted.ctx.drawImage(sil, 0, 0);
  shifted.ctx.globalCompositeOperation = 'source-in';
  shifted.ctx.fillStyle = fx.color;
  shifted.ctx.fillRect(0, 0, sil.width, sil.height);
  shifted.ctx.globalCompositeOperation = 'source-over';
  applyOverlayMask(acc, sil, shifted.canvas, fx.blendMode, fx.opacity / 100);
}

function applyGradientOverlay(acc: CanvasPair, sil: HTMLCanvasElement, fx: LayerEffects['gradientOverlay']): void {
  applyOverlayPaint(acc, sil, fx.blendMode, fx.opacity / 100, (c, w, h) => {
    let grad: CanvasGradient | null = null;
    if (fx.style === 'radial') {
      const r = Math.max(1, (fx.scale / 100) * (Math.max(w, h) / 2));
      grad = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, r);
    } else {
      const rad = (fx.angle * Math.PI) / 180;
      const dx = Math.cos(rad);
      const dy = Math.sin(rad);
      const half = Math.hypot(w, h) / 2;
      grad = c.createLinearGradient(w / 2 - dx * half, h / 2 - dy * half, w / 2 + dx * half, h / 2 + dy * half);
    }
    const stops = [...fx.stops].sort((a, b) => a.offset - b.offset);
    if (stops.length === 0) {
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, '#000000');
    } else if (stops.length === 1) {
      grad.addColorStop(0, stops[0].color);
      grad.addColorStop(1, stops[0].color);
    } else {
      for (const s of stops) grad.addColorStop(Math.min(1, Math.max(0, s.offset)), s.color);
    }
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);
  });
}

function applyPatternOverlay(acc: CanvasPair, sil: HTMLCanvasElement, fx: LayerEffects['patternOverlay']): void {
  if (fx.pattern !== 'checkerboard') return; // pattern library is future work
  const tile = Math.max(2, Math.round(8 * (fx.scale / 100)));
  const tileCanvas = makeCheckerboardTile(tile);
  if (!tileCanvas) return;
  applyOverlayPaint(acc, sil, fx.blendMode, fx.opacity / 100, (c, w, h) => {
    const pattern = c.createPattern(tileCanvas, 'repeat');
    if (!pattern) return;
    c.fillStyle = pattern;
    c.fillRect(0, 0, w, h);
  });
}

function applyStroke(acc: CanvasPair, base: HTMLCanvasElement, sil: HTMLCanvasElement, fx: StrokeEffect): void {
  if (fx.position === 'outside') return; // handled by the underlay
  const ring = buildStrokeRing(base, fx);
  if (!ring) return;
  const colored = makeCanvas(base.width, base.height);
  if (!colored) return;
  colored.ctx.drawImage(ring, 0, 0);
  colored.ctx.globalCompositeOperation = 'source-in';
  colored.ctx.fillStyle = fx.color;
  colored.ctx.fillRect(0, 0, base.width, base.height);
  // Inside/center: keep only the part of the ring within the shape.
  colored.ctx.globalCompositeOperation = 'destination-in';
  colored.ctx.drawImage(sil, 0, 0);
  colored.ctx.globalCompositeOperation = 'source-over';
  applyOverlayMask(acc, sil, colored.canvas, fx.blendMode, fx.opacity / 100);
}

/**
 * Renders interior effects OVER the base in Photoshop stacking order
 * (top-most drawn last): color overlay, gradient overlay, pattern overlay,
 * stroke (inside/center), inner glow, satin, bevel/emboss (inner passes only —
 * outer bevel rings are rendered on the padded underlay), inner shadow.
 *
 * Returns a same-size canvas whose pixels already include the base blended
 * with the interior effects (draw it source-over onto the base). Returns null
 * when no interior effect is enabled.
 */
export function renderEffectsOverlay(base: HTMLCanvasElement, e: LayerEffects): HTMLCanvasElement | null {
  e = normalizeLayerEffects(e);
  const wantInnerShadow = e.innerShadow.enabled;
  const wantInnerGlow = e.innerGlow.enabled;
  const wantBevel = e.bevelAndEmboss.enabled;
  const wantSatin = e.satin.enabled;
  const wantColor = e.colorOverlay.enabled;
  const wantGradient = e.gradientOverlay.enabled;
  const wantPattern = e.patternOverlay.enabled;
  const wantStroke = e.stroke.enabled && e.stroke.position !== 'outside';
  if (!wantInnerShadow && !wantInnerGlow && !wantBevel && !wantSatin && !wantColor && !wantGradient && !wantPattern && !wantStroke) {
    return null;
  }

  const acc = makeCanvas(base.width, base.height);
  const silPair = silhouette(base);
  if (!acc || !silPair) return null;
  acc.ctx.drawImage(base, 0, 0);
  const sil = silPair.canvas;

  // Photoshop stacking order, top-most effect drawn last.
  if (wantColor) {
    const fx = e.colorOverlay;
    applyOverlayPaint(acc, sil, fx.blendMode, fx.opacity / 100, (c, w, h) => {
      c.fillStyle = fx.color;
      c.fillRect(0, 0, w, h);
    });
  }
  if (wantGradient) applyGradientOverlay(acc, sil, e.gradientOverlay);
  if (wantPattern) applyPatternOverlay(acc, sil, e.patternOverlay);
  if (wantStroke) applyStroke(acc, base, sil, e.stroke);
  if (wantInnerGlow) {
    const mask = buildInnerGlowMask(base, sil, e.innerGlow);
    if (mask) applyOverlayMask(acc, sil, mask, e.innerGlow.blendMode, e.innerGlow.opacity / 100);
  }
  if (wantSatin) applySatin(acc, sil, e.satin);
  if (wantBevel) applyBevelEmbossInner(acc, sil, e.bevelAndEmboss);
  if (wantInnerShadow) {
    const mask = buildInnerShadowMask(base, sil, e.innerShadow);
    if (mask) applyOverlayMask(acc, sil, mask, e.innerShadow.blendMode, e.innerShadow.opacity / 100);
  }
  return acc.canvas;
}

/* ==========================================================================
   Export path
   ========================================================================== */

/**
 * EXPORT path: draws the base with all enabled effects onto `ctx` —
 * underlay (padded exterior effects), then base, then overlay (interior
 * effects) — honoring each effect's blendMode via `mapBlendModeToCanvas`
 * (unknown values fall back to 'source-over'). The input `base` canvas is
 * never mutated. No-op passthrough (plain drawImage) when no effects are
 * enabled.
 */
export function drawLayerWithEffects(
  ctx: CanvasRenderingContext2D,
  base: HTMLCanvasElement,
  e: LayerEffects | undefined,
  dx: number,
  dy: number
): void {
  if (!hasAnyEffect(e)) {
    ctx.drawImage(base, dx, dy);
    return;
  }
  const fx = normalizeLayerEffects(e);
  const pad = effectExteriorPadding(fx);

  const underlay = renderEffectsUnderlay(base, fx);
  if (underlay) {
    ctx.drawImage(underlay, dx - pad, dy - pad);
  }
  ctx.drawImage(base, dx, dy);

  const overlay = renderEffectsOverlay(base, fx);
  if (overlay) {
    ctx.drawImage(overlay, dx, dy);
  }
}

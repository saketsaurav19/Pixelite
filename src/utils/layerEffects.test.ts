// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAYER_EFFECTS,
  TRIMMED_CONTROLS,
  hasAnyEffect,
  hasCssEffects,
  hasCanvasEffects,
  shadowOffset,
  hexToRgba,
  buildEffectFilter,
  effectExteriorPadding,
  lerpGradientColor,
  renderEffectsUnderlay,
  renderEffectsOverlay,
  drawLayerWithEffects,
} from './layerEffects.ts';
import type { LayerEffects } from '../store/types.ts';

/** Fresh deep copy of the defaults with everything disabled. */
function cleanEffects(): LayerEffects {
  return JSON.parse(JSON.stringify(DEFAULT_LAYER_EFFECTS)) as LayerEffects;
}

/** 40x40 canvas with an opaque red 20x20 square in the middle. */
function makeBase(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 40;
  c.height = 40;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(10, 10, 20, 20);
  return c;
}

function alphaAt(c: HTMLCanvasElement, x: number, y: number): number {
  const ctx = c.getContext('2d')!;
  return ctx.getImageData(x, y, 1, 1).data[3];
}

describe('shadowOffset (Photoshop convention: 0° = east, 90° = south)', () => {
  it('0° points east', () => {
    expect(shadowOffset(0, 10)).toEqual({ x: 10, y: 0 });
  });
  it('90° points south (down, +y)', () => {
    const o = shadowOffset(90, 10);
    expect(o.x).toBeCloseTo(0, 10);
    expect(o.y).toBeCloseTo(10, 10);
  });
  it('180° points west', () => {
    const o = shadowOffset(180, 10);
    expect(o.x).toBeCloseTo(-10, 10);
    expect(o.y).toBeCloseTo(0, 10);
  });
  it('270° points north (up, -y)', () => {
    const o = shadowOffset(270, 10);
    expect(o.x).toBeCloseTo(0, 10);
    expect(o.y).toBeCloseTo(-10, 10);
  });
  it('120° default splits between south and west', () => {
    const o = shadowOffset(120, 10);
    expect(o.x).toBeCloseTo(-5, 10);
    expect(o.y).toBeCloseTo(8.6603, 4);
  });
});

describe('hexToRgba', () => {
  it('converts 6-digit hex with 0-1 alpha', () => {
    expect(hexToRgba('#ff0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
    expect(hexToRgba('#000000', 0.75)).toBe('rgba(0, 0, 0, 0.75)');
  });
  it('handles 3-digit shorthand', () => {
    expect(hexToRgba('#f00', 1)).toBe('rgba(255, 0, 0, 1)');
  });
});

describe('buildEffectFilter (live CSS path)', () => {
  it('returns empty string for null/undefined/no effects', () => {
    expect(buildEffectFilter(null)).toBe('');
    expect(buildEffectFilter(undefined)).toBe('');
    expect(buildEffectFilter(cleanEffects())).toBe('');
  });
  it('emits a drop-shadow() for the drop shadow', () => {
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.dropShadow.angle = 120;
    e.dropShadow.distance = 5;
    e.dropShadow.size = 5;
    e.dropShadow.color = '#000000';
    e.dropShadow.opacity = 75;
    const f = buildEffectFilter(e);
    expect(f).toBe('drop-shadow(-2.5px 4.3px 5px rgba(0, 0, 0, 0.75))');
  });
  it('emits a centered drop-shadow() for outer glow', () => {
    const e = cleanEffects();
    e.outerGlow.enabled = true;
    e.outerGlow.size = 10;
    e.outerGlow.color = '#ff0000';
    e.outerGlow.opacity = 75;
    expect(buildEffectFilter(e)).toBe('drop-shadow(0px 0px 10px rgba(255, 0, 0, 0.75))');
  });
  it('appends glow after shadow when both enabled', () => {
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.outerGlow.enabled = true;
    const f = buildEffectFilter(e);
    expect(f.startsWith('drop-shadow(')).toBe(true);
    expect(f.split('drop-shadow(').length - 1).toBe(2);
  });
  it('ignores interior-only effects', () => {
    const e = cleanEffects();
    e.colorOverlay.enabled = true;
    e.innerShadow.enabled = true;
    expect(buildEffectFilter(e)).toBe('');
  });
});

describe('effectExteriorPadding', () => {
  it('returns 0 for no effects', () => {
    expect(effectExteriorPadding(null)).toBe(0);
    expect(effectExteriorPadding(cleanEffects())).toBe(0);
  });
  it('drop shadow pads distance + size', () => {
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.dropShadow.distance = 5;
    e.dropShadow.size = 5;
    expect(effectExteriorPadding(e)).toBe(10);
  });
  it('outer glow pads size', () => {
    const e = cleanEffects();
    e.outerGlow.enabled = true;
    e.outerGlow.size = 10;
    expect(effectExteriorPadding(e)).toBe(10);
  });
  it('outside stroke pads size; inside stroke pads nothing', () => {
    const e = cleanEffects();
    e.stroke.enabled = true;
    e.stroke.position = 'outside';
    e.stroke.size = 3;
    expect(effectExteriorPadding(e)).toBe(3);
    e.stroke.position = 'inside';
    expect(effectExteriorPadding(e)).toBe(0);
  });
  it('takes the max across exterior effects', () => {
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.dropShadow.distance = 2;
    e.dropShadow.size = 3;
    e.outerGlow.enabled = true;
    e.outerGlow.size = 20;
    expect(effectExteriorPadding(e)).toBe(20);
  });
  it('outer bevel style pads bevel size', () => {
    const e = cleanEffects();
    e.bevelAndEmboss.enabled = true;
    e.bevelAndEmboss.style = 'outerBevel';
    e.bevelAndEmboss.size = 7;
    expect(effectExteriorPadding(e)).toBe(7);
  });
});

describe('predicates', () => {
  it('hasAnyEffect is false for null and all-disabled', () => {
    expect(hasAnyEffect(null)).toBe(false);
    expect(hasAnyEffect(undefined)).toBe(false);
    expect(hasAnyEffect(cleanEffects())).toBe(false);
  });
  it('hasAnyEffect is true when any single effect is enabled', () => {
    const e = cleanEffects();
    e.satin.enabled = true;
    expect(hasAnyEffect(e)).toBe(true);
  });
  it('hasCssEffects only for drop shadow / outer glow', () => {
    const e = cleanEffects();
    expect(hasCssEffects(e)).toBe(false);
    e.innerShadow.enabled = true;
    expect(hasCssEffects(e)).toBe(false);
    e.dropShadow.enabled = true;
    expect(hasCssEffects(e)).toBe(true);
    const g = cleanEffects();
    g.outerGlow.enabled = true;
    expect(hasCssEffects(g)).toBe(true);
  });
  it('hasCanvasEffects for interior effects incl. any stroke position', () => {
    const e = cleanEffects();
    expect(hasCanvasEffects(e)).toBe(false);
    e.stroke.enabled = true;
    e.stroke.position = 'outside';
    expect(hasCanvasEffects(e)).toBe(true);
    const e2 = cleanEffects();
    e2.dropShadow.enabled = true;
    expect(hasCanvasEffects(e2)).toBe(false);
  });
});

describe('lerpGradientColor', () => {
  it('interpolates the midpoint of a two-stop gradient', () => {
    const c = lerpGradientColor(
      [
        { offset: 0, color: '#ff0000' },
        { offset: 1, color: '#0000ff' },
      ],
      0.5
    );
    expect(c).toBe('rgb(128, 0, 128)');
  });
  it('clamps t and honors exact stops', () => {
    const stops = [
      { offset: 0, color: '#ff0000' },
      { offset: 1, color: '#0000ff' },
    ];
    expect(lerpGradientColor(stops, 0)).toBe('rgb(255, 0, 0)');
    expect(lerpGradientColor(stops, 1)).toBe('rgb(0, 0, 255)');
    expect(lerpGradientColor(stops, -2)).toBe('rgb(255, 0, 0)');
    expect(lerpGradientColor(stops, 5)).toBe('rgb(0, 0, 255)');
  });
  it('picks the right segment in a three-stop gradient', () => {
    const c = lerpGradientColor(
      [
        { offset: 0, color: '#000000' },
        { offset: 0.5, color: '#ffffff' },
        { offset: 1, color: '#000000' },
      ],
      0.25
    );
    expect(c).toBe('rgb(128, 128, 128)');
  });
});

describe('DEFAULT_LAYER_EFFECTS', () => {
  const keys = [
    'dropShadow', 'innerShadow', 'outerGlow', 'innerGlow', 'bevelAndEmboss',
    'satin', 'colorOverlay', 'gradientOverlay', 'patternOverlay', 'stroke',
  ] as const;
  it('has all ten effects, each disabled by default', () => {
    for (const k of keys) {
      expect(DEFAULT_LAYER_EFFECTS[k], k).toBeDefined();
      expect(DEFAULT_LAYER_EFFECTS[k].enabled, k).toBe(false);
    }
  });
  it('carries Photoshop-ish dialog defaults', () => {
    expect(DEFAULT_LAYER_EFFECTS.dropShadow.color).toBe('#000000');
    expect(DEFAULT_LAYER_EFFECTS.dropShadow.opacity).toBe(75);
    expect(DEFAULT_LAYER_EFFECTS.dropShadow.angle).toBe(120);
    expect(DEFAULT_LAYER_EFFECTS.dropShadow.distance).toBe(5);
    expect(DEFAULT_LAYER_EFFECTS.dropShadow.size).toBe(5);
    expect(DEFAULT_LAYER_EFFECTS.outerGlow.size).toBe(10);
    expect(DEFAULT_LAYER_EFFECTS.stroke.size).toBe(3);
    expect(DEFAULT_LAYER_EFFECTS.stroke.position).toBe('outside');
    expect(DEFAULT_LAYER_EFFECTS.gradientOverlay.stops.length).toBeGreaterThanOrEqual(2);
  });
});

describe('TRIMMED_CONTROLS', () => {
  it('documents the deliberate trims', () => {
    expect(TRIMMED_CONTROLS).toContain('checkerboard');
    expect(TRIMMED_CONTROLS).toContain('solid color');
    expect(TRIMMED_CONTROLS).toContain('emboss');
  });
});

describe('renderEffectsUnderlay', () => {
  it('returns null when no exterior effect is enabled', () => {
    const base = makeBase();
    expect(renderEffectsUnderlay(base, cleanEffects())).toBeNull();
    const e = cleanEffects();
    e.colorOverlay.enabled = true;
    expect(renderEffectsUnderlay(base, e)).toBeNull();
  });
  it('returns a padded canvas for drop shadow without mutating base', () => {
    const base = makeBase();
    const before = base.toDataURL();
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.dropShadow.distance = 5;
    e.dropShadow.size = 5;
    const under = renderEffectsUnderlay(base, e);
    expect(under).not.toBeNull();
    expect(under!.width).toBe(40 + 20);
    expect(under!.height).toBe(40 + 20);
    expect(base.toDataURL()).toBe(before);
    // Shadow should be visible outside the shape: bottom-right of the square.
    expect(alphaAt(under!, 10 + 10 + 12, 10 + 10 + 14)).toBeGreaterThan(0);
  });
  it('skipShadowGlow skips shadow/glow but keeps outside stroke', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.stroke.enabled = true;
    e.stroke.position = 'outside';
    const under = renderEffectsUnderlay(base, e, { skipShadowGlow: true });
    expect(under).not.toBeNull();
    // Padding reflects the shadow (still counted) but the underlay holds stroke only.
    expect(under!.width).toBe(40 + 2 * effectExteriorPadding(e));
  });
  it('returns null when only skipped effects are enabled', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    expect(renderEffectsUnderlay(base, e, { skipShadowGlow: true })).toBeNull();
  });
  it('renders outer glow pixels around the shape', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.outerGlow.enabled = true;
    e.outerGlow.size = 10;
    const under = renderEffectsUnderlay(base, e)!;
    expect(under).not.toBeNull();
    expect(alphaAt(under, 10 + 10 + 8, 10 + 10)).toBeGreaterThan(0);
  });
});

describe('renderEffectsOverlay', () => {
  it('returns null when no interior effect is enabled', () => {
    const base = makeBase();
    expect(renderEffectsOverlay(base, cleanEffects())).toBeNull();
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    expect(renderEffectsOverlay(base, e)).toBeNull();
  });
  it('returns a same-size canvas and never mutates base', () => {
    const base = makeBase();
    const before = base.toDataURL();
    const e = cleanEffects();
    e.colorOverlay.enabled = true;
    e.colorOverlay.color = '#0000ff';
    e.colorOverlay.opacity = 100;
    const over = renderEffectsOverlay(base, e);
    expect(over).not.toBeNull();
    expect(over!.width).toBe(40);
    expect(over!.height).toBe(40);
    expect(base.toDataURL()).toBe(before);
    // Inside the red square the blue overlay should dominate.
    const px = over!.getContext('2d')!.getImageData(20, 20, 1, 1).data;
    expect(px[2]).toBeGreaterThan(px[0]);
  });
  it('renders inner shadow darkening near the lit edge', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.innerShadow.enabled = true;
    e.innerShadow.distance = 4;
    e.innerShadow.size = 4;
    const over = renderEffectsOverlay(base, e)!;
    expect(over).not.toBeNull();
    expect(alphaAt(over, 20, 20)).toBeGreaterThan(0);
  });
  it('renders a gradient overlay', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.gradientOverlay.enabled = true;
    const over = renderEffectsOverlay(base, e)!;
    expect(over).not.toBeNull();
    expect(alphaAt(over, 20, 20)).toBeGreaterThan(0);
  });
  it('renders pattern, satin, inner glow and stroke-inside without crashing', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.patternOverlay.enabled = true;
    e.satin.enabled = true;
    e.innerGlow.enabled = true;
    e.stroke.enabled = true;
    e.stroke.position = 'inside';
    const over = renderEffectsOverlay(base, e)!;
    expect(over).not.toBeNull();
    expect(over.width).toBe(40);
  });
  it('renders inner bevel without crashing', () => {
    const base = makeBase();
    const e = cleanEffects();
    e.bevelAndEmboss.enabled = true;
    const over = renderEffectsOverlay(base, e);
    expect(over).not.toBeNull();
  });
});

describe('drawLayerWithEffects', () => {
  it('passes through with a plain drawImage when no effects enabled', () => {
    const base = makeBase();
    const target = document.createElement('canvas');
    target.width = 60;
    target.height = 60;
    const ctx = target.getContext('2d')!;
    drawLayerWithEffects(ctx, base, cleanEffects(), 5, 5);
    expect(alphaAt(target, 15, 15)).toBe(255);
    expect(alphaAt(target, 2, 2)).toBe(0);
  });
  it('composites underlay + base + overlay with padding offset', () => {
    const base = makeBase();
    const target = document.createElement('canvas');
    target.width = 100;
    target.height = 100;
    const ctx = target.getContext('2d')!;
    const e = cleanEffects();
    e.dropShadow.enabled = true;
    e.dropShadow.distance = 5;
    e.dropShadow.size = 5;
    e.colorOverlay.enabled = true;
    e.colorOverlay.color = '#0000ff';
    e.colorOverlay.opacity = 100;
    const before = base.toDataURL();
    drawLayerWithEffects(ctx, base, e, 20, 20);
    // Base square lands at (20,20) + its own (10,10) offset = (30,30).
    expect(alphaAt(target, 35, 35)).toBe(255);
    const px = ctx.getImageData(35, 35, 1, 1).data;
    expect(px[2]).toBeGreaterThan(px[0]); // blue overlay on top
    expect(base.toDataURL()).toBe(before);
  });
  it('handles undefined effects as passthrough', () => {
    const base = makeBase();
    const target = document.createElement('canvas');
    target.width = 60;
    target.height = 60;
    const ctx = target.getContext('2d')!;
    drawLayerWithEffects(ctx, base, undefined, 0, 0);
    expect(alphaAt(target, 20, 20)).toBe(255);
  });
});

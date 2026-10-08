// fontkitFontService — high-fidelity text→SVG-path conversion via @pdf-lib/fontkit.
//
// Goal: turn a text layer into an SVG path string that carries true Bézier
// `C`/`Q` curve commands (so glyphs edit like real vector letters), using the
// font's actual outlines from Google Fonts.
//
// Robustness: this module is the *high-fidelity* path. Any failure (offline,
// CORS, missing @font-face block, parse error, embedded PDF font, etc.) must
// throw so the caller can fall back to the synchronous rasterize+trace path in
// `convertTextLayerToPath`. We never throw a hard error to the UI from here.

import fontkit from '@pdf-lib/fontkit';

// ---------- Public types ----------

export interface TextLayerLike {
  textContent?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: 'normal' | 'italic' | string;
  fontSize?: number;
  fontChecksum?: string;
  isVertical?: boolean;
  width?: number;
  height?: number;
}

// ---------- Cache ----------

// Per-font cache. Keyed by family + numeric weight + style so a layer
// requesting Roboto 700 italic doesn't reuse Roboto 400 regular.
const fontCache = new Map<string, any>();

const cacheKey = (family: string, weight: number, italic: boolean) =>
  `${family}|${weight}|${italic ? 'i' : 'n'}`;

// ---------- Weight normalization ----------

// The app's layer stores `fontWeight` as either a numeric string
// ('100'..'900') or a CSS keyword ('normal'|'bold'|...). The Google Fonts CSS
// axis wants a numeric weight, and we need to be sure we ask for a weight the
// family actually serves. The fixed set the rest of the app loads via
// `loadGoogleFont` (canvasUtils.ts) is 300/400/600/700, so we round to the
// nearest of those when we have no more specific information.
const APP_WEIGHTS = [300, 400, 600, 700] as const;

const normalizeWeight = (raw: string | undefined): number => {
  if (!raw) return 400;
  const lower = raw.toLowerCase();
  if (lower === 'bold') return 700;
  if (lower === 'normal') return 400;
  const n = parseInt(lower, 10);
  if (!isNaN(n) && n > 0 && n <= 900) {
    // Snap to nearest of the weights the app commonly requests. Keeps the CSS
    // URL within the small set Google serves with one `ital,wght@...` tuple
    // and avoids asking for weights the family may not have.
    let best: typeof APP_WEIGHTS[number] = APP_WEIGHTS[0];
    let bestDist = Math.abs(n - best);
    for (const w of APP_WEIGHTS) {
      const d = Math.abs(n - w);
      if (d < bestDist) {
        best = w;
        bestDist = d;
      }
    }
    return best;
  }
  return 400;
};

const isItalic = (raw: string | undefined): boolean => {
  return (raw || '').toLowerCase() === 'italic';
};

// ---------- Google Fonts CSS resolver ----------

// Parse the @font-face blocks Google returns for a css2 request. Each block
// may cover a different unicode-range subset (latin, cyrillic, greek, ...). We
// must pick the *latin* block (the one whose range includes U+0000), because
// the other subsets do not contain ASCII letters and would resolve every
// Latin glyph to `.notdef` (a rectangle). We additionally match the requested
// style (normal/italic) and weight.
interface FaceBlock {
  style: string;
  weight: number | [number, number];
  hasLatin: boolean;
  url: string;
}

const parseFaceBlocks = (css: string): FaceBlock[] => {
  const blocks: FaceBlock[] = [];
  // Split on "@font-face" then drop the leading css preamble.
  const parts = css.split('@font-face');
  for (let b = 1; b < parts.length; b++) {
    const text = parts[b];
    const styleM = text.match(/font-style:\s*([^;]+);/);
    const weightM = text.match(/font-weight:\s*([^;]+);/);
    const rangeM = text.match(/unicode-range:\s*([^;]+);/);
    const urlM = text.match(/src:\s*url\(([^)]+)\)/);
    if (!urlM) continue;
    const style = styleM ? styleM[1].trim().toLowerCase() : 'normal';
    let weight: number | [number, number] = 400;
    if (weightM) {
      const nums = weightM[1].trim().split(/\s+/).map((s) => parseInt(s, 10));
      if (nums.length === 2) weight = [nums[0], nums[1]];
      else if (nums.length === 1 && !isNaN(nums[0])) weight = nums[0];
    }
    const hasLatin = !!rangeM && /U\+0000/.test(rangeM[1]);
    blocks.push({ style, weight, hasLatin, url: urlM[1] });
  }
  return blocks;
};

const selectWoff2Url = (blocks: FaceBlock[], italic: boolean, weight: number): string | null => {
  const matchStyle = (bk: FaceBlock) => (bk.style === 'italic') === italic;
  const matchWeight = (bk: FaceBlock) => {
    if (typeof bk.weight === 'number') return bk.weight === weight;
    return weight >= bk.weight[0] && weight <= bk.weight[1];
  };
  const candidates = blocks.filter((bk) => matchStyle(bk) && matchWeight(bk));
  if (candidates.length === 0) return null;
  // Prefer the latin subset block (contains ASCII glyphs).
  const latin = candidates.find((bk) => bk.hasLatin);
  return (latin || candidates[0]).url;
};

export const getGoogleFontWoff2Url = async (
  family: string,
  weight: number,
  italic: boolean
): Promise<string> => {
  const cssFamily = encodeURIComponent(family).replace(/%20/g, '+');
  // `ital,wght@0,400;1,400` requests both upright and italic at the same
  // weight. A single tuple keeps the URL short and Google returns a stable
  // set of @font-face blocks.
  const cssUrl = `https://fonts.googleapis.com/css2?family=${cssFamily}:ital,wght@${italic ? 1 : 0},${weight}&display=swap`;

  const cssRes = await fetch(cssUrl, {
    // Google Fonts only returns the woff2 variant when the request advertises
    // a modern browser. Without this header older UA strings get a TTF URL.
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!cssRes.ok) {
    throw new Error(`Google Fonts CSS fetch failed: ${cssRes.status}`);
  }
  const css = await cssRes.text();
  const blocks = parseFaceBlocks(css);
  const url = selectWoff2Url(blocks, italic, weight);
  if (!url) {
    throw new Error(`No matching @font-face for ${family} ${italic ? 'italic' : 'normal'} ${weight}`);
  }
  return url;
};

// ---------- Font loader ----------

export const loadFont = async (
  family: string,
  weight: number,
  italic: boolean
): Promise<any> => {
  const key = cacheKey(family, weight, italic);
  const cached = fontCache.get(key);
  if (cached) return cached;

  const woff2Url = await getGoogleFontWoff2Url(family, weight, italic);
  const res = await fetch(woff2Url);
  if (!res.ok) {
    throw new Error(`Font file fetch failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  // fontkit parses WOFF2 natively (Brotli decompress + variable-font
  // instancing) and emits true `Q` (TrueType) / `C` (CFF) Bézier commands.
  const font = fontkit.create(new Uint8Array(buf));
  fontCache.set(key, font);
  return font;
};

// ---------- SVG path builder ----------

// Convert a fontkit glyph path (in font design units) into SVG `d` tokens,
// applying the pen position (penX) and baseline (baseY) for this line.
// fontkit command args:
//   moveTo [x,y]
//   lineTo [x,y]
//   quadraticCurveTo [cpx,cpy,x,y]
//   cubicCurveTo [cp1x,cp1y,cp2x,cp2y,x,y]
//   closePath []
// font design space has y pointing UP; canvas/SVG space has y pointing DOWN,
// so we negate y.
const glyphCommandsToD = (
  commands: any[],
  scale: number,
  penX: number,
  baseY: number
): string => {
  let d = '';
  for (const c of commands) {
    const a = c.args;
    switch (c.command) {
      case 'moveTo':
        d += `M ${((penX + a[0]) * scale).toFixed(2)} ${(-a[1] * scale + baseY).toFixed(2)} `;
        break;
      case 'lineTo':
        d += `L ${((penX + a[0]) * scale).toFixed(2)} ${(-a[1] * scale + baseY).toFixed(2)} `;
        break;
      case 'quadraticCurveTo':
        d += `Q ${((penX + a[0]) * scale).toFixed(2)} ${(-a[1] * scale + baseY).toFixed(2)} ` +
             `${((penX + a[2]) * scale).toFixed(2)} ${(-a[3] * scale + baseY).toFixed(2)} `;
        break;
      case 'cubicCurveTo':
        d += `C ${((penX + a[0]) * scale).toFixed(2)} ${(-a[1] * scale + baseY).toFixed(2)} ` +
             `${((penX + a[2]) * scale).toFixed(2)} ${(-a[3] * scale + baseY).toFixed(2)} ` +
             `${((penX + a[4]) * scale).toFixed(2)} ${(-a[5] * scale + baseY).toFixed(2)} `;
        break;
      case 'closePath':
        d += 'Z ';
        break;
      default:
        break;
    }
  }
  return d;
};

// ---------- Top-level: text layer → Bézier svgPath ----------

export const textLayerToBezierSvgPath = async (layer: TextLayerLike): Promise<string> => {
  // Skip conditions where fontkit cannot help.
  if (!layer.textContent || !layer.textContent.trim()) {
    throw new Error('Empty text');
  }
  if (layer.fontChecksum) {
    // Embedded PDF font — no Google URL. Use the trace fallback.
    throw new Error('Embedded font: not applicable');
  }
  if (!layer.fontFamily) {
    throw new Error('Missing font family');
  }
  // The app stores fontFamily as a CSS shorthand chain like
  // "Inter, system-ui, sans-serif". Google Fonts only serves the first family
  // in that chain. Extract it before resolving.
  const family = layer.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
  if (!family) {
    throw new Error('Empty font family after parsing');
  }
  // Generic CSS families don't have a Google URL either. The trace path can
  // still render them via the browser's built-in fonts.
  const generic = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']);
  if (generic.has(family.toLowerCase())) {
    throw new Error(`Generic font family: ${family}`);
  }

  const fs = layer.fontSize || 40;
  const weight = normalizeWeight(layer.fontWeight);
  const italic = isItalic(layer.fontStyle);
  const font = await loadFont(family, weight, italic);

  const scale = fs / font.unitsPerEm;
  const lineHeight = fs * 1.2;
  const dParts: string[] = [];

  layer.textContent.split('\n').forEach((line, li) => {
    if (!line) return;
    const baseY = li * lineHeight + fs; // baseline of this line (SVG y-down)
    const run = font.layout(line);
    let penX = 0;
    run.glyphs.forEach((glyph: any, i: number) => {
      const pos = run.positions[i];
      if (glyph.path && glyph.path.commands.length) {
        dParts.push(glyphCommandsToD(glyph.path.commands, scale, penX, baseY));
      }
      penX += pos.xAdvance;
    });
  });

  const d = dParts.join(' ').trim();
  if (!d) {
    throw new Error('Empty fontkit output (missing glyphs?)');
  }
  return d;
};

// ---------- Test hooks ----------

// Exposed for unit tests / manual debugging. Not used by app code paths.
export const __testing = {
  fontCache,
  normalizeWeight,
  parseFaceBlocks,
  selectWoff2Url,
  glyphCommandsToD,
};

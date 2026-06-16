import { Blob, Face, Font, Buffer, shape, Direction } from 'harfbuzzjs';
// @ts-ignore
import bidiFactory from 'bidi-js';
import { FontRegistry } from './FontRegistry';
import fontDb from '../../fonts/font-database.json';

const bidi = bidiFactory();

const fontCache: Record<string, ArrayBuffer> = {};

async function getFontData(fontUrl: string): Promise<ArrayBuffer> {
  if (fontCache[fontUrl]) {
    return fontCache[fontUrl];
  }
  const res = await fetch(fontUrl);
  if (!res.ok) {
    throw new Error(`Failed to load font from ${fontUrl}`);
  }
  const buffer = await res.arrayBuffer();
  fontCache[fontUrl] = buffer;
  return buffer;
}

export type ScriptType = 'devanagari' | 'arabic' | 'hebrew' | 'regular';

async function loadFontData(scriptType: ScriptType, fontName?: string): Promise<ArrayBuffer> {
  if (fontName) {
    const cleanName = fontName.replace(/^[A-Z]{6}\+/, '').toLowerCase();
    const dbEntry = fontDb.fonts.find(f => f.name.toLowerCase() === cleanName || f.fullName.toLowerCase() === cleanName);
    if (dbEntry && dbEntry.url) {
      try {
        return await getFontData(dbEntry.url);
      } catch (err) {
        console.warn(`Failed to load font from database CDN for ${fontName}:`, err);
      }
    }
  }

  let localUrl = '';
  let fallbackUrl = '';

  switch (scriptType) {
    case 'devanagari':
      localUrl = '/fonts/NotoSansDevanagari.ttf';
      fallbackUrl = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf';
      break;
    case 'arabic':
      localUrl = '/fonts/NotoSansArabic-Regular.ttf';
      fallbackUrl = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf';
      break;
    case 'hebrew':
      localUrl = '/fonts/NotoSansHebrew-Regular.ttf';
      fallbackUrl = 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansHebrew/NotoSansHebrew-Regular.ttf';
      break;
    default:
      localUrl = '/fonts/NotoSans-Regular.ttf';
      fallbackUrl = 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@master/hinted/ttf/NotoSans/NotoSans-Regular.ttf';
      break;
  }

  try {
    return await getFontData(localUrl);
  } catch (err) {
    console.warn(`Local font load failed for ${localUrl}, falling back to remote CDN...`, err);
    return await getFontData(fallbackUrl);
  }
}

export interface ShapedGlyph {
  path: string;
  x: number;
  y: number;
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

export interface ShapedTextResult {
  glyphs: ShapedGlyph[];
  width: number;
  height: number;
  fontSize: number;
  upem: number;
  ascender: number;
  descender: number;
  lineGap: number;
}

/** A single Unicode cluster with its HarfBuzz-computed x position. */
export interface TextCluster {
  /** The Unicode text of this cluster (one or more codepoints). */
  text: string;
  /** Absolute x position in px from the start of the shaped line. */
  x: number;
  /** Advance width of this cluster in px. */
  xAdvance: number;
  /** 'ltr' or 'rtl' — used by the renderer to set CSS direction. */
  direction: 'ltr' | 'rtl';
}

const fontInstancesCache: Record<ScriptType, { font: Font; upem: number } | null> = {
  devanagari: null,
  arabic: null,
  hebrew: null,
  regular: null
};

const customFontInstancesCache: Record<string, { font: Font; upem: number }> = {};

async function getFontInstance(
  scriptType: ScriptType,
  fontChecksum?: string,
  fontName?: string
): Promise<{ font: Font; upem: number }> {
  let fontData: ArrayBuffer | null = null;
  let cacheKey = '';

  // 1. Try to find extracted font by checksum in registry
  if (fontChecksum) {
    const regFont = FontRegistry.get(fontChecksum);
    if (regFont) {
      fontData = regFont.data.buffer as ArrayBuffer;
      cacheKey = fontChecksum;
    }
  }

  // 2. Try to find extracted font by name in registry
  if (!fontData && fontName) {
    const regFont = FontRegistry.getByName(fontName);
    if (regFont) {
      fontData = regFont.data.buffer as ArrayBuffer;
      cacheKey = regFont.name;
    }
  }

  // If we found custom font data, return or cache it
  if (fontData && cacheKey) {
    if (customFontInstancesCache[cacheKey]) {
      return customFontInstancesCache[cacheKey];
    }
    try {
      const blob = new Blob(fontData);
      const face = new Face(blob, 0);
      const font = new Font(face);
      const upem = face.upem || 1000;
      font.setScale(upem, upem);

      const cacheItem = { font, upem };
      customFontInstancesCache[cacheKey] = cacheItem;
      return cacheItem;
    } catch (err) {
      console.warn(`Failed to initialize HarfBuzz face with custom font ${cacheKey}:`, err);
    }
  }

  // 3. Try to resolve via database CDN
  if (fontName) {
    const cleanName = fontName.replace(/^[A-Z]{6}\+/, '').toLowerCase();
    const cacheKeyCDN = `cdn-${cleanName}`;
    if (customFontInstancesCache[cacheKeyCDN]) {
      return customFontInstancesCache[cacheKeyCDN];
    }
    try {
      const dbFontData = await loadFontData(scriptType, fontName);
      const blob = new Blob(dbFontData);
      const face = new Face(blob, 0);
      const font = new Font(face);
      const upem = face.upem || 1000;
      font.setScale(upem, upem);

      const cacheItem = { font, upem };
      customFontInstancesCache[cacheKeyCDN] = cacheItem;
      return cacheItem;
    } catch (err) {
      // ignore, fallback to standard script font
    }
  }

  // 4. Fallback: Standard script caching and loading
  const cached = fontInstancesCache[scriptType];
  if (cached) return cached;

  const standardFontData = await loadFontData(scriptType);
  const blob = new Blob(standardFontData);
  const face = new Face(blob, 0);
  const font = new Font(face);
  const upem = face.upem || 1000;
  font.setScale(upem, upem);

  const cacheItem = { font, upem };
  fontInstancesCache[scriptType] = cacheItem;
  return cacheItem;
}

function getScriptType(char: string): ScriptType {
  const code = char.codePointAt(0) || 0;
  // Devanagari range
  if (code >= 0x0900 && code <= 0x097F) {
    return 'devanagari';
  }
  // Arabic range (main block, supplements, presentation forms)
  if (
    (code >= 0x0600 && code <= 0x06FF) ||
    (code >= 0x0750 && code <= 0x077F) ||
    (code >= 0x08A0 && code <= 0x08FF) ||
    (code >= 0xFB50 && code <= 0xFDFF) ||
    (code >= 0xFE70 && code <= 0xFEFF)
  ) {
    return 'arabic';
  }
  // Hebrew range
  if ((code >= 0x0590 && code <= 0x05FF) || (code >= 0xFB1D && code <= 0xFB4F)) {
    return 'hebrew';
  }
  return 'regular';
}

function resolveScripts(text: string): ScriptType[] {
  const isNeutralChar = (c: string) => /^[0-9\s!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]$/.test(c);

  const scripts: (ScriptType | undefined)[] = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (isNeutralChar(char)) {
      scripts.push(undefined);
    } else {
      scripts.push(getScriptType(char));
    }
  }

  // Forward propagation of strong script
  let lastStrong: ScriptType | undefined = undefined;
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i] !== undefined) {
      lastStrong = scripts[i];
    } else if (lastStrong !== undefined) {
      scripts[i] = lastStrong;
    }
  }

  // Backward propagation of strong script (for leading neutrals)
  let nextStrong: ScriptType | undefined = undefined;
  for (let i = scripts.length - 1; i >= 0; i--) {
    if (scripts[i] !== undefined) {
      nextStrong = scripts[i];
    } else if (nextStrong !== undefined) {
      scripts[i] = nextStrong;
    }
  }

  return scripts.map(s => s || 'regular');
}

interface TextRun {
  text: string;
  script: ScriptType;
  level: number;
  direction: 'ltr' | 'rtl';
  startIndex: number;
  endIndex: number;
}

function segmentText(text: string, levels: Uint8Array, scripts: ScriptType[]): TextRun[] {
  if (!text) return [];

  const runs: TextRun[] = [];
  let currentRunText = text[0];
  let currentLevel = levels[0];
  let currentScript = scripts[0];
  let startIndex = 0;

  for (let i = 1; i < text.length; i++) {
    const level = levels[i];
    const script = scripts[i];
    const char = text[i];

    if (level === currentLevel && script === currentScript) {
      currentRunText += char;
    } else {
      runs.push({
        text: currentRunText,
        script: currentScript,
        level: currentLevel,
        direction: (currentLevel % 2 === 0) ? 'ltr' : 'rtl',
        startIndex,
        endIndex: i - 1
      });
      currentRunText = char;
      currentLevel = level;
      currentScript = script;
      startIndex = i;
    }
  }

  runs.push({
    text: currentRunText,
    script: currentScript,
    level: currentLevel,
    direction: (currentLevel % 2 === 0) ? 'ltr' : 'rtl',
    startIndex,
    endIndex: text.length - 1
  });

  return runs;
}

function mirrorRunText(runText: string, runLevel: number): string {
  if (runLevel % 2 === 0) return runText;

  const chars = Array.from(runText);
  for (let i = 0; i < chars.length; i++) {
    const mirrored = bidi.getMirroredCharacter(chars[i]);
    if (mirrored !== null) {
      chars[i] = mirrored;
    }
  }
  return chars.join('');
}

interface ShapedRun {
  run: TextRun;
  glyphs: ShapedGlyph[];
  width: number;
  upem: number;
  ascender: number;
  descender: number;
  lineGap: number;
}

function reorderRuns(runs: ShapedRun[], baseLevel: number): ShapedRun[] {
  if (runs.length <= 1) return runs;

  let maxLevel = baseLevel;
  let minOddLevel = 127;

  for (const r of runs) {
    if (r.run.level > maxLevel) {
      maxLevel = r.run.level;
    }
    if ((r.run.level & 1) && r.run.level < minOddLevel) {
      minOddLevel = r.run.level;
    }
  }

  if (minOddLevel === 127) {
    return runs;
  }

  const result = [...runs];

  for (let lvl = maxLevel; lvl >= minOddLevel; lvl--) {
    let i = 0;
    while (i < result.length) {
      if (result[i].run.level >= lvl) {
        const start = i;
        while (i + 1 < result.length && result[i + 1].run.level >= lvl) {
          i++;
        }
        const end = i;
        const sliced = result.slice(start, end + 1);
        sliced.reverse();
        result.splice(start, sliced.length, ...sliced);
      }
      i++;
    }
  }

  return result;
}

export async function shapeTextWasm(
  text: string,
  fontSize: number,
  fontChecksum?: string,
  fontName?: string
): Promise<ShapedTextResult> {
  if (!text) {
    return {
      glyphs: [],
      width: 0,
      height: fontSize,
      fontSize,
      upem: 1000,
      ascender: 0,
      descender: 0,
      lineGap: 0
    };
  }

  // 1. Resolve bidi levels using bidi-js
  const bidiResult = bidi.getEmbeddingLevels(text, 'auto');
  const baseLevel = bidiResult.paragraphs[0]?.level || 0;
  const levels = bidiResult.levels;

  // 2. Resolve script runs
  const scripts = resolveScripts(text);

  // 3. Segment text into runs
  const textRuns = segmentText(text, levels, scripts);

  // 4. Shape each run using HarfBuzz
  const shapedRuns: ShapedRun[] = [];

  let primaryUpem = 1000;
  let primaryAscender = 0;
  let primaryDescender = 0;
  let primaryLineGap = 0;
  let hasSetPrimaryMetrics = false;

  for (const run of textRuns) {
    const { font, upem } = await getFontInstance(run.script, fontChecksum, fontName);
    const scale = fontSize / upem;

    if (!hasSetPrimaryMetrics) {
      primaryUpem = upem;
      const extents = font.hExtents();
      primaryAscender = (extents.ascender || 0) * scale;
      primaryDescender = (extents.descender || 0) * scale;
      primaryLineGap = (extents.lineGap || 0) * scale;
      hasSetPrimaryMetrics = true;
    }

    const buffer = new Buffer();
    const shapedText = mirrorRunText(run.text, run.level);
    buffer.addText(shapedText);
    buffer.setDirection(run.direction === 'rtl' ? Direction.RTL : Direction.LTR);

    // Set script and language tags
    let scriptTag = 'latn';
    let langTag = 'en';
    if (run.script === 'devanagari') {
      scriptTag = 'deva';
      langTag = 'hi';
    } else if (run.script === 'arabic') {
      scriptTag = 'arab';
      langTag = 'ar';
    } else if (run.script === 'hebrew') {
      scriptTag = 'hebr';
      langTag = 'he';
    }

    buffer.setScript(scriptTag);
    buffer.setLanguage(langTag);

    shape(font, buffer);

    const infos = buffer.getGlyphInfosAndPositions();
    const glyphs: ShapedGlyph[] = [];
    let currentX = 0;
    let currentY = 0;

    for (const info of infos) {
      const glyphId = info.codepoint;
      const path = font.glyphToPath(glyphId) || '';

      const xOffset = (info.xOffset || 0) * scale;
      const yOffset = (info.yOffset || 0) * scale;
      const xAdvance = (info.xAdvance || 0) * scale;
      const yAdvance = (info.yAdvance || 0) * scale;

      glyphs.push({
        path,
        x: currentX,
        y: currentY,
        xAdvance,
        yAdvance,
        xOffset,
        yOffset
      });

      currentX += xAdvance;
      currentY += yAdvance;
    }

    shapedRuns.push({
      run,
      glyphs,
      width: currentX,
      upem,
      ascender: (font.hExtents().ascender || 0) * scale,
      descender: (font.hExtents().descender || 0) * scale,
      lineGap: (font.hExtents().lineGap || 0) * scale
    });
  }

  // 5. Reorder shaped runs according to UAX #9 L2
  const visuallyOrderedRuns = reorderRuns(shapedRuns, baseLevel);

  // 6. Assemble global shaped glyph positions
  const finalGlyphs: ShapedGlyph[] = [];
  let globalX = 0;

  for (const run of visuallyOrderedRuns) {
    for (const g of run.glyphs) {
      finalGlyphs.push({
        ...g,
        x: globalX + g.x
      });
    }
    globalX += run.width;
  }

  return {
    glyphs: finalGlyphs,
    width: globalX,
    height: fontSize,
    fontSize,
    upem: primaryUpem,
    ascender: primaryAscender,
    descender: primaryDescender,
    lineGap: primaryLineGap
  };
}

// ─── Cluster-position shaping (for HTML span rendering) ──────────────────────
//
// Instead of returning SVG glyph paths, this function returns the HarfBuzz
// advance positions per Unicode cluster, so each cluster can be placed as an
// absolutely-positioned HTML <span>. The browser's native text engine renders
// each cluster's glyphs (conjuncts, ligatures, matras, etc.) correctly.

/**
 * Shape `text` and return per-cluster positions for HTML <span> rendering.
 * Returns null if shaping fails (caller falls back to unpositioned CSS spans).
 */
export async function getShapedPositions(
  text: string,
  fontSize: number,
  fontChecksum?: string,
  fontName?: string
): Promise<TextCluster[] | null> {
  if (!text) return null;

  try {
    // 1. Bidi analysis
    const bidiResult = bidi.getEmbeddingLevels(text, 'auto');
    const baseLevel: number = bidiResult.paragraphs[0]?.level ?? 0;
    const levels: Uint8Array = bidiResult.levels;

    // 2. Script segmentation
    const scripts = resolveScripts(text);

    // 3. Break into bidi+script runs
    const textRuns = segmentText(text, levels, scripts);

    // Track logical char offset into the full `text` string per run
    let logicalOffset = 0;

    interface ProcessedRun {
      run: TextRun;
      clusters: { text: string; width: number }[];
      totalWidth: number;
    }

    const processedRuns: ProcessedRun[] = [];

    for (const run of textRuns) {
      const { font, upem } = await getFontInstance(run.script, fontChecksum, fontName);
      const scale = fontSize / upem;

      const buf = new Buffer();
      buf.addText(mirrorRunText(run.text, run.level));
      buf.setDirection(run.direction === 'rtl' ? Direction.RTL : Direction.LTR);

      let scriptTag = 'latn', langTag = 'en';
      if (run.script === 'devanagari') { scriptTag = 'deva'; langTag = 'hi'; }
      else if (run.script === 'arabic')    { scriptTag = 'arab'; langTag = 'ar'; }
      else if (run.script === 'hebrew')    { scriptTag = 'hebr'; langTag = 'he'; }
      buf.setScript(scriptTag);
      buf.setLanguage(langTag);
      shape(font, buf);

      const infos = buf.getGlyphInfosAndPositions();

      // Accumulate advance widths per cluster index (into run.text)
      const clusterAdvances = new Map<number, number>();
      for (const info of infos) {
        const c = info.cluster as number;
        clusterAdvances.set(c, (clusterAdvances.get(c) ?? 0) + (info.xAdvance ?? 0) * scale);
      }

      // Sort cluster start indices in logical (string) order
      const sortedClusterStarts = Array.from(clusterAdvances.keys()).sort((a, b) => a - b);

      // Build cluster list: extract text substring for each cluster
      const runClusters: { text: string; width: number }[] = [];
      let totalWidth = 0;
      for (let i = 0; i < sortedClusterStarts.length; i++) {
        const c = sortedClusterStarts[i];
        const nextC = sortedClusterStarts[i + 1];
        const clusterText = nextC !== undefined
          ? run.text.substring(c, nextC)
          : run.text.substring(c);
        const width = clusterAdvances.get(c) ?? 0;
        runClusters.push({ text: clusterText, width });
        totalWidth += width;
      }

      // For RTL runs, reverse clusters into visual (left→right screen) order
      if (run.direction === 'rtl') {
        runClusters.reverse();
      }

      processedRuns.push({ run, clusters: runClusters, totalWidth });
      logicalOffset += run.text.length;
    }

    // 4. Reorder runs visually using UAX #9 L2 (same algorithm as reorderRuns)
    const runLevels = processedRuns.map(r => r.run.level);
    const visualRunOrder = computeVisualRunOrder(runLevels, baseLevel);

    // 5. Assemble final cluster list with global x positions
    const finalClusters: TextCluster[] = [];
    let globalX = 0;

    for (const ri of visualRunOrder) {
      const { run, clusters } = processedRuns[ri];
      for (const cluster of clusters) {
        finalClusters.push({
          text:      cluster.text,
          x:         globalX,
          xAdvance:  cluster.width,
          direction: run.direction,
        });
        globalX += cluster.width;
      }
    }

    return finalClusters.length > 0 ? finalClusters : null;

  } catch (err) {
    console.warn('[WasmShaper] getShapedPositions failed:', err);
    return null;
  }
}

/** UAX #9 L2 visual run ordering — same logic as reorderRuns() but for index arrays. */
function computeVisualRunOrder(levels: number[], baseLevel: number): number[] {
  const indices = levels.map((_, i) => i);
  if (levels.length <= 1) return indices;

  const maxLevel = levels.reduce((m, l) => Math.max(m, l), baseLevel);
  const minOddLevel = levels.filter(l => l % 2 !== 0).reduce((m, l) => Math.min(m, l), 127);

  if (minOddLevel === 127) return indices; // all LTR — no reordering needed

  const result = [...indices];
  for (let lvl = maxLevel; lvl >= minOddLevel; lvl--) {
    let i = 0;
    while (i < result.length) {
      if (levels[result[i]] >= lvl) {
        const start = i;
        while (i + 1 < result.length && levels[result[i + 1]] >= lvl) i++;
        result.splice(start, i - start + 1, ...result.slice(start, i + 1).reverse());
      }
      i++;
    }
  }
  return result;
}

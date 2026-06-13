import { Blob, Face, Font, Buffer, shape } from 'harfbuzzjs';

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

async function loadFontData(isDevanagari: boolean): Promise<ArrayBuffer> {
  const localUrl = isDevanagari
    ? '/fonts/NotoSansDevanagari.ttf'
    : '/fonts/NotoSans-Regular.ttf';

  const fallbackUrl = isDevanagari
    ? 'https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf'
    : 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@master/hinted/ttf/NotoSans/NotoSans-Regular.ttf';

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

// Cache Font and upem instances so we don't recreate them constantly
let devanagariFontCache: { font: Font; upem: number } | null = null;
let regularFontCache: { font: Font; upem: number } | null = null;

async function getFontInstance(isDevanagari: boolean): Promise<{ font: Font; upem: number }> {
  if (isDevanagari && devanagariFontCache) return devanagariFontCache;
  if (!isDevanagari && regularFontCache) return regularFontCache;

  const fontData = await loadFontData(isDevanagari);
  const blob = new Blob(fontData);
  const face = new Face(blob, 0);
  const font = new Font(face);
  const upem = face.upem || 1000;
  font.setScale(upem, upem);

  const cacheItem = { font, upem };
  if (isDevanagari) {
    devanagariFontCache = cacheItem;
  } else {
    regularFontCache = cacheItem;
  }
  return cacheItem;
}

function splitIntoScriptRuns(text: string): { text: string; isDevanagari: boolean }[] {
  if (!text) return [];

  const isDevanagariChar = (c: string) => /[\u0900-\u097F]/.test(c);
  const isNeutralChar = (c: string) => /^[0-9\s!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]$/.test(c);

  const runs: { text: string; isDevanagari: boolean }[] = [];
  let currentRunText = '';
  let currentRunIsDevanagari = false;
  let hasSetDirection = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const isDev = isDevanagariChar(char);
    const isNeutral = isNeutralChar(char);

    if (isNeutral) {
      if (!hasSetDirection) {
        let nextStrongIsDev = false;
        for (let j = i + 1; j < text.length; j++) {
          if (!isNeutralChar(text[j])) {
            nextStrongIsDev = isDevanagariChar(text[j]);
            break;
          }
        }
        currentRunIsDevanagari = nextStrongIsDev;
        hasSetDirection = true;
      }
      currentRunText += char;
    } else {
      if (!hasSetDirection) {
        currentRunIsDevanagari = isDev;
        hasSetDirection = true;
        currentRunText += char;
      } else if (isDev === currentRunIsDevanagari) {
        currentRunText += char;
      } else {
        runs.push({ text: currentRunText, isDevanagari: currentRunIsDevanagari });
        currentRunText = char;
        currentRunIsDevanagari = isDev;
      }
    }
  }

  if (currentRunText) {
    runs.push({ text: currentRunText, isDevanagari: currentRunIsDevanagari });
  }

  return runs;
}

export async function shapeTextWasm(
  text: string,
  fontSize: number
): Promise<ShapedTextResult> {
  const runs = splitIntoScriptRuns(text);
  const glyphs: ShapedGlyph[] = [];
  let currentX = 0;
  let currentY = 0;

  let primaryUpem = 1000;
  let primaryAscender = 0;
  let primaryDescender = 0;
  let primaryLineGap = 0;
  let hasSetPrimaryMetrics = false;

  for (const run of runs) {
    const { font, upem } = await getFontInstance(run.isDevanagari);
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
    buffer.addText(run.text);
    buffer.guessSegmentProperties();

    shape(font, buffer);

    const infos = buffer.getGlyphInfosAndPositions();
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
  }

  return {
    glyphs,
    width: currentX,
    height: fontSize,
    fontSize,
    upem: primaryUpem,
    ascender: primaryAscender,
    descender: primaryDescender,
    lineGap: primaryLineGap
  };
}

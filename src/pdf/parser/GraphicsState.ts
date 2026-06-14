/**
 * GraphicsState — PDF Graphics State Machine
 *
 * Implements a stack-based graphics state machine that mirrors the PDF
 * rendering model. As PdfjsParser walks getOperatorList(), it calls
 * methods on this class to keep the state in sync. Every engine (Text,
 * Vector, Image) reads the current state when it emits a node so that
 * colors, opacity, rotation, and line widths are always accurate.
 *
 * PDF spec reference: ISO 32000-1 §8.4 Graphics State
 */
import * as pdfjsLib from 'pdfjs-dist';

export interface GraphicsStateSnapshot {
  /** Current Transformation Matrix [a, b, c, d, e, f] */
  ctm: number[];
  /** CSS fill color string, e.g. "#ff0000" */
  fillColor: string;
  /** CSS stroke color string */
  strokeColor: string;
  /** Line width in user units */
  lineWidth: number;
  /** Overall alpha (combined fill + stroke via ExtGState) */
  fillOpacity: number;
  strokeOpacity: number;
  /** CSS blend mode string, e.g. "multiply" */
  blendMode: string;
  /** Current font name (raw PDF font key, e.g. "g_d0_f2") */
  fontName: string;
  /** Current font size in user units */
  fontSize: number;
  /** Text matrix [a, b, c, d, e, f] — encodes position + rotation */
  textMatrix: number[];
  /** Active color space */
  fillColorSpace: 'rgb' | 'cmyk' | 'gray' | 'spot';
  strokeColorSpace: 'rgb' | 'cmyk' | 'gray' | 'spot';
  /** Line styles (cap, join, limit, dash) */
  lineCap: 'butt' | 'round' | 'square';
  lineJoin: 'miter' | 'round' | 'bevel';
  miterLimit: number;
  lineDashPattern: number[];
  lineDashPhase: number;
}



/** Convert [r,g,b] floats (0–1) to CSS hex color */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Convert gray float (0–1) to CSS hex color */
function grayToHex(g: number): string {
  return rgbToHex(g, g, g);
}

/** Convert CMYK floats (0–1) to CSS hex color (approximate) */
function cmykToHex(c: number, m: number, y: number, k: number): string {
  const r = 1 - Math.min(1, c + k);
  const g = 1 - Math.min(1, m + k);
  const b = 1 - Math.min(1, y + k);
  return rgbToHex(r, g, b);
}

const IDENTITY_MATRIX = [1, 0, 0, 1, 0, 0];
const IDENTITY_TEXT_MATRIX = [1, 0, 0, 1, 0, 0];

function defaultState(): GraphicsStateSnapshot {
  return {
    ctm: [...IDENTITY_MATRIX],
    fillColor: '#000000',
    strokeColor: '#000000',
    lineWidth: 1,
    fillOpacity: 1,
    strokeOpacity: 1,
    blendMode: 'source-over',
    fontName: '',
    fontSize: 12,
    textMatrix: [...IDENTITY_TEXT_MATRIX],
    fillColorSpace: 'rgb',
    strokeColorSpace: 'rgb',
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    lineDashPattern: [],
    lineDashPhase: 0,
  };
}

export class GraphicsState {
  private stack: GraphicsStateSnapshot[] = [defaultState()];

  // ─── Stack Operations ────────────────────────────────────────────────────

  /** PDF `q` operator — push a copy of the current state */
  save(): void {
    const top = this.current;
    this.stack.push({
      ...top,
      ctm: [...top.ctm],
      textMatrix: [...top.textMatrix],
    });
  }

  /** PDF `Q` operator — pop the state stack */
  restore(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
    }
  }

  get current(): GraphicsStateSnapshot {
    return this.stack[this.stack.length - 1];
  }

  // ─── Transformation Matrix ───────────────────────────────────────────────

  /** PDF `cm` operator — concatenate matrix to CTM */
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.current.ctm = pdfjsLib.Util.transform(this.current.ctm, [a, b, c, d, e, f]);
  }

  /** Get computed rotation angle from current CTM in degrees */
  get ctmRotationDeg(): number {
    const [a, b] = this.current.ctm;
    return Math.atan2(b, a) * (180 / Math.PI);
  }

  // ─── Fill Color Operators ────────────────────────────────────────────────

  /** PDF `rg` operator — setFillRGBColor */
  setFillRGBColor(r: number, g: number, b: number): void {
    this.current.fillColor = rgbToHex(r, g, b);
    this.current.fillColorSpace = 'rgb';
  }

  /** PDF `g` operator — setFillGray */
  setFillGray(gray: number): void {
    this.current.fillColor = grayToHex(gray);
    this.current.fillColorSpace = 'gray';
  }

  /** PDF `k` operator — setFillCMYKColor */
  setFillCMYK(c: number, m: number, y: number, k: number): void {
    this.current.fillColor = cmykToHex(c, m, y, k);
    this.current.fillColorSpace = 'cmyk';
  }

  // ─── Stroke Color Operators ──────────────────────────────────────────────

  /** PDF `RG` operator — setStrokeRGBColor */
  setStrokeRGBColor(r: number, g: number, b: number): void {
    this.current.strokeColor = rgbToHex(r, g, b);
    this.current.strokeColorSpace = 'rgb';
  }

  /** PDF `G` operator — setStrokeGray */
  setStrokeGray(gray: number): void {
    this.current.strokeColor = grayToHex(gray);
    this.current.strokeColorSpace = 'gray';
  }

  /** PDF `K` operator — setStrokeCMYKColor */
  setStrokeCMYK(c: number, m: number, y: number, k: number): void {
    this.current.strokeColor = cmykToHex(c, m, y, k);
    this.current.strokeColorSpace = 'cmyk';
  }

  setFillColorString(color: string): void {
    this.current.fillColor = color;
  }

  setStrokeColorString(color: string): void {
    this.current.strokeColor = color;
  }

  /** Generic color setter for SC/sc (uses active color space) */
  setFillColorComponents(components: number[]): void {
    if (this.current.fillColorSpace === 'gray' && components.length >= 1) {
      this.setFillGray(components[0]);
    } else if (this.current.fillColorSpace === 'cmyk' && components.length >= 4) {
      this.setFillCMYK(components[0], components[1], components[2], components[3]);
    } else if (components.length >= 3) {
      this.setFillRGBColor(components[0], components[1], components[2]);
    }
  }

  setStrokeColorComponents(components: number[]): void {
    if (this.current.strokeColorSpace === 'gray' && components.length >= 1) {
      this.setStrokeGray(components[0]);
    } else if (this.current.strokeColorSpace === 'cmyk' && components.length >= 4) {
      this.setStrokeCMYK(components[0], components[1], components[2], components[3]);
    } else if (components.length >= 3) {
      this.setStrokeRGBColor(components[0], components[1], components[2]);
    }
  }

  // ─── Color Space Operators ───────────────────────────────────────────────

  setFillColorSpace(cs: string): void {
    if (cs === 'DeviceGray') this.current.fillColorSpace = 'gray';
    else if (cs === 'DeviceCMYK') this.current.fillColorSpace = 'cmyk';
    else this.current.fillColorSpace = 'rgb';
  }

  setStrokeColorSpace(cs: string): void {
    if (cs === 'DeviceGray') this.current.strokeColorSpace = 'gray';
    else if (cs === 'DeviceCMYK') this.current.strokeColorSpace = 'cmyk';
    else this.current.strokeColorSpace = 'rgb';
  }

  // ─── Line Width ──────────────────────────────────────────────────────────

  /** PDF `w` operator */
  setLineWidth(w: number): void {
    this.current.lineWidth = w;
  }

  /** PDF `J` operator — line cap */
  setLineCap(cap: number): void {
    const caps: ('butt' | 'round' | 'square')[] = ['butt', 'round', 'square'];
    this.current.lineCap = caps[cap] ?? 'butt';
  }

  /** PDF `j` operator — line join */
  setLineJoin(join: number): void {
    const joins: ('miter' | 'round' | 'bevel')[] = ['miter', 'round', 'bevel'];
    this.current.lineJoin = joins[join] ?? 'miter';
  }

  /** PDF `M` operator — miter limit */
  setMiterLimit(limit: number): void {
    this.current.miterLimit = limit;
  }

  /** PDF `d` operator — line dash pattern */
  setLineDash(pattern: number[], phase: number): void {
    this.current.lineDashPattern = pattern ?? [];
    this.current.lineDashPhase = phase ?? 0;
  }

  // ─── Extended Graphics State (gs / setGState) ────────────────────────────

  /**
   * PDF `gs` operator — applies an ExtGState dictionary.
   * The dict can contain CA (stroke alpha), ca (fill alpha), BM (blend mode).
   */
  applyExtGState(gstate: Record<string, any>): void {
    if (gstate === null || typeof gstate !== 'object') return;
    // Fill opacity
    if (typeof gstate.ca === 'number') {
      this.current.fillOpacity = gstate.ca;
    }
    // Stroke opacity
    if (typeof gstate.CA === 'number') {
      this.current.strokeOpacity = gstate.CA;
    }
    // Blend mode
    if (typeof gstate.BM === 'string') {
      this.current.blendMode = pdfBlendModeToCSS(gstate.BM);
    } else if (Array.isArray(gstate.BM) && gstate.BM.length > 0) {
      this.current.blendMode = pdfBlendModeToCSS(gstate.BM[0]);
    }
  }

  // ─── Font ────────────────────────────────────────────────────────────────

  /** PDF `Tf` operator */
  setFont(fontName: string, fontSize: number): void {
    this.current.fontName = fontName;
    this.current.fontSize = fontSize;
  }

  // ─── Text Matrix ─────────────────────────────────────────────────────────

  /** PDF `Tm` operator — set text matrix (absolute) */
  setTextMatrix(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.current.textMatrix = [a, b, c, d, e, f];
  }

  /** PDF `Td` / `TD` operators — move text position by (tx, ty) */
  moveTextPosition(tx: number, ty: number): void {
    const [a, b, c, d, e, f] = this.current.textMatrix;
    this.current.textMatrix = [a, b, c, d, e + tx * a + ty * c, f + tx * b + ty * d];
  }

  /** Get rotation angle of current text matrix in degrees */
  get textRotationDeg(): number {
    const [a, b] = this.current.textMatrix;
    return Math.atan2(b, a) * (180 / Math.PI);
  }

  /** Get effective opacity (min of fill alpha and extgstate alpha) */
  get effectiveFillOpacity(): number {
    return this.current.fillOpacity;
  }
}

// ─── PDF Blend Mode → CSS Blend Mode mapping ─────────────────────────────────

const BLEND_MODE_MAP: Record<string, string> = {
  Normal: 'normal',
  Multiply: 'multiply',
  Screen: 'screen',
  Overlay: 'overlay',
  Darken: 'darken',
  Lighten: 'lighten',
  ColorDodge: 'color-dodge',
  ColorBurn: 'color-burn',
  HardLight: 'hard-light',
  SoftLight: 'soft-light',
  Difference: 'difference',
  Exclusion: 'exclusion',
  Hue: 'hue',
  Saturation: 'saturation',
  Color: 'color',
  Luminosity: 'luminosity',
};

function pdfBlendModeToCSS(pdfMode: string): string {
  return BLEND_MODE_MAP[pdfMode] ?? 'normal';
}

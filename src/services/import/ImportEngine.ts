import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import {
  PDFArray,
  PDFContentStream,
  PDFDocument,
  PDFRawStream,
  decodePDFRawStream,
} from 'pdf-lib';
import exifr from 'exifr';
import { mapExifrToPiexif } from './../../utils/exifUtils';
import { parseSVG } from '../../utils/svgUtils';
import type { Layer } from '../../store/types';
import { nanoid } from 'nanoid';

// Setup pdf.js for raster fallback rendering only.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;
(pdfjsLib.GlobalWorkerOptions as any).standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

export interface ImportResult {
  name: string;
  type: 'image' | 'psd' | 'pdf' | 'gif' | 'svg';
  dataUrl?: string;
  psdData?: any;
  frames?: { dataUrl: string; name: string }[];
  layers?: Layer[];
  width: number;
  height: number;
  exifData?: any;
  iccProfile?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF vector extraction via pdf-lib content streams
// ─────────────────────────────────────────────────────────────────────────────
type PdfOperand = number | { type: 'name'; value: string };

interface PdfGraphicsState {
  fillColor: number[];
  strokeColor: number[];
  lineWidth: number;
  ctm: number[];
  alpha: number;
  strokeAlpha: number;
}

interface PathSegment {
  op: 'm' | 'l' | 'c' | 'h';
  args: number[];
}

const PDF_CONTENT_OPERATORS = new Set([
  'q', 'Q', 'cm', 'w', 'rg', 'RG', 'g', 'G', 'k', 'K', 'gs',
  'm', 'l', 'c', 'v', 'y', 'h', 're', 'f', 'F', 'f*', 'S', 's',
  'B', 'B*', 'b', 'b*', 'n', 'W', 'W*', 'BT', 'ET', 'Tf', 'Tj',
  'TJ', "'", '"', 'Td', 'TD', 'Tm', 'T*', 'Do', 'sh', 'BI', 'ID',
  'EI', 'BX', 'EX', 'CS', 'cs', 'SC', 'SCN', 'sc', 'scn', 'd', 'i', 'j', 'J',
  'M', 'ri', 'Tr', 'Ts', 'Tw', 'Tz', 'TL', 'Tc', 'BMC',
  'BDC', 'EMC', 'DP', 'MP',
]);

function isNumberOperand(value: PdfOperand | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function operandNumber(operands: PdfOperand[], index: number, fallback = 0): number {
  const value = operands[index];
  return isNumberOperand(value) ? value : fallback;
}

// Convert a PDF color array to a CSS hex string.
function colorToHex(color: number[]): string {
  if (!color || color.length === 0) return '#000000';
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const channel = (value: number) => clamp(value * 255).toString(16).padStart(2, '0');

  if (color.length === 1) return `#${channel(color[0]).repeat(3)}`;
  if (color.length === 3) return `#${channel(color[0])}${channel(color[1])}${channel(color[2])}`;

  // CMYK fallback.
  if (color.length === 4) {
    const [c, m, y, k] = color;
    return `#${channel((1 - c) * (1 - k))}${channel((1 - m) * (1 - k))}${channel((1 - y) * (1 - k))}`;
  }

  return '#000000';
}

function cloneGraphicsState(state: PdfGraphicsState): PdfGraphicsState {
  return {
    ...state,
    ctm: [...state.ctm],
    fillColor: [...state.fillColor],
    strokeColor: [...state.strokeColor],
  };
}

function multiplyMatrix(left: number[], right: number[]): number[] {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function transformPoint(matrix: number[], x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = matrix;
  return [a * x + c * y + e, b * x + d * y + f];
}


function transformPdfPoint(state: PdfGraphicsState, viewportTransform: number[], x: number, y: number): [number, number] {
  const pagePoint = transformPoint(state.ctm, x, y);
  return transformPoint(viewportTransform, pagePoint[0], pagePoint[1]);
}

function normalizePathBounds(segs: PathSegment[]): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const xs: number[] = [];
  const ys: number[] = [];

  for (const seg of segs) {
    for (let i = 0; i < seg.args.length; i += 2) {
      const x = seg.args[i];
      const y = seg.args[i + 1];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }

  if (xs.length === 0) return null;
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function pathIntersectsPage(segs: PathSegment[], pageWidth: number, pageHeight: number): boolean {
  const bounds = normalizePathBounds(segs);
  if (!bounds) return false;

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width < 0.01 && height < 0.01) return false;

  return bounds.maxX >= 0 && bounds.maxY >= 0 && bounds.minX <= pageWidth && bounds.minY <= pageHeight;
}

function segmentsToSvgD(segs: PathSegment[]): string {
  let d = '';
  for (const seg of segs) {
    const a = seg.args;
    switch (seg.op) {
      case 'm':
        d += `M ${a[0]} ${a[1]} `;
        break;
      case 'l':
        d += `L ${a[0]} ${a[1]} `;
        break;
      case 'c':
        d += `C ${a[0]} ${a[1]} ${a[2]} ${a[3]} ${a[4]} ${a[5]} `;
        break;
      case 'h':
        d += 'Z ';
        break;
      default:
        break;
    }
  }
  return d.trim();
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

function decodePdfStream(stream: unknown): string {
  if (stream instanceof PDFContentStream) return bytesToString((stream as PDFContentStream).getUnencodedContents());
  if (stream instanceof PDFRawStream) return bytesToString(decodePDFRawStream(stream).decode());

  const candidate = stream as {
    getUnencodedContents?: () => Uint8Array;
    getContents?: () => Uint8Array;
    getContentsString?: () => string;
  };

  if (candidate.getUnencodedContents) return bytesToString(candidate.getUnencodedContents());
  if (candidate.getContentsString) return candidate.getContentsString();
  if (candidate.getContents) return bytesToString(candidate.getContents());

  return '';
}

function getPdfContentStreams(pdfDoc: PDFDocument, pageIndex: number): string[] {
  const page = pdfDoc.getPage(pageIndex) as unknown as { node: { Contents?: () => unknown } };
  const contents = page.node.Contents?.();
  if (!contents) return [];

  return resolvePdfContentStreams(pdfDoc, contents);
}

function resolvePdfContentStreams(pdfDoc: PDFDocument, contents: unknown): string[] {
  const context = (pdfDoc as unknown as { context: { lookup: (object: unknown) => unknown } }).context;
  const resolve = (object: unknown) => context.lookup(object);

  if (contents instanceof PDFArray) {
    const contentArray = contents as PDFArray;
    const streams: string[] = [];
    for (let i = 0; i < contentArray.size(); i++) {
      streams.push(...resolvePdfContentStreams(pdfDoc, contentArray.get(i)));
    }
    return streams;
  }

  const decoded = decodePdfStream(resolve(contents));
  return decoded ? [decoded] : [];
}

function readLiteralString(source: string, start: number): number {
  let depth = 1;
  let index = start + 1;
  while (index < source.length && depth > 0) {
    const char = source[index];
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    index += 1;
  }
  return index;
}

function readBalanced(source: string, start: number, open: string, close: string): number {
  let depth = 1;
  let index = start + 1;
  while (index < source.length && depth > 0) {
    if (source[index] === open) depth += 1;
    if (source[index] === close) depth -= 1;
    index += 1;
  }
  return index;
}

function tokenizePdfContent(source: string): Array<number | string | { type: 'name'; value: string }> {
  const tokens: Array<number | string | { type: 'name'; value: string }> = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === '%') {
      while (index < source.length && source[index] !== '\n' && source[index] !== '\r') index += 1;
      continue;
    }

    if (char === '(') {
      index = readLiteralString(source, index);
      continue;
    }

    if (char === '<' && source[index + 1] === '<') {
      index = readBalanced(source, index + 1, '<', '>');
      continue;
    }

    if (char === '[') {
      index = readBalanced(source, index, '[', ']');
      continue;
    }

    if (char === '<') {
      const closeIndex = source.indexOf('>', index + 1);
      index = closeIndex === -1 ? source.length : closeIndex + 1;
      continue;
    }

    if (char === '/') {
      let end = index + 1;
      while (end < source.length && !/[\s\[\]()<>/%]/.test(source[end])) end += 1;
      tokens.push({ type: 'name', value: source.slice(index + 1, end) });
      index = end;
      continue;
    }

    let end = index + 1;
    while (end < source.length && !/[\s\[\]()<>/%]/.test(source[end])) end += 1;
    const token = source.slice(index, end);
    const numeric = Number(token);
    tokens.push(Number.isFinite(numeric) && token !== '' ? numeric : token);
    index = end;
  }

  return tokens;
}

function addRectPath(pathSegs: PathSegment[], state: PdfGraphicsState, viewportTransform: number[], operands: PdfOperand[]) {
  const x = operandNumber(operands, 0);
  const y = operandNumber(operands, 1);
  const width = operandNumber(operands, 2);
  const height = operandNumber(operands, 3);
  const p1 = transformPdfPoint(state, viewportTransform, x, y);
  const p2 = transformPdfPoint(state, viewportTransform, x + width, y);
  const p3 = transformPdfPoint(state, viewportTransform, x + width, y + height);
  const p4 = transformPdfPoint(state, viewportTransform, x, y + height);

  pathSegs.push({ op: 'm', args: p1 });
  pathSegs.push({ op: 'l', args: p2 });
  pathSegs.push({ op: 'l', args: p3 });
  pathSegs.push({ op: 'l', args: p4 });
  pathSegs.push({ op: 'h', args: [] });
}

function buildPdfVectorLayers(contentStreams: string[], viewportTransform: number[], pageWidth: number, pageHeight: number): Layer[] {
  const layers: Layer[] = [];
  const stateStack: PdfGraphicsState[] = [];
  let currentState: PdfGraphicsState = {
    fillColor: [0],
    strokeColor: [0],
    lineWidth: 1,
    ctm: [1, 0, 0, 1, 0, 0],
    alpha: 1,
    strokeAlpha: 1,
  };
  let pathSegs: PathSegment[] = [];
  let clippingPathPending = false;
  let currentPoint: [number, number] = [0, 0];

  const clearClippingPath = () => {
    pathSegs = [];
    clippingPathPending = false;
  };

  const flushPath = (paint: 'fill' | 'stroke' | 'both') => {
    if (pathSegs.length === 0) return;
    clippingPathPending = false;
    const paintedPath = pathSegs;
    const d = segmentsToSvgD(paintedPath);
    pathSegs = [];
    if (!d || !pathIntersectsPage(paintedPath, pageWidth, pageHeight)) return;

    const fill = paint === 'stroke' ? '' : colorToHex(currentState.fillColor);
    const stroke = paint === 'fill' ? '' : colorToHex(currentState.strokeColor);

    layers.push({
      id: nanoid(),
      name: `Vector ${layers.length + 1}`,
      type: 'shape',
      visible: true,
      locked: false,
      opacity: paint === 'stroke' ? currentState.strokeAlpha : currentState.alpha,
      blendMode: 'source-over',
      position: { x: 0, y: 0 },
      shapeData: {
        type: 'path',
        svgPath: d,
        fill,
        stroke,
        strokeWidth: currentState.lineWidth,
      },
    } as Layer);
  };

  const handleOperator = (operator: string, operands: PdfOperand[]) => {
    switch (operator) {
      case 'q':
        stateStack.push(cloneGraphicsState(currentState));
        break;
      case 'Q':
        if (stateStack.length > 0) currentState = stateStack.pop()!;
        break;
      case 'cm':
        currentState.ctm = multiplyMatrix(currentState.ctm, [
          operandNumber(operands, 0, 1),
          operandNumber(operands, 1),
          operandNumber(operands, 2),
          operandNumber(operands, 3, 1),
          operandNumber(operands, 4),
          operandNumber(operands, 5),
        ]);
        break;
      case 'w':
        currentState.lineWidth = operandNumber(operands, 0, currentState.lineWidth);
        break;
      case 'rg':
        currentState.fillColor = [operandNumber(operands, 0), operandNumber(operands, 1), operandNumber(operands, 2)];
        break;
      case 'RG':
        currentState.strokeColor = [operandNumber(operands, 0), operandNumber(operands, 1), operandNumber(operands, 2)];
        break;
      case 'g':
        currentState.fillColor = [operandNumber(operands, 0)];
        break;
      case 'G':
        currentState.strokeColor = [operandNumber(operands, 0)];
        break;
      case 'k':
        currentState.fillColor = [operandNumber(operands, 0), operandNumber(operands, 1), operandNumber(operands, 2), operandNumber(operands, 3)];
        break;
      case 'K':
        currentState.strokeColor = [operandNumber(operands, 0), operandNumber(operands, 1), operandNumber(operands, 2), operandNumber(operands, 3)];
        break;
      case 'm':
        currentPoint = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 0), operandNumber(operands, 1));
        pathSegs.push({ op: 'm', args: currentPoint });
        break;
      case 'l':
        currentPoint = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 0), operandNumber(operands, 1));
        pathSegs.push({ op: 'l', args: currentPoint });
        break;
      case 'c': {
        const cp1 = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 0), operandNumber(operands, 1));
        const cp2 = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 2), operandNumber(operands, 3));
        currentPoint = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 4), operandNumber(operands, 5));
        pathSegs.push({ op: 'c', args: [...cp1, ...cp2, ...currentPoint] });
        break;
      }
      case 'v': {
        const cp1 = currentPoint;
        const cp2 = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 0), operandNumber(operands, 1));
        currentPoint = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 2), operandNumber(operands, 3));
        pathSegs.push({ op: 'c', args: [...cp1, ...cp2, ...currentPoint] });
        break;
      }
      case 'y': {
        const cp1 = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 0), operandNumber(operands, 1));
        currentPoint = transformPdfPoint(currentState, viewportTransform, operandNumber(operands, 2), operandNumber(operands, 3));
        pathSegs.push({ op: 'c', args: [...cp1, ...currentPoint, ...currentPoint] });
        break;
      }
      case 'h':
        pathSegs.push({ op: 'h', args: [] });
        break;
      case 're':
        addRectPath(pathSegs, currentState, viewportTransform, operands);
        break;
      case 'W':
      case 'W*':
        clippingPathPending = true;
        break;
      case 'f':
      case 'F':
      case 'f*':
        if (clippingPathPending) clearClippingPath();
        else flushPath('fill');
        break;
      case 'S':
        if (clippingPathPending) clearClippingPath();
        else flushPath('stroke');
        break;
      case 's':
        pathSegs.push({ op: 'h', args: [] });
        if (clippingPathPending) clearClippingPath();
        else flushPath('stroke');
        break;
      case 'B':
      case 'B*':
        if (clippingPathPending) clearClippingPath();
        else flushPath('both');
        break;
      case 'b':
      case 'b*':
        pathSegs.push({ op: 'h', args: [] });
        if (clippingPathPending) clearClippingPath();
        else flushPath('both');
        break;
      case 'n':
        pathSegs = [];
        clippingPathPending = false;
        break;
      default:
        break;
    }
  };

  for (const content of contentStreams) {
    const tokens = tokenizePdfContent(content);
    let operands: PdfOperand[] = [];

    for (const token of tokens) {
      if (typeof token === 'string' && PDF_CONTENT_OPERATORS.has(token)) {
        handleOperator(token, operands);
        operands = [];
      } else if (typeof token === 'number' || (typeof token === 'object' && token.type === 'name')) {
        operands.push(token);
      }
    }
  }

  if (pathSegs.length > 0 && !clippingPathPending) flushPath('fill');
  return layers;
}

async function rasterizePdfPage(page: any, viewport: any, pageWidth: number, pageHeight: number): Promise<Layer> {
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.width = Math.round(pageWidth);
  fallbackCanvas.height = Math.round(pageHeight);
  const ctx2d = fallbackCanvas.getContext('2d')!;
  await page.render({ canvasContext: ctx2d, viewport }).promise;

  return {
    id: nanoid(),
    name: 'Rasterized Page',
    type: 'image',
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'source-over',
    position: { x: 0, y: 0 },
    dataUrl: fallbackCanvas.toDataURL('image/png'),
  } as Layer;
}

async function extractPageLayers(
  pdfDoc: PDFDocument,
  pageIndex: number,
  pdfJsPage: any,
  viewport: any
): Promise<Layer[]> {
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  let layers: Layer[] = [];
  try {
    layers = buildPdfVectorLayers(getPdfContentStreams(pdfDoc, pageIndex), viewport.transform, pageWidth, pageHeight);
  } catch (error) {
    console.warn('PDF vector extraction failed; rasterizing page instead:', error);
  }

  // Keep PDF.js as a raster-only safety net for pages whose vector content
  // cannot be represented as editable shape layers (text-only pages, images,
  // shadings, unsupported operators, or unusually encoded streams).
  if (layers.length === 0) layers.push(await rasterizePdfPage(pdfJsPage, viewport, pageWidth, pageHeight));

  return layers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main ImportEngine class
// ─────────────────────────────────────────────────────────────────────────────
export class ImportEngine {
  static async importFile(file: File): Promise<ImportResult> {
    let fileToRead = file;
    let heicExifData: any = null;

    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.heic') || lowerName.endsWith('.heif')) {
      try {
        const parsed = await exifr.parse(file, {
          translateKeys: false,
          translateValues: false,
          reviveValues: false,
          mergeOutput: false,
          tiff: true,
          gps: true,
          interop: true
        });
        heicExifData = mapExifrToPiexif(parsed);

        const convertedBlob = await heic2any({ blob: file, toType: 'image/jpeg' });
        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        fileToRead = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (err) {
        console.error('Failed to convert HEIC to JPEG:', err);
        throw new Error('Failed to parse HEIC file', { cause: err });
      }
    }

    if (lowerName.endsWith('.pdf')) return this.importPdf(fileToRead);
    if (lowerName.endsWith('.svg')) return this.importSvg(fileToRead);
    if (lowerName.endsWith('.gif')) return this.importGif(fileToRead);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;

        if (fileToRead.name.toLowerCase().endsWith('.psd')) {
          resolve({ name: file.name, type: 'psd', psdData: result, width: 0, height: 0 });
          return;
        }

        if (typeof result === 'string') {
          let exifData = null;
          if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
            exifData = heicExifData;
          } else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
            try {
              exifData = piexif.load(result);
            } catch (e) {
              console.warn('Could not load EXIF data', e);
            }
          }

          const img = new Image();
          img.onload = () => {
            resolve({ name: file.name, type: 'image', dataUrl: result, width: img.width, height: img.height, exifData });
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = result;
        } else {
          reject(new Error('Unexpected file read result type'));
        }
      };

      reader.onerror = () => reject(reader.error);

      if (fileToRead.name.toLowerCase().endsWith('.psd')) {
        reader.readAsArrayBuffer(fileToRead);
      } else {
        reader.readAsDataURL(fileToRead);
      }
    });
  }

  static async importSvg(file: File): Promise<ImportResult> {
    const text = await file.text();
    const layers = await parseSVG(text);

    let width = 800, height = 600;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (svg) {
        if (svg.hasAttribute('width')) width = parseFloat(svg.getAttribute('width') || '800');
        if (svg.hasAttribute('height')) height = parseFloat(svg.getAttribute('height') || '600');
      }
    } catch (e) { /* ignore */ }

    return { name: file.name, type: 'svg', layers, width, height };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PDF import: each page becomes a group; inside each group are vector shape
  // layers extracted from pdf-lib content streams, with PDF.js raster fallback.
  // ───────────────────────────────────────────────────────────────────────────
  static async importPdf(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfLibDoc = await PDFDocument.load(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    const topLevelLayers: Layer[] = [];

    let maxWidth = 0;
    let maxHeight = 0;

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });

        if (viewport.width > maxWidth) maxWidth = viewport.width;
        if (viewport.height > maxHeight) maxHeight = viewport.height;

        // Extract per-element sub-layers
        const subLayers = await extractPageLayers(pdfLibDoc, i - 1, page, viewport);

        // Wrap in a group named "Page N"
        const pageGroup: Layer = {
          id: nanoid(),
          name: `Page ${i}`,
          type: 'group',
          children: subLayers,
          collapsed: false,
          position: { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'pass through',
        };

        topLevelLayers.push(pageGroup);
      } catch (e) {
        console.error(`Failed to process PDF page ${i}`, e);
      }
    }

    return {
      name: file.name,
      type: 'pdf',
      // We return layers directly (not frames) so useFileImporter uses the
      // existing layers path instead of the frames path.
      layers: topLevelLayers,
      width: maxWidth,
      height: maxHeight,
    };
  }

  static async importGif(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const gif = parseGIF(arrayBuffer);
    const frames = decompressFrames(gif, true);

    if (!frames || frames.length === 0) throw new Error('No frames found in GIF');

    const width = gif.lsd.width;
    const height = gif.lsd.height;
    const frameDataUrls: { dataUrl: string; name: string }[] = [];

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const patchData = new ImageData(
        new Uint8ClampedArray(frame.patch.buffer as ArrayBuffer, frame.patch.byteOffset, frame.patch.byteLength),
        frame.dims.width,
        frame.dims.height
      );
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      frameCanvas.getContext('2d')!.putImageData(patchData, frame.dims.left, frame.dims.top);
      frameDataUrls.push({ dataUrl: frameCanvas.toDataURL('image/png'), name: `Frame ${i + 1}` });
    }

    return { name: file.name, type: 'gif', frames: frameDataUrls, width, height };
  }
}
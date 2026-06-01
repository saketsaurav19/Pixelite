import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

// Setup pdf.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;
(pdfjsLib.GlobalWorkerOptions as any).standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

import exifr from 'exifr';
import { mapExifrToPiexif } from './../../utils/exifUtils';
import { parseSVG } from '../../utils/svgUtils';
import type { Layer } from '../../store/types';
import { nanoid } from 'nanoid';

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
// PDF operator codes from PDF.js OPS enum
// ─────────────────────────────────────────────────────────────────────────────
const OPS = pdfjsLib.OPS as Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Convert a PDF.js color array to a CSS hex string
// ─────────────────────────────────────────────────────────────────────────────
function colorToHex(color: number[]): string {
  if (!color || color.length === 0) return '#000000';
  if (color.length === 1) {
    // Gray
    const v = Math.round(color[0] * 255);
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
  }
  if (color.length === 3) {
    const [r, g, b] = color.map((c) => Math.round(c * 255));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  // CMYK fallback – crude conversion
  if (color.length === 4) {
    const [c, m, y, k] = color;
    const r = Math.round(255 * (1 - c) * (1 - k));
    const g = Math.round(255 * (1 - m) * (1 - k));
    const b2 = Math.round(255 * (1 - y) * (1 - k));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`;
  }
  return '#000000';
}

// ─────────────────────────────────────────────────────────────────────────────
// Build SVG path data from PDF path operators accumulated in a stack
// ─────────────────────────────────────────────────────────────────────────────
interface PathSegment {
  op: string; // 'm' | 'l' | 'c' | 'v' | 'y' | 'h'
  args: number[];
}

function segmentsToSvgD(segs: PathSegment[], vph: number): string {
  // PDF y-axis grows upward; SVG y-axis grows downward.
  // We flip: svgY = vph - pdfY
  const flip = (y: number) => vph - y;

  let d = '';
  for (const seg of segs) {
    const a = seg.args;
    switch (seg.op) {
      case 'm':
        d += `M ${a[0]} ${flip(a[1])} `;
        break;
      case 'l':
        d += `L ${a[0]} ${flip(a[1])} `;
        break;
      case 'c':
        d += `C ${a[0]} ${flip(a[1])} ${a[2]} ${flip(a[3])} ${a[4]} ${flip(a[5])} `;
        break;
      case 'v': // cp1 = current point
        d += `S ${a[0]} ${flip(a[1])} ${a[2]} ${flip(a[3])} `;
        break;
      case 'y': // cp2 = end point
        d += `Q ${a[0]} ${flip(a[1])} ${a[2]} ${flip(a[3])} `;
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

// ─────────────────────────────────────────────────────────────────────────────
// Extract sub-layers from one PDF page via its operator list
// Returns vector shape layers + raster image layers
// ─────────────────────────────────────────────────────────────────────────────
async function extractPageLayers(
  page: any,
  viewport: any,
  pageIndex: number
): Promise<Layer[]> {
  const vph = viewport.height; // for y-flip
  const vpw = viewport.width;

  const opList = await page.getOperatorList();
  const { fnArray, argsArray } = opList;

  const layers: Layer[] = [];

  // Graphics state stack
  const stateStack: any[] = [];
  let currentState = {
    fillColor: [0] as number[],
    strokeColor: [0] as number[],
    lineWidth: 1,
    ctm: [1, 0, 0, 1, 0, 0] as number[], // current transform matrix
    alpha: 1,
    strokeAlpha: 1,
  };

  // Current path accumulator
  let pathSegs: PathSegment[] = [];
  let vectorGroupCounter = 0;

  const getOrCreateVectorGroup = () => {
    vectorGroupCounter++;
    return vectorGroupCounter;
  };

  // Helper: build a shape Layer from accumulated path + current paint state
  const flushPath = (paint: 'fill' | 'stroke' | 'both') => {
    if (pathSegs.length === 0) return;
    const d = segmentsToSvgD(pathSegs, vph);
    pathSegs = [];
    if (!d) return;

    const fill = paint === 'stroke' ? 'none' : colorToHex(currentState.fillColor);
    const stroke = paint === 'fill' ? 'none' : colorToHex(currentState.strokeColor);
    const sw = currentState.lineWidth;

    // Build a tiny SVG data URL so it can be rendered via our existing shape→svgPath pipeline
    const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" width="${vpw}" height="${vph}">
  <path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" fill-opacity="${currentState.alpha}" stroke-opacity="${currentState.strokeAlpha}"/>
</svg>`;
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgMarkup);

    layers.push({
      id: nanoid(),
      name: `Vector ${layers.length + 1}`,
      type: 'shape',
      visible: true,
      locked: false,
      opacity: currentState.alpha,
      blendMode: 'source-over',
      position: { x: 0, y: 0 },
      shapeData: {
        type: 'path',
        svgPath: d,
        fill: fill === 'none' ? '' : fill,
        stroke: stroke === 'none' ? '' : stroke,
        strokeWidth: sw,
      },
    } as Layer);
  };

  // Walk operator list
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = argsArray[i] || [];

    switch (fn) {
      // ── Graphics state ──────────────────────────────────────────────────────
      case OPS.save:
        stateStack.push({ ...currentState, ctm: [...currentState.ctm], fillColor: [...currentState.fillColor], strokeColor: [...currentState.strokeColor] });
        break;
      case OPS.restore:
        if (stateStack.length > 0) currentState = stateStack.pop()!;
        break;
      case OPS.setLineWidth:
        currentState.lineWidth = args[0];
        break;
      case OPS.setFillRGBColor:
        currentState.fillColor = [args[0], args[1], args[2]];
        break;
      case OPS.setStrokeRGBColor:
        currentState.strokeColor = [args[0], args[1], args[2]];
        break;
      case OPS.setFillGray:
        currentState.fillColor = [args[0]];
        break;
      case OPS.setStrokeGray:
        currentState.strokeColor = [args[0]];
        break;
      case OPS.setFillCMYKColor:
        currentState.fillColor = [args[0], args[1], args[2], args[3]];
        break;
      case OPS.setStrokeCMYKColor:
        currentState.strokeColor = [args[0], args[1], args[2], args[3]];
        break;
      case OPS.setGState: {
        // args[0] is a dict name; alpha values come later via individual ops
        break;
      }
      case OPS.setFillAlpha:
        currentState.alpha = args[0];
        break;
      case OPS.setStrokeAlpha:
        currentState.strokeAlpha = args[0];
        break;

      // ── Path construction ────────────────────────────────────────────────────
      case OPS.moveTo:
        pathSegs.push({ op: 'm', args: [args[0], args[1]] });
        break;
      case OPS.lineTo:
        pathSegs.push({ op: 'l', args: [args[0], args[1]] });
        break;
      case OPS.curveTo:
        pathSegs.push({ op: 'c', args: [args[0], args[1], args[2], args[3], args[4], args[5]] });
        break;
      case OPS.curveTo2: // v operator: first control point = current
        pathSegs.push({ op: 'v', args: [args[0], args[1], args[2], args[3]] });
        break;
      case OPS.curveTo3: // y operator: second control point = endpoint
        pathSegs.push({ op: 'y', args: [args[0], args[1], args[2], args[3]] });
        break;
      case OPS.closePath:
        pathSegs.push({ op: 'h', args: [] });
        break;
      case OPS.rectangle:
        pathSegs.push({ op: 'm', args: [args[0], args[1]] });
        pathSegs.push({ op: 'l', args: [args[0] + args[2], args[1]] });
        pathSegs.push({ op: 'l', args: [args[0] + args[2], args[1] + args[3]] });
        pathSegs.push({ op: 'l', args: [args[0], args[1] + args[3]] });
        pathSegs.push({ op: 'h', args: [] });
        break;

      // ── Path painting ────────────────────────────────────────────────────────
      case OPS.fill:
      case OPS.eoFill:
        flushPath('fill');
        break;
      case OPS.stroke:
        flushPath('stroke');
        break;
      case OPS.fillStroke:
      case OPS.eoFillStroke:
        flushPath('both');
        break;
      case OPS.endPath:
        pathSegs = []; // clip-only, discard
        break;

      // ── Raster images ────────────────────────────────────────────────────────
      case OPS.paintImageXObject:
      case OPS.paintImageMaskXObject:
      case OPS.paintInlineImageXObject: {
        // args[0] is the image object (has width, height, data, bitmap…)
        const imgObj = args[0];
        if (!imgObj) break;

        try {
          let imageCanvas: HTMLCanvasElement | null = null;

          // If PDF.js resolved it to an ImageBitmap
          if (imgObj instanceof ImageBitmap) {
            imageCanvas = document.createElement('canvas');
            imageCanvas.width = imgObj.width;
            imageCanvas.height = imgObj.height;
            imageCanvas.getContext('2d')!.drawImage(imgObj, 0, 0);
          } else if (imgObj.bitmap instanceof ImageBitmap) {
            imageCanvas = document.createElement('canvas');
            imageCanvas.width = imgObj.bitmap.width;
            imageCanvas.height = imgObj.bitmap.height;
            imageCanvas.getContext('2d')!.drawImage(imgObj.bitmap, 0, 0);
          } else if (imgObj.data && imgObj.width && imgObj.height) {
            // Raw RGBA data
            imageCanvas = document.createElement('canvas');
            imageCanvas.width = imgObj.width;
            imageCanvas.height = imgObj.height;
            const ctx2d = imageCanvas.getContext('2d')!;
            const idata = ctx2d.createImageData(imgObj.width, imgObj.height);
            const src = imgObj.data instanceof Uint8ClampedArray
              ? imgObj.data
              : new Uint8ClampedArray(imgObj.data.buffer ?? imgObj.data);
            idata.data.set(src.subarray(0, imgObj.width * imgObj.height * 4));
            ctx2d.putImageData(idata, 0, 0);
          }

          if (imageCanvas) {
            layers.push({
              id: nanoid(),
              name: `Image ${layers.length + 1}`,
              type: 'image',
              visible: true,
              locked: false,
              opacity: 1,
              blendMode: 'source-over',
              position: { x: 0, y: 0 },
              dataUrl: imageCanvas.toDataURL('image/png'),
            } as Layer);
          }
        } catch (e) {
          console.warn('PDF image extraction skipped:', e);
        }
        break;
      }

      default:
        break;
    }
  }

  // Any unflushed path (shouldn't normally happen, but be safe)
  if (pathSegs.length > 0) flushPath('fill');

  // If we got zero sub-layers (e.g. text-only page, or complex shading),
  // fall back to a full raster render of the page so nothing is empty.
  if (layers.length === 0) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = Math.round(vpw);
    fallbackCanvas.height = Math.round(vph);
    const ctx2d = fallbackCanvas.getContext('2d')!;
    await page.render({ canvasContext: ctx2d, viewport }).promise;
    layers.push({
      id: nanoid(),
      name: 'Rasterized Page',
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      position: { x: 0, y: 0 },
      dataUrl: fallbackCanvas.toDataURL('image/png'),
    } as Layer);
  }

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
  // layers and raster image layers extracted from the page's operator list.
  // ───────────────────────────────────────────────────────────────────────────
  static async importPdf(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
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
        const subLayers = await extractPageLayers(page, viewport, i - 1);

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
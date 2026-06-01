import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
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

async function rasterizePdfPage(page: any, viewport: any, pageWidth: number, pageHeight: number, offsetX: number = 0, offsetY: number = 0): Promise<Layer> {
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
    position: { x: offsetX, y: offsetY },
    dataUrl: fallbackCanvas.toDataURL('image/png'),
  } as Layer;
}


function applyOffsetToLayers(layers: Layer[], dx: number, dy: number): void {
  for (const layer of layers) {
    if (layer.position) {
      layer.position.x += dx;
      layer.position.y += dy;
    } else {
      layer.position = { x: dx, y: dy };
    }
    if (layer.children) {
      applyOffsetToLayers(layer.children, dx, dy);
    }
  }
}

async function extractPageLayers(
  pdfJsPage: any,
  viewport: any,
  offsetX: number = 0,
  offsetY: number = 0
): Promise<Layer[]> {
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;
  let layers: Layer[] = [];
  try {
    const opList = await pdfJsPage.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(pdfJsPage.commonObjs, pdfJsPage.objs);
    const svgElement = await svgGfx.getSVG(opList, viewport);
    const svgString = (svgElement as any).outerHTML;
    layers = await parseSVG(svgString);
    if (offsetX !== 0 || offsetY !== 0) {
      applyOffsetToLayers(layers, offsetX, offsetY);
    }
  } catch (error) {
    console.warn('PDF vector extraction failed; rasterizing page instead:', error);
  }

  // Keep PDF.js as a raster-only safety net for pages whose vector content
  // cannot be represented as editable shape layers (text-only pages, images,
  // shadings, unsupported operators, or unusually encoded streams).
  if (layers.length === 0) layers.push(await rasterizePdfPage(pdfJsPage, viewport, pageWidth, pageHeight, offsetX, offsetY));

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
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer.slice(0) });
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    const topLevelLayers: Layer[] = [];

    let currentX = 0;
    let currentY = 0;
    let currentRowHeight = 0;
    let maxDocWidth = 0;
    const padding = 20;
    const maxRowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1 });

        if (currentX > 0 && currentX + viewport.width > maxRowWidth) {
          currentX = 0;
          currentY += currentRowHeight + padding;
          currentRowHeight = 0;
        }

        const pageX = currentX;
        const pageY = currentY;

        currentX += viewport.width + padding;
        currentRowHeight = Math.max(currentRowHeight, viewport.height);
        if (currentX - padding > maxDocWidth) {
          maxDocWidth = currentX - padding;
        }

        // Create a white background shape for the page "artboard"
        const artboardBg: Layer = {
          id: nanoid(),
          name: `Background`,
          type: 'shape',
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: 'source-over',
          position: { x: pageX, y: pageY },
          shapeData: {
            type: 'rect',
            w: viewport.width,
            h: viewport.height,
            fill: '#ffffff',
            stroke: '',
            strokeWidth: 0,
          }
        };

        // Extract per-element sub-layers
        const subLayers = await extractPageLayers(page, viewport, pageX, pageY);

        // Wrap in a group named "Page N"
        const pageGroup: Layer = {
          id: nanoid(),
          name: `Page ${i}`,
          type: 'group',
          children: [artboardBg, ...subLayers],
          collapsed: false,
          position: { x: pageX, y: pageY },
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
      width: maxDocWidth > 0 ? maxDocWidth : maxRowWidth,
      height: currentY + currentRowHeight,
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
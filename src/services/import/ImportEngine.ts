import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

import exifr from 'exifr';
import { mapExifrToPiexif } from './../../utils/exifUtils';
import { parseSVG } from '../../utils/svgUtils';
import type { Layer } from '../../store/types';


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
    const { PdfImportManager } = await import('../../pdf/PdfImportManager');
    const arrayBuffer = await file.arrayBuffer();
    const result = await PdfImportManager.importPdf(arrayBuffer);
    return {
      name: file.name,
      type: 'pdf',
      layers: result.layers,
      width: result.width,
      height: result.height,
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
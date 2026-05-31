import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

// Setup pdf.js
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

// The workerSrc must be set to the PDF.js worker so it can operate
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.js`;

import exifr from 'exifr';
import { mapExifrToPiexif } from './../../utils/exifUtils';
export interface ImportResult {
  name: string;
  type: 'image' | 'psd' | 'pdf' | 'gif';
  dataUrl?: string; // For images
  // For PSDs, we might return parsed layer data
  psdData?: any;
  // For multi-frame/multi-page formats
  frames?: { dataUrl: string; name: string }[];
  width: number;
  height: number;
  exifData?: any;
  iccProfile?: string;
}

export class ImportEngine {
  /**
   * Reads a file and returns basic image data.
   * Heavy parsing (PSD) should be routed to workers.
   */
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
        // heic2any might return an array of blobs if it's an animation/sequence, we just take the first one
        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
        fileToRead = new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
      } catch (err) {
        console.error('Failed to convert HEIC to JPEG:', err);
        throw new Error('Failed to parse HEIC file', { cause: err });
      }
    }

    if (lowerName.endsWith('.pdf')) {
      return this.importPdf(fileToRead);
    }

    if (lowerName.endsWith('.gif')) {
      return this.importGif(fileToRead);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;

        if (fileToRead.name.toLowerCase().endsWith('.psd')) {
           // We will handle PSD parsing in a worker later.
           // For scaffolding, just return the ArrayBuffer.
           resolve({
             name: file.name, // Keep original name
             type: 'psd',
             psdData: result,
             width: 0,
             height: 0
           });
           return;
        }

        // Standard Image
        if (typeof result === 'string') {
          let exifData = null;
          if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
             exifData = heicExifData;
          } else if (file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg')) {
            try {
               exifData = piexif.load(result);
            } catch (e) {
               console.warn("Could not load EXIF data", e);
            }
          }

          const img = new Image();
          img.onload = () => {
            resolve({
              name: file.name, // Keep original name
              type: 'image',
              dataUrl: result,
              width: img.width,
              height: img.height,
              exifData
            });
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

  static async importPdf(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const numPages = pdf.numPages;
    const frames: { dataUrl: string; name: string }[] = [];

    let maxWidth = 0;
    let maxHeight = 0;

    for (let i = 1; i <= numPages; i++) {
        try {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });

            if (viewport.width > maxWidth) maxWidth = viewport.width;
            if (viewport.height > maxHeight) maxHeight = viewport.height;

            // Render to canvas instead of SVG to support embedded bitmaps
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                const renderContext = {
                    canvasContext: ctx,
                    viewport: viewport
                };
                await page.render(renderContext).promise;
            }

            const dataUrl = canvas.toDataURL('image/png');

            frames.push({
                name: `Page ${i}`,
                dataUrl
            });
        } catch (e) {
            console.error(`Failed to render PDF page ${i}`, e);
        }
    }

    return {
      name: file.name,
      type: 'pdf',
      frames,
      width: maxWidth,
      height: maxHeight
    };
  }

  static async importGif(file: File): Promise<ImportResult> {
    const arrayBuffer = await file.arrayBuffer();
    const gif = parseGIF(arrayBuffer);
    const frames = decompressFrames(gif, true);

    if (!frames || frames.length === 0) {
      throw new Error('No frames found in GIF');
    }

    const width = gif.lsd.width;
    const height = gif.lsd.height;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const frameDataUrls: { dataUrl: string, name: string }[] = [];

    // We need a persistent image data to apply frames onto, as GIF frames can be partial
    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const patchData = new ImageData(new Uint8ClampedArray(frame.patch.buffer as ArrayBuffer, frame.patch.byteOffset, frame.patch.byteLength), frame.dims.width, frame.dims.height);

      // Some frames only patch a small part of the image
      // To properly render it as a full layer, we apply it to a temporary canvas
      // at the correct dims.
      // For GIF layers, depending on disposal method, the background might need clearing,
      // but for simplicity and to match common Photoshop-like frame import,
      // we often just want the raw frames, or accumulated frames.
      // The user wants "All frame in seperate layers"
      // If we want each layer to be the EXACT frame of the GIF (accumulated or unaccumulated),
      // we should put it on a transparent canvas of full width/height.
      // Note: Disposal methods (0=unspecified, 1=do not dispose, 2=restore to background, 3=restore to previous)
      // For now, let's accumulate them for a WYSIWYG animation frame stack,
      // but only if it's the standard disposal method 1. To be safe, we just draw the patch at dims.left/top

      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = width;
      frameCanvas.height = height;
      const fCtx = frameCanvas.getContext('2d')!;

      fCtx.putImageData(patchData, frame.dims.left, frame.dims.top);

      frameDataUrls.push({
        dataUrl: frameCanvas.toDataURL('image/png'),
        name: `Frame ${i + 1}`
      });
    }

    return {
      name: file.name,
      type: 'gif',
      frames: frameDataUrls,
      width,
      height
    };
  }
}

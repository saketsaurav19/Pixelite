import heic2any from 'heic2any';
import piexif from 'piexifjs';
import { parseGIF, decompressFrames } from 'gifuct-js';

import exifr from 'exifr';
import { mapExifrToPiexif } from './../../utils/exifUtils';
import { parseSVG } from '../../utils/svgUtils';
import type { Layer, TextRun } from '../../store/types';


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

    if (lowerName.endsWith('.svg')) return this.importSvg(fileToRead);
    if (lowerName.endsWith('.gif')) return this.importGif(fileToRead);
    if (lowerName.endsWith('.pdf')) return this.importPdf(fileToRead);

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

  static async importPdf(file: File): Promise<ImportResult> {
    const { pdfiumManager } = await import('./PdfiumManager');
    const instance = await pdfiumManager.getInstance();

    const arrayBuffer = await file.arrayBuffer();

    // Convert ArrayBuffer to base64 string chunk-by-chunk to prevent stack overflows
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    const chunkSize = 0xffff;
    for (let k = 0; k < uint8Array.length; k += chunkSize) {
      binaryString += String.fromCharCode.apply(null, uint8Array.subarray(k, k + chunkSize) as any);
    }
    const pdfDataBase64 = btoa(binaryString);

    const dataSize = arrayBuffer.byteLength;
    const dataPtr = instance.pdfium.wasmExports.malloc(dataSize);
    (instance.pdfium as any).HEAPU8.set(uint8Array, dataPtr);

    let doc: number | null = null;
    try {
      doc = instance.FPDF_LoadMemDocument(dataPtr, dataSize, '');
      if (!doc) {
        const error = instance.FPDF_GetLastError();
        throw new Error(`Failed to load PDF document, error code: ${error}`);
      }

      const pageCount = instance.FPDF_GetPageCount(doc);
      const targetDpi = 300;
      const pdfScale = targetDpi / 72; // scale factor to convert 72 pt/inch to 300 dpi (4.16667x)
      console.log(`[PDF Import] Page count: ${pageCount}, target rendering DPI: ${targetDpi} (scale factor: ${pdfScale.toFixed(4)})`);
      
      const layers: Layer[] = [];
      const gap = 50;
      let currentY = 0;
      let maxPageWidth = 0;

      const pagesData: Array<{ width: number; height: number; originalW: number; originalH: number; page: number }> = [];
      for (let i = 0; i < pageCount; i++) {
        const page = instance.FPDF_LoadPage(doc, i);
        if (!page) continue;
        const w = instance.FPDF_GetPageWidthF(page);
        const h = instance.FPDF_GetPageHeightF(page);
        
        // Scale the page dimensions to match the requested 300 DPI
        const pixelW = Math.round(w * pdfScale);
        const pixelH = Math.round(h * pdfScale);
        
        console.log(`[PDF Import] Page ${i + 1} original physical size: width=${w}, height=${h} pt -> Target high-res size: width=${pixelW}, height=${pixelH} px`);
        pagesData.push({ width: pixelW, height: pixelH, originalW: w, originalH: h, page });
        if (pixelW > maxPageWidth) maxPageWidth = pixelW;
      }

      for (let i = 0; i < pagesData.length; i++) {
        const { width: renderW, height: renderH, originalH, page } = pagesData[i];
        console.log(`[PDF Import] Extracting text and rendering Page ${i + 1} at high-resolution: width=${renderW}, height=${renderH}`);

        // 1. Extract Text Objects as Editable Text Layers
        const textLayers: Layer[] = [];
        const textPage = instance.FPDFText_LoadPage(page);
        if (textPage) {
          try {
            const objCount = instance.FPDFPage_CountObjects(page);
            console.log(`[PDF Import] Page ${i + 1} total objects count: ${objCount}`);
            const textObjectsToRemove: number[] = [];
            // Map from fontHandle -> { checksum, registeredFontKey } to avoid re-extracting the same font binary
            const fontRegistry = new Map<number, { checksum: string; fontKey: string }>();
            const rawItems: Array<{
              text: string;
              left: number;
              bottom: number;
              right: number;
              top: number;
              fontSize: number;
              fontName: string;
              fontWeight: string;
              fontChecksum?: string;
              color: string;
              opacity: number;
            }> = [];

            for (let j = 0; j < objCount; j++) {
              const pageObj = instance.FPDFPage_GetObject(page, j);
              if (!pageObj) continue;

              const objType = instance.FPDFPageObj_GetType(pageObj);
              if (objType === 1) { // FPDF_PAGEOBJ_TEXT
                // Get Text Content
                const textSize = instance.FPDFTextObj_GetText(pageObj, textPage, 0, 0);
                let textContent = '';
                if (textSize > 0) {
                  const textBufPtr = instance.pdfium.wasmExports.malloc(textSize);
                  instance.FPDFTextObj_GetText(pageObj, textPage, textBufPtr, textSize);
                  textContent = instance.pdfium.UTF16ToString(textBufPtr);
                  instance.pdfium.wasmExports.free(textBufPtr);
                }

                textContent = textContent.trim();
                if (!textContent) {
                  textObjectsToRemove.push(pageObj);
                  continue;
                }

                // Get Font Size (points)
                const sizePtr = instance.pdfium.wasmExports.malloc(4);
                let baseFontSize = 12;
                if (instance.FPDFTextObj_GetFontSize(pageObj, sizePtr)) {
                  baseFontSize = new Float32Array((instance.pdfium as any).HEAPU8.buffer, (instance.pdfium as any).HEAPU8.byteOffset + sizePtr, 1)[0];
                }
                instance.pdfium.wasmExports.free(sizePtr);

                // Get Matrix to compute actual vertical scaling
                let scaleY = 1.0;
                const matrixPtr = instance.pdfium.wasmExports.malloc(24); // 6 floats * 4 bytes = 24 bytes
                if (instance.FPDFPageObj_GetMatrix(pageObj, matrixPtr)) {
                  const matrixArr = new Float32Array((instance.pdfium as any).HEAPU8.buffer, (instance.pdfium as any).HEAPU8.byteOffset + matrixPtr, 6);
                  const b = matrixArr[1];
                  const d = matrixArr[3];
                  scaleY = Math.sqrt(b * b + d * d);
                }
                instance.pdfium.wasmExports.free(matrixPtr);

                const fontSize = baseFontSize * scaleY;

                // Get Bounds
                const boundsPtr = instance.pdfium.wasmExports.malloc(16);
                let left = 0, bottom = 0, right = 0, top = 0;
                if (instance.FPDFPageObj_GetBounds(pageObj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12)) {
                  const boundsArr = new Float32Array((instance.pdfium as any).HEAPU8.buffer, (instance.pdfium as any).HEAPU8.byteOffset + boundsPtr, 4);
                  left = boundsArr[0];
                  bottom = boundsArr[1];
                  right = boundsArr[2];
                  top = boundsArr[3];
                }
                instance.pdfium.wasmExports.free(boundsPtr);

                // Get Font Name, Weight & extract embedded binary
                const fontHandle = instance.FPDFTextObj_GetFont(pageObj);
                let fontName = 'Arial';
                let fontWeightStr = 'normal';
                let fontChecksumStr: string | undefined;
                if (fontHandle) {
                  // Try to get family name
                  const familyLen = instance.FPDFFont_GetFamilyName(fontHandle, 0, 0);
                  let familyName = '';
                  if (familyLen > 0) {
                    const familyPtr = instance.pdfium.wasmExports.malloc(familyLen);
                    instance.FPDFFont_GetFamilyName(fontHandle, familyPtr, familyLen);
                    familyName = instance.pdfium.UTF8ToString(familyPtr);
                    instance.pdfium.wasmExports.free(familyPtr);
                  }

                  // Get base font name (includes subset prefix like "ABCDEF+Mangal")
                  const nameLen = instance.FPDFFont_GetBaseFontName(fontHandle, 0, 0);
                  let baseName = '';
                  if (nameLen > 0) {
                    const fontNamePtr = instance.pdfium.wasmExports.malloc(nameLen);
                    instance.FPDFFont_GetBaseFontName(fontHandle, fontNamePtr, nameLen);
                    baseName = instance.pdfium.UTF8ToString(fontNamePtr);
                    instance.pdfium.wasmExports.free(fontNamePtr);
                  }

                  fontName = cleanFontFamily(familyName || baseName || 'Arial');

                  // Get font weight
                  const weightVal = instance.FPDFFont_GetWeight(fontHandle);
                  if (weightVal > 0) {
                    if (weightVal >= 700) fontWeightStr = 'bold';
                    else if (weightVal >= 600) fontWeightStr = '600';
                    else if (weightVal >= 500) fontWeightStr = '500';
                    else if (weightVal <= 300) fontWeightStr = '300';
                  }

                  // ── Extract embedded font binary and register as browser FontFace ──
                  if (!fontRegistry.has(fontHandle)) {
                    try {
                      const isEmbedded = instance.FPDFFont_GetIsEmbedded(fontHandle);
                      if (isEmbedded) {
                        // First call: get the data length
                        const dataLenPtr = instance.pdfium.wasmExports.malloc(4);
                        (instance as any).FPDFFont_GetFontData(fontHandle, 0, 0, dataLenPtr);
                        const actualLen = new Uint32Array((instance.pdfium as any).HEAPU8.buffer, (instance.pdfium as any).HEAPU8.byteOffset + dataLenPtr, 1)[0];
                        instance.pdfium.wasmExports.free(dataLenPtr);

                        if (actualLen > 0) {
                          // Second call: get actual font bytes
                          const fontDataPtr = instance.pdfium.wasmExports.malloc(actualLen);
                          const dataLenPtr2 = instance.pdfium.wasmExports.malloc(4);
                          (instance as any).FPDFFont_GetFontData(fontHandle, fontDataPtr, actualLen, dataLenPtr2);
                          instance.pdfium.wasmExports.free(dataLenPtr2);

                          const fontBytes = new Uint8Array(
                            (instance.pdfium as any).HEAPU8.buffer,
                            (instance.pdfium as any).HEAPU8.byteOffset + fontDataPtr,
                            actualLen
                          ).slice();
                          instance.pdfium.wasmExports.free(fontDataPtr);

                          // Compute a simple FNV-1a 32-bit checksum
                          let hash = 2166136261;
                          for (let bi = 0; bi < fontBytes.length; bi++) {
                            hash ^= fontBytes[bi];
                            hash = (hash * 16777619) >>> 0;
                          }
                          const checksum = hash.toString(16).padStart(8, '0');
                          const fontKey = `pdf-font-${checksum}`;

                          // Register with the browser's FontFace API if not already done
                          const alreadyLoaded = Array.from(document.fonts as any).some((f: any) => f.family === fontKey);
                          if (!alreadyLoaded) {
                            const fontFace = new FontFace(fontKey, fontBytes.buffer);
                            fontFace.load().then(loaded => {
                              (document.fonts as any).add(loaded);
                              console.log(`[PDF Import] Registered embedded font: ${fontKey} (${fontName}, ${actualLen} bytes)`);
                            }).catch((e: any) => console.warn(`[PDF Import] Failed to register font ${fontKey}:`, e));
                          }

                          fontRegistry.set(fontHandle, { checksum, fontKey });
                          fontChecksumStr = checksum;
                        }
                      } else {
                        // Not embedded — mark as not in registry so we don't try again
                        fontRegistry.set(fontHandle, { checksum: '', fontKey: '' });
                      }
                    } catch (fontErr) {
                      console.warn('[PDF Import] Font extraction error:', fontErr);
                      fontRegistry.set(fontHandle, { checksum: '', fontKey: '' });
                    }
                  } else {
                    const cached = fontRegistry.get(fontHandle)!;
                    if (cached.checksum) fontChecksumStr = cached.checksum;
                  }
                }

                // Get Fill Color (RGBA)
                const colorPtr = instance.pdfium.wasmExports.malloc(16);
                let fillHex = '#000000';
                let opacity = 1;
                if (instance.FPDFPageObj_GetFillColor(pageObj, colorPtr, colorPtr + 4, colorPtr + 8, colorPtr + 12)) {
                  const colorArr = new Uint32Array((instance.pdfium as any).HEAPU8.buffer, (instance.pdfium as any).HEAPU8.byteOffset + colorPtr, 4);
                  const r = colorArr[0];
                  const g = colorArr[1];
                  const b = colorArr[2];
                  const a = colorArr[3];
                  
                  const toHex = (c: number) => c.toString(16).padStart(2, '0');
                  fillHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                  opacity = a / 255;
                }
                instance.pdfium.wasmExports.free(colorPtr);

                rawItems.push({
                  text: textContent,
                  left,
                  bottom,
                  right,
                  top,
                  fontSize,
                  fontName,
                  fontWeight: fontWeightStr,
                  fontChecksum: fontChecksumStr,
                  color: fillHex,
                  opacity,
                });
                textObjectsToRemove.push(pageObj);
              }
            }

            // 1. Group raw items into vertical rows (lines).
            // This groups conjuncts, base consonants, top matras, and bottom matras correctly.
            const rows: Array<typeof rawItems> = [];
            for (const item of rawItems) {
              const itemCenterY = (item.top + item.bottom) / 2;
              
              // Find an existing row where the average vertical center matches this item's center
              const foundRow = rows.find(row => {
                const rowCenterY = row.reduce((sum, r) => sum + (r.top + r.bottom) / 2, 0) / row.length;
                const maxFS = Math.max(item.fontSize, ...row.map(r => r.fontSize));
                return Math.abs(itemCenterY - rowCenterY) < maxFS * 0.8;
              });

              if (foundRow) {
                foundRow.push(item);
              } else {
                rows.push([item]);
              }
            }

            // 2. Sort rows from top-to-bottom (Y descending in PDF space)
            rows.sort((a, b) => {
              const centerA = a.reduce((sum, r) => sum + (r.top + r.bottom) / 2, 0) / a.length;
              const centerB = b.reduce((sum, r) => sum + (r.top + r.bottom) / 2, 0) / b.length;
              return centerB - centerA;
            });

            // 3. For each row, sort items from left-to-right (X ascending), and merge close items
            for (const row of rows) {
              row.sort((a, b) => a.left - b.left);

              const rowMerged: Array<{
                text: string;
                left: number;
                bottom: number;
                right: number;
                top: number;
                fontSize: number;
                fontName: string;
                fontWeight: string;
                fontChecksum?: string;
                color: string;
                opacity: number;
                items: typeof rawItems;
              }> = [];

              for (const item of row) {
                if (rowMerged.length === 0) {
                  rowMerged.push({ ...item, items: [{ ...item }] });
                  continue;
                }

                const current = rowMerged[rowMerged.length - 1];
                const horizontalGap = item.left - current.right;
                
                // Merge if horizontal gap is small (e.g. continuous text, matras, or standard spacing)
                if (horizontalGap < Math.max(item.fontSize, current.fontSize) * 1.5) {
                  const needsSpace = horizontalGap > Math.max(item.fontSize, current.fontSize) * 0.15 && 
                                     !current.text.endsWith(' ') && 
                                     !item.text.startsWith(' ');
                  
                  current.text += (needsSpace ? ' ' : '') + item.text;
                  current.right = Math.max(current.right, item.right);
                  current.top = Math.max(current.top, item.top);
                  current.bottom = Math.min(current.bottom, item.bottom);
                  if (item.fontSize > current.fontSize) {
                    current.fontSize = item.fontSize;
                    current.fontName = item.fontName;
                    current.fontWeight = item.fontWeight;
                    if (item.fontChecksum) current.fontChecksum = item.fontChecksum;
                  }
                  current.items.push({ ...item });
                } else {
                  rowMerged.push({ ...item, items: [{ ...item }] });
                }
              }

              // Create text layers for each merged segment in this row
              for (const line of rowMerged) {
                const pixelW = Math.max(1, (line.right - line.left) * pdfScale);
                const pixelH = Math.max(1, (line.top - line.bottom) * pdfScale);
                const pixelX = line.left * pdfScale;
                const pixelY = (originalH - line.top) * pdfScale;
                const pixelFontSize = line.fontSize * pdfScale;

                // Build run-level layout data for pixel-perfect browser font rendering overlay.
                // We combine consecutive character elements into single unified words (spans)
                // so the browser's layout engine shapes ligatures, conjuncts, and diacritics (matras) properly
                // without rendering broken dotted circles.
                const runs: TextRun[] = [];
                let currentRun: TextRun | null = null;

                for (let k = 0; k < line.items.length; k++) {
                  const item = line.items[k];
                  const itemX = (item.left - line.left) * pdfScale;
                  const itemY = (line.top - item.top) * pdfScale;
                  const itemFontSize = Math.round(item.fontSize * pdfScale);

                  if (!currentRun) {
                    currentRun = {
                      str: item.text,
                      fontSize: itemFontSize,
                      fontFamily: item.fontChecksum ? `pdf-font-${item.fontChecksum}` : item.fontName,
                      fontWeight: item.fontWeight,
                      color: item.color,
                      opacity: item.opacity,
                      x: itemX,
                      y: itemY,
                    };
                    continue;
                  }

                  const prevItem = line.items[k - 1];
                  const gap = item.left - prevItem.right;

                  // If the gap is extremely small or negative (indicating kerning, overlapping matras, or same word),
                  // merge into a single absolute-positioned span/run.
                  const maxFS = Math.max(prevItem.fontSize, item.fontSize);
                  const isContinuous = gap < maxFS * 0.18;

                  if (isContinuous) {
                    currentRun.str += item.text;
                    if (itemFontSize > currentRun.fontSize) {
                      currentRun.fontSize = itemFontSize;
                      currentRun.fontFamily = item.fontName;
                      currentRun.fontWeight = item.fontWeight;
                    }
                  } else {
                    runs.push(currentRun);
                    currentRun = {
                      str: item.text,
                      fontSize: itemFontSize,
                      fontFamily: item.fontChecksum ? `pdf-font-${item.fontChecksum}` : item.fontName,
                      fontWeight: item.fontWeight,
                      color: item.color,
                      opacity: item.opacity,
                      x: itemX,
                      y: itemY,
                    };
                  }
                }

                if (currentRun) {
                  runs.push(currentRun);
                }

                const textLayer: Layer = {
                  id: Math.random().toString(36).substring(7),
                  name: `Text: ${line.text.substring(0, 15)}${line.text.length > 15 ? '...' : ''}`,
                  type: 'text',
                  width: Math.round(pixelW),
                  height: Math.round(pixelH),
                  position: { x: pixelX, y: pixelY },
                  visible: true,
                  locked: false,
                  opacity: line.opacity,
                  blendMode: 'source-over',
                  textContent: line.text,
                  fontSize: Math.round(pixelFontSize),
                  // fontFamily stores the clean human-readable name for fallback/display
                  fontFamily: line.fontName,
                  fontWeight: line.fontWeight,
                  // fontChecksum links to the registered FontFace for exact glyph rendering
                  fontChecksum: line.fontChecksum,
                  color: line.color,
                  runs: runs,
                  importedFromPdf: true,
                };

                textLayers.push(textLayer);
              }
            }

            console.log(`[PDF Import] Extracted ${textLayers.length} text layers from Page ${i + 1} without stripping them from background.`);
          } catch (err) {
            console.error('[PDF Import] Failed to extract text objects:', err);
          } finally {
            instance.FPDFText_ClosePage(textPage);
          }
        }

        const bitmap = instance.FPDFBitmap_Create(renderW, renderH, 1);
        if (!bitmap) throw new Error('Failed to create PDFium bitmap');

        try {
          // Clear background to white
          instance.FPDFBitmap_FillRect(bitmap, 0, 0, renderW, renderH, 0xFFFFFFFF);
          // Render page to bitmap with high-quality screen rendering flags
          instance.FPDF_RenderPageBitmap(bitmap, page, 0, 0, renderW, renderH, 0, 23);

          const bufferPtr = instance.FPDFBitmap_GetBuffer(bitmap);
          if (!bufferPtr) throw new Error('Failed to get bitmap buffer');
          const bufferSize = renderW * renderH * 4;

          const buffer = new Uint8Array(
            (instance.pdfium as any).HEAPU8.buffer,
            (instance.pdfium as any).HEAPU8.byteOffset + bufferPtr,
            bufferSize
          ).slice();

          const canvas = document.createElement('canvas');
          canvas.width = renderW;
          canvas.height = renderH;
          console.log(`[PDF Import] Canvas size set to: width=${canvas.width}, height=${canvas.height}`);
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');

          const imgData = new ImageData(
            new Uint8ClampedArray(buffer.buffer),
            renderW,
            renderH
          );
          ctx.putImageData(imgData, 0, 0);

          const pageDataUrl = canvas.toDataURL('image/png');

          const pageArtboard: Layer = {
            id: Math.random().toString(36).substring(7),
            name: `Page ${i + 1}`,
            type: 'artboard',
            width: renderW,
            height: renderH,
            position: { x: (maxPageWidth - renderW) / 2, y: currentY },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over',
            backgroundTransparent: false,
            backgroundColor: '#ffffff',
            children: [
              ...textLayers,
              {
                id: Math.random().toString(36).substring(7),
                name: `Page ${i + 1} Background`,
                type: 'image',
                width: renderW,
                height: renderH,
                position: { x: 0, y: 0 },
                visible: true,
                locked: true,
                opacity: 1,
                blendMode: 'source-over',
                dataUrl: pageDataUrl,
                importedFromPdf: true,
                isPdfBackground: true,
                pdfData: pdfDataBase64,
                pdfPageIndex: i,
              }
            ]
          };

          console.log(`[PDF Import] Page ${i + 1} Artboard generated: width=${pageArtboard.width}, height=${pageArtboard.height}, position.y=${pageArtboard.position.y}`);
          console.log(`[PDF Import] Page ${i + 1} Background layer: width=${pageArtboard.children![pageArtboard.children!.length - 1].width}, height=${pageArtboard.children![pageArtboard.children!.length - 1].height}`);

          layers.push(pageArtboard);
          currentY += renderH + gap;
        } finally {
          instance.FPDFBitmap_Destroy(bitmap);
          instance.FPDF_ClosePage(page);
        }
      }

      const finalWidth = maxPageWidth;
      const finalHeight = Math.max(0, currentY - gap);
      console.log(`[PDF Import] Final combined PDF container: width=${finalWidth}, height=${finalHeight}`);

      return {
        name: file.name,
        type: 'pdf',
        layers,
        width: finalWidth,
        height: finalHeight
      };
    } finally {
      if (doc) instance.FPDF_CloseDocument(doc);
      instance.pdfium.wasmExports.free(dataPtr);
    }
  }
}

function cleanFontFamily(name: string): string {
  // Strip subset prefix (e.g. ABCDEF+Arial -> Arial)
  let clean = name.includes('+') ? name.split('+')[1] : name;
  
  // Strip common suffixes
  clean = clean.replace(/(PSMT|MT|PS|Roman|Regular|Bold|Italic|Oblique|Medium|Light|Regular|Black|Heavy|\-)+$/gi, '');
  clean = clean.split('-')[0]; // take first part before hyphen
  clean = clean.trim();

  // Normalize common fonts
  const lower = clean.toLowerCase();
  if (lower.includes('times')) return 'Times New Roman';
  if (lower.includes('arial')) return 'Arial';
  if (lower.includes('courier')) return 'Courier New';
  if (lower.includes('calibri')) return 'Calibri';
  if (lower.includes('helvetica')) return 'Helvetica';
  if (lower.includes('georgia')) return 'Georgia';
  if (lower.includes('tahoma')) return 'Tahoma';
  if (lower.includes('verdana')) return 'Verdana';
  if (lower.includes('trebuchet')) return 'Trebuchet MS';
  if (lower.includes('cambria')) return 'Cambria';
  if (lower.includes('garamond')) return 'Garamond';
  if (lower.includes('mangal')) return 'Mangal';
  if (lower.includes('devanagari')) return 'Noto Sans Devanagari';

  return clean;
}
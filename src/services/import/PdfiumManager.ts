import { init } from '@embedpdf/pdfium';
import type { WrappedPdfiumModule } from '@embedpdf/pdfium';
// @ts-ignore
import pdfiumWasmUrl from '@embedpdf/pdfium/pdfium.wasm?url';

class PdfiumManager {
  private instance: WrappedPdfiumModule | null = null;
  private initPromise: Promise<WrappedPdfiumModule> | null = null;
  private documentCache = new Map<string, { doc: number; dataPtr: number; refCount: number }>();

  async getInstance(): Promise<WrappedPdfiumModule> {
    if (this.instance) return this.instance;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const wasmBinary = await fetch(pdfiumWasmUrl).then((res) => res.arrayBuffer());
      const inst = await init({ wasmBinary });
      inst.PDFiumExt_Init();
      this.instance = inst;
      return inst;
    })();

    return this.initPromise;
  }

  async getDocument(pdfDataBase64: string): Promise<number> {
    const inst = await this.getInstance();
    const cached = this.documentCache.get(pdfDataBase64);
    if (cached) {
      cached.refCount++;
      return cached.doc;
    }

    // Load from base64
    const binaryString = atob(pdfDataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const dataSize = bytes.byteLength;
    const dataPtr = inst.pdfium.wasmExports.malloc(dataSize);
    (inst.pdfium as any).HEAPU8.set(bytes, dataPtr);

    const doc = inst.FPDF_LoadMemDocument(dataPtr, dataSize, '');
    if (!doc) {
      const error = inst.FPDF_GetLastError();
      inst.pdfium.wasmExports.free(dataPtr);
      throw new Error(`Failed to load PDF document, error code: ${error}`);
    }

    this.documentCache.set(pdfDataBase64, { doc, dataPtr, refCount: 1 });
    return doc;
  }

  async releaseDocument(pdfDataBase64: string) {
    const cached = this.documentCache.get(pdfDataBase64);
    if (!cached) return;
    cached.refCount--;
    if (cached.refCount <= 0) {
      const inst = await this.getInstance();
      inst.FPDF_CloseDocument(cached.doc);
      inst.pdfium.wasmExports.free(cached.dataPtr);
      this.documentCache.delete(pdfDataBase64);
    }
  }

  async renderPage(
    pdfDataBase64: string,
    pageIndex: number,
    width: number,
    height: number,
    canvas: HTMLCanvasElement
  ): Promise<void> {
    console.log(`[PdfiumManager] renderPage called for pageIndex=${pageIndex}. Requested dimensions: width=${width}, height=${height}. Target canvas size: width=${canvas.width}, height=${canvas.height}`);
    const inst = await this.getInstance();
    const doc = await this.getDocument(pdfDataBase64);
    const page = inst.FPDF_LoadPage(doc, pageIndex);
    if (!page) {
      await this.releaseDocument(pdfDataBase64);
      throw new Error(`Failed to load PDF page ${pageIndex}`);
    }

    const bitmap = inst.FPDFBitmap_Create(width, height, 1);
    if (!bitmap) {
      inst.FPDF_ClosePage(page);
      await this.releaseDocument(pdfDataBase64);
      throw new Error('Failed to create PDFium bitmap');
    }

    try {
      // Clear background to opaque white
      inst.FPDFBitmap_FillRect(bitmap, 0, 0, width, height, 0xFFFFFFFF);
      // Render page contents to bitmap with FPDF_REVERSE_BYTE_ORDER (16) | FPDF_LCD_TEXT (2) | FPDF_ANNOT (1) | FPDF_NO_NATIVETEXT (4)
      inst.FPDF_RenderPageBitmap(bitmap, page, 0, 0, width, height, 0, 23);

      const bufferPtr = inst.FPDFBitmap_GetBuffer(bitmap);
      if (!bufferPtr) throw new Error('Failed to get bitmap buffer');
      const bufferSize = width * height * 4;

      // Slice the heap buffer as recommended in the reference implementation to avoid memory issues
      const buffer = new Uint8Array(
        (inst.pdfium as any).HEAPU8.buffer,
        (inst.pdfium as any).HEAPU8.byteOffset + bufferPtr,
        bufferSize
      ).slice();

      const imgData = new ImageData(
        new Uint8ClampedArray(buffer.buffer),
        width,
        height
      );

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      // Guard against race conditions: only draw if the canvas hasn't resized
      if (canvas.width === width && canvas.height === height) {
        ctx.putImageData(imgData, 0, 0);
        console.log(`[PdfiumManager] Dynamic render successful onto canvas.`);
      } else {
        console.warn(`[PdfiumManager] Render guard triggered: requested size (${width}x${height}) does not match current canvas size (${canvas.width}x${canvas.height}). Draw skipped.`);
      }
    } finally {
      inst.FPDFBitmap_Destroy(bitmap);
      inst.FPDF_ClosePage(page);
      await this.releaseDocument(pdfDataBase64);
    }
  }
}

export const pdfiumManager = new PdfiumManager();

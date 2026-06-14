import * as pdfjsLib from 'pdfjs-dist';
import type { PdfEngineAdapter } from '../../types/PdfEngineAdapter';
import type { SceneNode, PageData, DocumentMetadata, AnnotationData } from '../../types/SceneNode';
import { PdfjsParser } from '../../parser/PdfjsParser';
import { MetadataEngine } from './MetadataEngine';
import { AnnotationEngine } from './AnnotationEngine';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set pdf.js worker — this runs in the MAIN THREAD so the worker URL is valid.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PdfjsEngineAdapter implements PdfEngineAdapter {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;

  private async canvasToDataUrl(
    canvas: HTMLCanvasElement | OffscreenCanvas
  ): Promise<string> {
    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
      return canvas.toDataURL('image/png');
    }

    const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' });
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(reader.error ?? new Error('Failed to read page blob'));
      reader.readAsDataURL(blob);
    });
  }

  async init(): Promise<void> {
    // Worker is configured via GlobalWorkerOptions above.
  }

  async loadDocument(data: ArrayBuffer): Promise<void> {
    if (this.doc) {
      this.doc.cleanup();
    }
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      fontExtraProperties: true
    });
    this.doc = await loadingTask.promise;
  }

  async getPages(): Promise<PageData[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const pages: PageData[] = [];
    const count = this.doc.numPages;
    for (let i = 1; i <= count; i++) {
      const page = await this.doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });
      pages.push({
        pageIndex: i - 1,
        width:  Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        nodes: [],
      });
    }
    return pages;
  }

  async extractObjects(pageIndex: number): Promise<SceneNode[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = await this.doc.getPage(pageIndex + 1);
    const parser = new PdfjsParser(page);
    return parser.parseObjects();
  }

  /** Extract document-level metadata (author, title, dates, etc.) */
  async extractMetadata(): Promise<DocumentMetadata> {
    if (!this.doc) throw new Error('Document not loaded');
    return MetadataEngine.extract(this.doc);
  }

  /**
   * Extract per-page annotations (links, comments, form fields).
   * @param pageIndex  0-based page index
   * @param pageHeight Native page height (for Y-flip to screen space)
   */
  async extractAnnotations(pageIndex: number, pageHeight: number): Promise<AnnotationData[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = await this.doc.getPage(pageIndex + 1);
    return AnnotationEngine.extract(page, pageHeight);
  }

  /**
   * Renders a PDF page to a data URL using an HTMLCanvasElement.
   * Runs in the main thread so document.createElement is always available.
   * The returned data URL image is at (scale × nativeDimension) pixels for
   * high-fidelity rendering, but the logical layer dimensions remain at scale 1.
   */
  async renderPageToDataUrl(
    pageIndex: number,
    scale = 2.0,
    options?: {
      includeText?: boolean;
      includeImages?: boolean;
      includeVectors?: boolean;
    }
  ): Promise<string> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = await this.doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width  = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2d context');

    // White background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const includeText = options?.includeText ?? true;
    const includeImages = options?.includeImages ?? true;
    const includeVectors = options?.includeVectors ?? true;

    const origFillText = context.fillText.bind(context);
    const origStrokeText = context.strokeText.bind(context);
    const origDrawImage = context.drawImage.bind(context);
    const origFill = context.fill.bind(context);
    const origStroke = context.stroke.bind(context);
    const origFillRect = context.fillRect.bind(context);
    const origStrokeRect = context.strokeRect.bind(context);
    const origPutImageData = context.putImageData.bind(context);

    if (!includeText) {
      context.fillText = () => {};
      context.strokeText = () => {};
    }
    if (!includeImages) {
      context.drawImage = (() => {}) as typeof context.drawImage;
      context.putImageData = (() => {}) as typeof context.putImageData;
    }
    if (!includeVectors) {
      context.fill = (() => {}) as typeof context.fill;
      context.stroke = (() => {}) as typeof context.stroke;
      context.fillRect = ((x: number, y: number, w: number, h: number) => {
        if (x === 0 && y === 0 && w === canvas.width && h === canvas.height) {
          origFillRect(x, y, w, h);
        }
      }) as typeof context.fillRect;
      context.strokeRect = (() => {}) as typeof context.strokeRect;
    }

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    context.fillText = origFillText;
    context.strokeText = origStrokeText;
    context.drawImage = origDrawImage;
    context.fill = origFill;
    context.stroke = origStroke;
    context.fillRect = origFillRect;
    context.strokeRect = origStrokeRect;
    context.putImageData = origPutImageData;

    return this.canvasToDataUrl(canvas);
  }

  async closeDocument(): Promise<void> {
    if (this.doc) {
      await this.doc.cleanup();
      this.doc = null;
    }
  }
}

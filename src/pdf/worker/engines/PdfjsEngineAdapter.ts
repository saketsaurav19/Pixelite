import * as pdfjsLib from 'pdfjs-dist';
import type { PdfEngineAdapter } from '../../types/PdfEngineAdapter';
import type { SceneNode, PageData } from '../../types/SceneNode';
import { PdfjsParser } from '../../parser/PdfjsParser';

import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set pdf.js worker — this runs in the MAIN THREAD so the worker URL is valid.
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export class PdfjsEngineAdapter implements PdfEngineAdapter {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;

  async init(): Promise<void> {
    // Worker is configured via GlobalWorkerOptions above.
  }

  async loadDocument(data: ArrayBuffer): Promise<void> {
    if (this.doc) {
      this.doc.cleanup();
    }
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(data) });
    this.doc = await loadingTask.promise;
  }

  async getPages(): Promise<PageData[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const pages: PageData[] = [];
    const count = this.doc.numPages;
    for (let i = 1; i <= count; i++) {
      const page = await this.doc.getPage(i);
      // scale: 1.0 gives us the native CSS/logical pixel dimensions of the page
      const viewport = page.getViewport({ scale: 1.0 });
      pages.push({
        pageIndex: i - 1,
        width: Math.floor(viewport.width),
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

  /**
   * Renders a PDF page to a data URL using an HTMLCanvasElement.
   * Runs in the main thread so document.createElement is always available.
   * The returned data URL image is at (scale * nativeDimension) pixels for
   * high-fidelity rendering, but the logical layer dimensions remain at scale 1.
   */
  async renderPageToDataUrl(pageIndex: number, scale: number = 2.0): Promise<string> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = await this.doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });

    // Use HTMLCanvasElement — runs in main thread where document is available.
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2d context');

    // Suppress text rendering on the raster canvas so text isn't doubled (text layers are overlaid on top)
    context.fillText = () => {};
    context.strokeText = () => {};

    // White background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    return canvas.toDataURL('image/png');
  }

  async closeDocument(): Promise<void> {
    if (this.doc) {
      await this.doc.cleanup();
      this.doc = null;
    }
  }
}

import * as pdfjsLib from 'pdfjs-dist';
import type { PdfEngineAdapter } from '../../types/PdfEngineAdapter';
import type { SceneNode, PageData } from '../../types/SceneNode';
import { PdfjsParser } from '../../parser/PdfjsParser';

// Initialize the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export class PdfjsEngineAdapter implements PdfEngineAdapter {
  private doc: pdfjsLib.PDFDocumentProxy | null = null;

  async init(): Promise<void> {
    // Initialization handled by GlobalWorkerOptions
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
    for (let i = 1; i <= count; i++) { // pdf.js uses 1-based indexing
      const page = await this.doc.getPage(i);
      const viewport = page.getViewport({ scale: 1.0 });

      pages.push({
        pageIndex: i - 1, // Store 0-based for internal consistency
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        nodes: [] // Extracted later
      });
    }
    return pages;
  }

  async extractObjects(pageIndex: number): Promise<SceneNode[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = await this.doc.getPage(pageIndex + 1); // pdf.js uses 1-based indexing
    const parser = new PdfjsParser(page);
    return parser.parseObjects();
  }

  async closeDocument(): Promise<void> {
    if (this.doc) {
      await this.doc.cleanup();
      this.doc = null;
    }
  }
}

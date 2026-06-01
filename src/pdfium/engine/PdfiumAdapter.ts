import { PDFiumLibrary, PDFiumDocument } from '@hyzyla/pdfium';
import type { PdfEngineAdapter } from '../types/PdfEngineAdapter';
import type { SceneNode, PageData } from '../types/SceneNode';
import { PdfParser } from '../parser/PdfParser';

export class PdfiumAdapter implements PdfEngineAdapter {
  private lib: PDFiumLibrary | null = null;
  private doc: PDFiumDocument | null = null;

  async init(): Promise<void> {
    if (!this.lib) {
      this.lib = await PDFiumLibrary.init();
    }
  }

  async loadDocument(data: ArrayBuffer): Promise<void> {
    await this.init();
    if (this.doc) {
      this.doc.destroy();
    }
    this.doc = await this.lib!.loadDocument(new Uint8Array(data));
  }

  async getPages(): Promise<PageData[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const pages: PageData[] = [];
    const count = this.doc.getPageCount();
    for (let i = 0; i < count; i++) {

      const page = this.doc.getPage(i);
      const { originalWidth, originalHeight } = page.getOriginalSize();

      pages.push({
        pageIndex: i,
        width: Math.floor(originalWidth * 2),
        height: Math.floor(originalHeight * 2),
        nodes: [] // Extracted later
      });
    }
    return pages;
  }

  async extractObjects(pageIndex: number): Promise<SceneNode[]> {
    if (!this.doc) throw new Error('Document not loaded');
    const page = this.doc.getPage(pageIndex);
    const parser = new PdfParser(page);
    return parser.parseObjects();
  }

  async closeDocument(): Promise<void> {
    if (this.doc) {
      this.doc.destroy();
      this.doc = null;
    }
    // We can keep lib initialized for the worker lifetime
  }
}

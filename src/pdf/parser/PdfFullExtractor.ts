import * as pdfjsLib from 'pdfjs-dist';
import { PdfjsParser } from './PdfjsParser';
import { MetadataEngine } from '../worker/engines/MetadataEngine';
import { AnnotationEngine } from '../worker/engines/AnnotationEngine';
import type { SceneNode, DocumentMetadata, AnnotationData } from '../types/SceneNode';

export interface FullPdfExtractionResult {
  metadata: DocumentMetadata & {
    pdfVersion?: string;
    isEncrypted?: boolean;
    xmpXml?: string;
  };
  outline: any[];
  attachments: { name: string; length?: number }[];
  pagesCount: number;
  pages: {
    pageIndex: number;
    width: number;
    height: number;
    rotation: number;
    layers: SceneNode[];
    annotations: AnnotationData[];
  }[];
}

export class PdfFullExtractor {
  /**
   * Performs a full-fidelity extraction of all structural, metadata, interactive,
   * and content elements from a loaded PDF.js PDFDocumentProxy.
   */
  static async extractAll(doc: pdfjsLib.PDFDocumentProxy): Promise<FullPdfExtractionResult> {
    // ── 1. Document-level Metadata & Properties ───────────────────────────
    let metadata: any = {};
    let xmpXml: string | undefined;
    let pdfVersion: string | undefined;

    try {
      const rawMeta = await doc.getMetadata();
      metadata = await MetadataEngine.extract(doc);
      if (rawMeta && rawMeta.metadata) {
        xmpXml = rawMeta.metadata.getRaw();
      }
      if (rawMeta && rawMeta.info) {
        pdfVersion = (rawMeta.info as any).PDFFormatVersion;
      }
    } catch (e) {
      console.warn('[PdfFullExtractor] Failed to extract metadata:', e);
    }

    // ── 2. Bookmarks / Outline ─────────────────────────────────────────────
    let outline: any[] = [];
    try {
      outline = (await doc.getOutline()) ?? [];
    } catch (e) {
      console.warn('[PdfFullExtractor] Failed to extract outline:', e);
    }

    // ── 3. File Attachments ────────────────────────────────────────────────
    const attachmentsList: { name: string; length?: number }[] = [];
    try {
      const attachments = (await doc.getAttachments()) ?? {};
      for (const name of Object.keys(attachments)) {
        const fileObj = attachments[name];
        attachmentsList.push({
          name,
          length: fileObj?.content?.byteLength,
        });
      }
    } catch (e) {
      console.warn('[PdfFullExtractor] Failed to extract attachments:', e);
    }

    // ── 4. Pages Walk ──────────────────────────────────────────────────────
    const pagesCount = doc.numPages;
    const pagesData: FullPdfExtractionResult['pages'] = [];

    for (let i = 0; i < pagesCount; i++) {
      try {
        const page = await doc.getPage(i + 1);
        const viewport = page.getViewport({ scale: 1.0 });

        // Parse page layout and vectors/texts/images/tables
        const parser = new PdfjsParser(page);
        const layers = await parser.parseObjects();

        // Parse annotations and interactive fields
        const annotations = await AnnotationEngine.extract(page, viewport.height);

        pagesData.push({
          pageIndex: i,
          width: Math.floor(viewport.width),
          height: Math.floor(viewport.height),
          rotation: viewport.rotation,
          layers,
          annotations,
        });
      } catch (pageErr) {
        console.error(`[PdfFullExtractor] Failed to parse page ${i + 1}:`, pageErr);
      }
    }

    return {
      metadata: {
        ...metadata,
        pdfVersion,
        isEncrypted: (doc as any).isEncrypted ?? false,
        xmpXml,
      },
      outline,
      attachments: attachmentsList,
      pagesCount,
      pages: pagesData,
    };
  }
}

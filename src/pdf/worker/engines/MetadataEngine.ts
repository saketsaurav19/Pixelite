import * as pdfjsLib from 'pdfjs-dist';
import type { DocumentMetadata } from '../../types/SceneNode';

/**
 * MetadataEngine — extracts document-level metadata from a PDF.
 *
 * Uses pdf.js's getMetadata() which returns both the raw info dict
 * (Author, Title, Creator, etc.) and the XMP metadata XML blob.
 */
export class MetadataEngine {
  static async extract(doc: pdfjsLib.PDFDocumentProxy): Promise<DocumentMetadata> {
    try {
      const { info } = await doc.getMetadata() as any;
      if (!info) return {};

      // CreationDate / ModDate in PDF are formatted as:
      //   D:YYYYMMDDHHmmSSOHH'mm' (e.g. "D:20230601120000+05'30'")
      // We attempt a best-effort ISO parse.
      const parseDate = (raw: string | undefined): string | undefined => {
        if (!raw) return undefined;
        // Strip "D:" prefix if present
        const s = raw.replace(/^D:/, '');
        // Try to build an ISO-8601 string: YYYY-MM-DDTHH:mm:ss
        if (s.length >= 14) {
          return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T` +
                 `${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}`;
        }
        return raw;
      };

      return {
        title:      info.Title,
        author:     info.Author,
        subject:    info.Subject,
        keywords:   info.Keywords,
        creator:    info.Creator,
        producer:   info.Producer,
        createdAt:  parseDate(info.CreationDate),
        modifiedAt: parseDate(info.ModDate),
      };
    } catch (e) {
      console.warn('MetadataEngine: Could not extract metadata', e);
      return {};
    }
  }
}

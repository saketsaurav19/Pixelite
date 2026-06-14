import * as pdfjsLib from 'pdfjs-dist';
import type { AnnotationData } from '../../types/SceneNode';
import { nanoid } from 'nanoid';

/**
 * AnnotationEngine — extracts per-page annotations from a PDF.
 *
 * Supports:
 *   - Link (URL hyperlinks, internal page links)
 *   - Text (comments / sticky notes)
 *   - Widget (form fields — text inputs, checkboxes, radio buttons, dropdowns)
 *   - Stamp
 *   - Highlight / Underline / Squiggly / StrikeOut
 */
export class AnnotationEngine {
  static async extract(
    page: pdfjsLib.PDFPageProxy,
    pageHeight: number
  ): Promise<AnnotationData[]> {
    try {
      const rawAnnotations = await page.getAnnotations() as any[];
      if (!rawAnnotations || rawAnnotations.length === 0) return [];

      return rawAnnotations.map((ann): AnnotationData => {
        // Flip Y: PDF rects are [x1, y1, x2, y2] in bottom-left origin space
        const [rx1, ry1, rx2, ry2] = ann.rect ?? [0, 0, 0, 0];
        const flippedRect = [rx1, pageHeight - ry2, rx2, pageHeight - ry1];

        return {
          id: nanoid(),
          subtype: ann.subtype ?? 'Unknown',
          rect: flippedRect,
          url: ann.url ?? ann.unsafeUrl,
          contents: ann.contents,
          fieldName: ann.fieldName,
          fieldValue: ann.fieldValue,
          color: ann.color
            ? `rgb(${Math.round(ann.color[0] * 255)},${Math.round(ann.color[1] * 255)},${Math.round(ann.color[2] * 255)})`
            : undefined,
          fieldType: ann.fieldType,
          alternativeText: ann.alternativeText,
          multiLine: ann.multiLine,
          options: ann.options,
          exportValue: ann.exportValue,
        };
      });
    } catch (e) {
      console.warn('AnnotationEngine: Could not extract annotations', e);
      return [];
    }
  }
}

import * as pdfjsLib from 'pdfjs-dist';
import type { TextNode } from '../../types/SceneNode';
import { nanoid } from 'nanoid';

export class TextEngine {
  static async extractText(page: pdfjsLib.PDFPageProxy, pageHeight: number): Promise<TextNode[]> {
    const nodes: TextNode[] = [];
    try {
      const textContent = await page.getTextContent();
      for (const item of textContent.items) {
        if ('str' in item && item.str.trim()) {
           const transform = item.transform;
           const x = transform[4];
           const y = pageHeight - transform[5];
           const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);

           const textNode: TextNode = {
             id: nanoid(),
             name: 'PDF Text',
             type: 'text',
             transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
             opacity: 1,
             blendMode: 'source-over',
             visible: true,
             locked: false,
             geometry: {
               text: item.str,
               fontSize: fontSize || 12,
               fontFamily: item.fontName || 'Arial'
             },
             style: {
               fillColor: '#000000'
             }
           };
           nodes.push(textNode);
        }
      }
    } catch (e) {
      console.error("TextEngine: Error extracting text", e);
    }
    return nodes;
  }
}

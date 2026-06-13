import * as pdfjsLib from 'pdfjs-dist';
import type { TextNode } from '../../types/SceneNode';
import { nanoid } from 'nanoid';

const DEVANAGARI_VISUAL_REORDER_REGEX = /(\u093f)((?:[\u0915-\u0939\u0958-\u095f]\u093c?\u094d)*[\u0915-\u0939\u0958-\u095f]\u093c?)/g;

function fixDevanagariOrder(text: string): string {
  return text.replace(DEVANAGARI_VISUAL_REORDER_REGEX, '$2$1');
}

export class TextEngine {
  static async extractText(page: pdfjsLib.PDFPageProxy, pageHeight: number): Promise<TextNode[]> {
    const nodes: TextNode[] = [];
    try {
      const textContent = await page.getTextContent();
      const items = textContent.items.filter((item: any) => 'str' in item && item.str.trim());

      if (items.length === 0) return [];

      // Map items to a richer structure with originalIndex
      const parsedItems = items.map((item: any, idx: number) => {
        const transform = item.transform;
        const x = transform[4];
        const y = pageHeight - transform[5];
        const fontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]);
        return {
          str: item.str,
          x,
          y,
          fontSize: fontSize || 12,
          fontFamily: item.fontName || 'Arial',
          width: item.width || 0,
          height: item.height || fontSize || 12,
          transform,
          originalIndex: idx
        };
      });

      // Sort items by Y first (top-to-bottom), then by originalIndex (logical reading order on the same line)
      parsedItems.sort((a, b) => {
        if (Math.abs(a.y - b.y) < Math.max(a.fontSize, b.fontSize) * 0.5) {
          return a.originalIndex - b.originalIndex;
        }
        return a.y - b.y;
      });

      // Merge items
      const mergedLines: {
        str: string;
        x: number;
        y: number;
        fontSize: number;
        fontFamily: string;
        width: number;
        height: number;
      }[] = [];

      let currentLine: typeof parsedItems[0] | null = null;
      let lineMinX = 0;
      let lineMaxX = 0;

      for (const item of parsedItems) {
        if (!currentLine) {
          currentLine = { ...item };
          lineMinX = item.x;
          lineMaxX = item.x + item.width;
          continue;
        }

        const sameLine = Math.abs(item.y - currentLine.y) < Math.max(item.fontSize, currentLine.fontSize) * 0.5;
        // Since characters can be visually out-of-order, check overlap or closeness to the overall line bounds
        const gap = Math.max(0, item.x - lineMaxX, lineMinX - (item.x + item.width));
        const closeHorizontally = gap < currentLine.fontSize * 2.0;

        if (sameLine && closeHorizontally) {
          // If there is a noticeable gap to the right, insert a space
          const isToRight = item.x > lineMaxX;
          const needsSpace = isToRight && 
                             (item.x - lineMaxX) > currentLine.fontSize * 0.25 && 
                             !currentLine.str.endsWith(' ') && 
                             !item.str.startsWith(' ');
          
          currentLine.str += (needsSpace ? ' ' : '') + item.str;
          lineMinX = Math.min(lineMinX, item.x);
          lineMaxX = Math.max(lineMaxX, item.x + item.width);
          currentLine.x = lineMinX;
          currentLine.width = lineMaxX - lineMinX;
        } else {
          mergedLines.push({
            str: currentLine.str,
            x: currentLine.x,
            y: currentLine.y,
            fontSize: currentLine.fontSize,
            fontFamily: currentLine.fontFamily,
            width: currentLine.width,
            height: currentLine.height
          });
          currentLine = { ...item };
          lineMinX = item.x;
          lineMaxX = item.x + item.width;
        }
      }
      if (currentLine) {
        mergedLines.push({
          str: currentLine.str,
          x: currentLine.x,
          y: currentLine.y,
          fontSize: currentLine.fontSize,
          fontFamily: currentLine.fontFamily,
          width: currentLine.width,
          height: currentLine.height
        });
      }

      // Convert merged lines to TextNodes
      for (const line of mergedLines) {
        const correctedStr = fixDevanagariOrder(line.str);
        const textNode: TextNode = {
          id: nanoid(),
          name: correctedStr.length > 20 ? correctedStr.substring(0, 20) + '...' : correctedStr,
          type: 'text',
          transform: { a: 1, b: 0, c: 0, d: 1, e: line.x, f: line.y },
          opacity: 1,
          blendMode: 'source-over',
          visible: true,
          locked: false,
          geometry: {
            text: correctedStr,
            fontSize: line.fontSize,
            fontFamily: line.fontFamily
          },
          style: {
            fillColor: '#000000'
          }
        };
        nodes.push(textNode);
      }
    } catch (e) {
      console.error("TextEngine: Error extracting text", e);
    }
    return nodes;
  }
}

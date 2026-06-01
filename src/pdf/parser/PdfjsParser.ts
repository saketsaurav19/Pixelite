import * as pdfjsLib from 'pdfjs-dist';
import type { SceneNode } from '../types/SceneNode';
import { TextEngine } from '../worker/engines/TextEngine';
import { ImageEngine } from '../worker/engines/ImageEngine';
import { VectorEngine } from '../worker/engines/VectorEngine';

export class PdfjsParser {
  private page: pdfjsLib.PDFPageProxy;

  constructor(page: pdfjsLib.PDFPageProxy) {
    this.page = page;
  }

  async parseObjects(): Promise<SceneNode[]> {
    const nodes: SceneNode[] = [];
    const viewport = this.page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    try {
      // 1. Text Engine
      const textNodes = await TextEngine.extractText(this.page, pageHeight);
      nodes.push(...textNodes);

      // 2. Vector & Image Engine Orchestration
      const opList = await this.page.getOperatorList();
      const vectorEngine = new VectorEngine(pageHeight);

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintInlineImageXObject) {
           const imgName = args[0];

           // In pdf.js the transform matrix is applied before the image is drawn.
           // Finding the current transform matrix at this exact operator is complex without a state machine,
           // but we can provide a basic implementation for now.
           let transform = [1,0,0,1,0,0]; // Dummy transform

           const imageNode = await ImageEngine.extractImage(this.page, imgName, transform);
           if (imageNode) nodes.push(imageNode);
        }
        else if (fn === pdfjsLib.OPS.moveTo) {
           vectorEngine.moveTo(args[0], args[1]);
        }
        else if (fn === pdfjsLib.OPS.lineTo) {
           vectorEngine.lineTo(args[0], args[1]);
        }
        else if (fn === pdfjsLib.OPS.curveTo) {
           vectorEngine.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
        }
        else if (fn === pdfjsLib.OPS.closePath) {
           vectorEngine.closePath();
        }
        else if (fn === pdfjsLib.OPS.fill || fn === pdfjsLib.OPS.eoFill) {
           const node = vectorEngine.createPathNode(false, true);
           if (node) nodes.push(node);
        }
        else if (fn === pdfjsLib.OPS.stroke) {
           const node = vectorEngine.createPathNode(true, false);
           if (node) nodes.push(node);
        }
        else if (fn === pdfjsLib.OPS.fillStroke || fn === pdfjsLib.OPS.eoFillStroke) {
           const node = vectorEngine.createPathNode(true, true);
           if (node) nodes.push(node);
        }
      }
    } catch (e) {
      console.error("Error parsing PDF page objects", e);
    }

    return nodes;
  }
}

import * as pdfjsLib from 'pdfjs-dist';
import type { ImageNode } from '../../types/SceneNode';
import { nanoid } from 'nanoid';

export class ImageEngine {
  static async extractImage(
    page: pdfjsLib.PDFPageProxy,
    imgName: string,
    transform: number[]
  ): Promise<ImageNode | null> {
    try {
      const img = await page.objs.get(imgName);
      if (img && img.data) {

        // This is a stub for image extraction. In a real scenario, we would
        // convert img.data (Uint8ClampedArray) to a data URL via OffscreenCanvas

        // Transform contains scaling and translation
        const width = transform ? transform[0] : img.width;
        const height = transform ? transform[3] : img.height;
        const x = transform ? transform[4] : 0;
        const y = transform ? transform[5] : 0;

        return {
          id: nanoid(),
          name: `PDF Image ${imgName}`,
          type: 'image',
          transform: { a: 1, b: 0, c: 0, d: 1, e: x, f: y },
          opacity: 1,
          blendMode: 'source-over',
          visible: true,
          locked: false,
          geometry: {
            dataUrl: '', // Needs OffscreenCanvas implementation for real dataUrl
            width: width,
            height: height
          }
        };
      }
    } catch (e) {
      console.error("ImageEngine: Error extracting image", e);
    }
    return null;
  }
}

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
      const isCommon = imgName.startsWith('g_');
      const objContainer = isCommon ? (page as any).commonObjs : (page as any).objs;

      if (!objContainer) {
        throw new Error(`PDF objects container is not available for ${imgName}`);
      }

      const img = await new Promise<any>((resolve, reject) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            reject(new Error(`Timeout resolving PDF object ${imgName}`));
          }
        }, 10000); // 10 seconds timeout

        try {
          objContainer.get(imgName, (resolvedObj: any) => {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              resolve(resolvedObj);
            }
          });
        } catch (err) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            reject(err);
          }
        }
      });

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

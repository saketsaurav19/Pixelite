import * as pdfjsLib from 'pdfjs-dist';
import type { ImageNode } from '../../types/SceneNode';
import type { GraphicsStateSnapshot } from '../../parser/GraphicsState';
import { nanoid } from 'nanoid';

export class ImageEngine {
  /**
   * Extract a single image object from the PDF page.
   *
   * @param page       PDF.js page proxy (for accessing objs / commonObjs)
   * @param imgName    The image XObject reference key (e.g. "Im0", "g_d0_img1")
   * @param state      Current graphics state snapshot — provides the real CTM
   *                   so we get the correct x, y, width, height of the image.
   * @param pageHeight Native page height for Y-flip from PDF → screen coords
   */
  static async extractImage(
    page: pdfjsLib.PDFPageProxy,
    imgName: any,
    state: GraphicsStateSnapshot | null,
    pageHeight: number
  ): Promise<ImageNode | null> {
    try {
      let img: any;

      if (typeof imgName !== 'string') {
        // Direct image object (inline image or mask)
        img = imgName;
      } else {
        const isCommon = imgName.startsWith('g_');
        const objContainer = isCommon
          ? (page as any).commonObjs
          : (page as any).objs;

        if (!objContainer) {
          throw new Error(`PDF objects container is not available for ${imgName}`);
        }

        img = await new Promise<any>((resolve, reject) => {
          let resolved = false;
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              reject(new Error(`Timeout resolving PDF object ${imgName}`));
            }
          }, 10_000);

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
      }

      if (!img) return null;
      console.log('Resolved image object:', imgName);
      console.log('Constructor:', img?.constructor?.name);
      console.log('Keys:', Object.keys(img || {}));
      console.dir(img);
      if (!img.bitmap && !img.data && !img.src && typeof img !== 'string') {
        console.warn(
          'Unsupported PDF image format',
          imgName,
          img,
          Object.keys(img || {})
        );
        return null;
      }

      // ── Derive position + dimensions from the current CTM ──────────────
      // In PDF, images are drawn in a 1×1 unit square transformed by the CTM.
      // The CTM at the paintImageXObject operator encodes:
      //   [scaleX, shearY, shearX, scaleY, translateX, translateY]
      const ctm = state?.ctm ?? [1, 0, 0, 1, 0, 0];

      // Width = magnitude of the X basis vector (columns 0–1 of ctm)
      const scaleX = Math.sqrt(ctm[0] * ctm[0] + ctm[1] * ctm[1]);
      // Height = magnitude of the Y basis vector (columns 2–3 of ctm)
      const scaleY = Math.sqrt(ctm[2] * ctm[2] + ctm[3] * ctm[3]);
      // Rotation angle from the CTM
      const rotation = Math.atan2(ctm[1], ctm[0]) * (180 / Math.PI);

      // Translation — flip Y from PDF space to screen space
      const x = ctm[4];
      const y = pageHeight - ctm[5] - scaleY;

      // Fall back to intrinsic image dimensions when CTM is identity
      const width = scaleX > 0 ? scaleX : img.width ?? 0;
      const height = scaleY > 0 ? scaleY : img.height ?? 0;

      // ── Encode image pixel data to a data URL ──────────────────────
      // PDF.js may return images in three different formats depending on
      // the pdf.js version and the image type inside the PDF.
      let dataUrl = '';

      // Case 1: ImageBitmap
      if (img.bitmap) {
        try {
          const canvas = document.createElement('canvas');

          const bitmapWidth =
            img.bitmap.displayWidth ??
            img.bitmap.width ??
            img.width;

          const bitmapHeight =
            img.bitmap.displayHeight ??
            img.bitmap.height ??
            img.height;

          canvas.width = bitmapWidth;
          canvas.height = bitmapHeight;

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Failed to create canvas context');
          }

          ctx.drawImage(img.bitmap as any, 0, 0);

          dataUrl = canvas.toDataURL('image/png');

          console.log(
            '[ImageEngine] Converted bitmap',
            img.bitmap.constructor?.name
          );

          // Release VideoFrame memory
          if (typeof (img.bitmap as any).close === 'function') {
            (img.bitmap as any).close();
          }
        } catch (err) {
          console.error(
            '[ImageEngine] Bitmap conversion failed',
            err
          );
        }
      }

      // Case 2: Raw pixel data
      if (!dataUrl && img.data && img.width && img.height) {
        try {
          console.log('=== RASTER DEBUG ===');
          console.log('width:', img.width);
          console.log('height:', img.height);
          console.log('bitmap exists:', !!img.bitmap);
          console.log('data type:', img.data?.constructor?.name);
          console.log('data length:', img.data?.length);

          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');

          if (!ctx) {
            throw new Error('Could not obtain 2D canvas context');
          }

          const numPixels = img.width * img.height;
          const rawData = new Uint8ClampedArray(img.data);

          console.log('expectedGray:', numPixels);
          console.log('expectedGrayAlpha:', numPixels * 2);
          console.log('expectedRGB:', numPixels * 3);
          console.log('expectedRGBA:', numPixels * 4);

          const imageData = ctx.createImageData(img.width, img.height);

          // RGBA
          if (rawData.length === numPixels * 4) {
            imageData.data.set(rawData);
          }

          // RGB
          else if (rawData.length === numPixels * 3) {
            const rgba = new Uint8ClampedArray(numPixels * 4);

            for (let i = 0; i < numPixels; i++) {
              rgba[i * 4] = rawData[i * 3];
              rgba[i * 4 + 1] = rawData[i * 3 + 1];
              rgba[i * 4 + 2] = rawData[i * 3 + 2];
              rgba[i * 4 + 3] = 255;
            }

            imageData.data.set(rgba);
          }

          // Grayscale
          else if (rawData.length === numPixels) {
            const rgba = new Uint8ClampedArray(numPixels * 4);

            for (let i = 0; i < numPixels; i++) {
              const value = rawData[i];

              rgba[i * 4] = value;
              rgba[i * 4 + 1] = value;
              rgba[i * 4 + 2] = value;
              rgba[i * 4 + 3] = 255;
            }

            imageData.data.set(rgba);
          }

          // Grayscale + Alpha
          else if (rawData.length === numPixels * 2) {
            const rgba = new Uint8ClampedArray(numPixels * 4);

            for (let i = 0; i < numPixels; i++) {
              const gray = rawData[i * 2];
              const alpha = rawData[i * 2 + 1];

              rgba[i * 4] = gray;
              rgba[i * 4 + 1] = gray;
              rgba[i * 4 + 2] = gray;
              rgba[i * 4 + 3] = alpha;
            }

            imageData.data.set(rgba);
          }

          else {
            throw new Error(
              `Unsupported pixel format. dataLength=${rawData.length}, pixels=${numPixels}`
            );
          }

          ctx.putImageData(imageData, 0, 0);

          dataUrl = canvas.toDataURL('image/png');

          console.log(
            '[ImageEngine] Raster image converted successfully',
            dataUrl.length
          );

        } catch (err) {
          console.error('[ImageEngine] Raster conversion failed', err);
        }
      }

      // Case 3: data URL string
      if (!dataUrl && typeof img === 'string' && img.startsWith('data:')) {
        dataUrl = img;
      }

      // Case 4: src property
      if (!dataUrl && typeof img.src === 'string') {
        dataUrl = img.src;
      }

      if (!dataUrl) {
        console.error('========== PDF IMAGE DEBUG ==========');
        console.error('imgName:', imgName);
        console.error('type:', typeof img);
        console.error('constructor:', img?.constructor?.name);
        console.error('keys:', Object.keys(img || {}));
        console.dir(img);
        console.error('====================================');

        return null;
      }

      const node: ImageNode = {
        id: nanoid(),
        name: `PDF Image ${imgName}`,
        type: 'image',
        transform: {
          a: Math.cos((rotation * Math.PI) / 180),
          b: Math.sin((rotation * Math.PI) / 180),
          c: -Math.sin((rotation * Math.PI) / 180),
          d: Math.cos((rotation * Math.PI) / 180),
          e: x,
          f: y,
        },
        opacity: state?.fillOpacity ?? 1,
        blendMode: state?.blendMode ?? 'source-over',
        visible: true,
        locked: false,
        geometry: {
          dataUrl,
          width,
          height,
        },
      };

      return node;
    } catch (e) {
      console.error('ImageEngine: Error extracting image', e);
      return null;
    }
  }
}

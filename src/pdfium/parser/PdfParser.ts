import { PDFiumPage } from '@hyzyla/pdfium';
import type { SceneNode, ImageNode } from '../types/SceneNode';
import { nanoid } from 'nanoid';

export class PdfParser {
  private page: PDFiumPage;

  constructor(page: PDFiumPage) {
    this.page = page;
  }

  async parseObjects(): Promise<SceneNode[]> {
    const nodes: SceneNode[] = [];

    // We will render the page as a single image node for simplicity in the first phase
    // since PDFium WASM binding object extraction is limited natively in this wrapper.
    // The architecture is modular so this can be expanded.

    const size = { width: 1000, height: 1000 };
    const rendered = await this.page.render({
      scale: 2, // render at 2x for better quality

    });

    const imageData = new Blob([rendered.data as any], { type: "image/png" });

    // Get the base64 of the image data if we needed to (since this runs in worker, we might need an Object URL or Raw buffer)
    // The image from convertBitmapToImage is a Blob if done in browser, but since it's a web worker, it might be an ImageBitmap or Blob.

    // Create raster image node
    const imageNode: ImageNode = {
      id: nanoid(),
      name: `Page Image`,
      type: 'image',
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: false,
      geometry: {
        dataUrl: URL.createObjectURL(imageData),
        width: size.width,
        height: size.height
      }
    };
    nodes.push(imageNode);

    // NOTE: For full vector extraction in future, we would iterate `this.page.objects()`
    // and map them using `this.page.getObject(i)` if bindings support full geometry.

    return nodes;
  }
}

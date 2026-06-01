import type { PDFiumPage } from '@hyzyla/pdfium';
import type { SceneNode, ImageNode } from '../types/SceneNode';
import { nanoid } from 'nanoid';

type PdfBitmapRenderOptions = {
  data: Uint8Array;
  width: number;
  height: number;
};

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read rendered PDF page image'));
    reader.readAsDataURL(blob);
  });
}

async function renderBitmapToPngDataUrl(options: PdfBitmapRenderOptions): Promise<Uint8Array> {
  const { data, width, height } = options;
  const expectedLength = width * height * 4;

  if (data.length !== expectedLength) {
    throw new Error(`Unexpected PDFium bitmap size: got ${data.length} bytes, expected ${expectedLength}`);
  }

  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('OffscreenCanvas is required to convert PDFium bitmaps in a worker');
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create a canvas context for PDF rendering');
  }

  context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl = await blobToDataUrl(pngBlob);

  return new TextEncoder().encode(dataUrl);
}

export class PdfParser {
  private page: PDFiumPage;

  constructor(page: PDFiumPage) {
    this.page = page;
  }

  async parseObjects(): Promise<SceneNode[]> {
    const nodes: SceneNode[] = [];

    // Render the page as a single raster node. PDFium returns raw bitmap bytes by
    // default, so we provide a render callback that turns those bytes into a PNG
    // data URL before passing the image back to the main thread.
    const rendered = await this.page.render({
      scale: 2,
      render: renderBitmapToPngDataUrl,
    });
    const dataUrl = new TextDecoder().decode(rendered.data);

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
        dataUrl,
        width: rendered.width,
        height: rendered.height
      }
    };
    nodes.push(imageNode);

    // NOTE: For full vector extraction in future, we would iterate `this.page.objects()`
    // and map them using `this.page.getObject(i)` if bindings support full geometry.

    return nodes;
  }
}

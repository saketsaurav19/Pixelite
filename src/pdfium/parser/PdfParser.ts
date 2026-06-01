import type { PDFiumPage } from '@hyzyla/pdfium';
import type { ImageNode, PathNode, PathSegment, Point, SceneNode, TextNode } from '../types/SceneNode';
import { nanoid } from 'nanoid';

type PdfBitmapRenderOptions = {
  data: Uint8Array;
  width: number;
  height: number;
};

type PdfiumObjectLike = {
  type: 'text' | 'path' | 'image' | 'shading' | 'form';
  render?: (options?: { render?: (options: PdfBitmapRenderOptions) => Promise<Uint8Array> }) => Promise<PdfBitmapRenderOptions>;
  module?: PdfiumModuleLike;
  objectIdx?: number;
  pageIdx?: number;
};

type PdfiumModuleLike = {
  HEAPU8: Uint8Array;
  wasmExports: {
    malloc: (size: number) => number;
    free: (ptr: number) => void;
  };
  _FPDFText_LoadPage?: (page: number) => number;
  _FPDFText_ClosePage?: (textPage: number) => void;
  _FPDFTextObj_GetText?: (object: number, textPage: number, buffer: number, length: number) => number;
  _FPDFTextObj_GetFontSize?: (object: number) => number;
  _FPDFPageObj_GetBounds?: (object: number, left: number, bottom: number, right: number, top: number) => number;
  _FPDFPageObj_GetFillColor?: (object: number, r: number, g: number, b: number, a: number) => number;
  _FPDFPageObj_GetStrokeColor?: (object: number, r: number, g: number, b: number, a: number) => number;
  _FPDFPageObj_GetStrokeWidth?: (object: number, width: number) => number;
  _FPDFPath_CountSegments?: (object: number) => number;
  _FPDFPath_GetPathSegment?: (object: number, index: number) => number;
  _FPDFPathSegment_GetPoint?: (segment: number, x: number, y: number) => number;
  _FPDFPathSegment_GetType?: (segment: number) => number;
  _FPDFPathSegment_GetClose?: (segment: number) => number;
};

type PdfObjectBounds = {
  left: number;
  bottom: number;
  right: number;
  top: number;
};

const RENDER_SCALE = 2;
const DEFAULT_TEXT_FONT_SIZE = 16;

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read rendered PDF bitmap image'));
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
    throw new Error('Could not create a canvas context for PDF bitmap rendering');
  }

  context.putImageData(new ImageData(new Uint8ClampedArray(data), width, height), 0, 0);
  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  const dataUrl = await blobToDataUrl(pngBlob);

  return new TextEncoder().encode(dataUrl);
}

function readFloat32(module: PdfiumModuleLike, ptr: number): number {
  return new DataView(module.HEAPU8.buffer, ptr, 4).getFloat32(0, true);
}

function readUint32(module: PdfiumModuleLike, ptr: number): number {
  return new DataView(module.HEAPU8.buffer, ptr, 4).getUint32(0, true);
}

function colorToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

function pdfPointToCanvas(point: Point, pageHeight: number): Point {
  return {
    x: point.x * RENDER_SCALE,
    y: (pageHeight - point.y) * RENDER_SCALE,
  };
}

function pdfBoundsToCanvas(bounds: PdfObjectBounds, pageHeight: number) {
  return {
    x: bounds.left * RENDER_SCALE,
    y: (pageHeight - bounds.top) * RENDER_SCALE,
    width: Math.max(1, (bounds.right - bounds.left) * RENDER_SCALE),
    height: Math.max(1, (bounds.top - bounds.bottom) * RENDER_SCALE),
  };
}

function getObjectBounds(object: PdfiumObjectLike): PdfObjectBounds | null {
  const module = object.module;
  if (!module?._FPDFPageObj_GetBounds || object.objectIdx === undefined) return null;

  const ptr = module.wasmExports.malloc(16);
  if (!ptr) return null;

  try {
    const ok = module._FPDFPageObj_GetBounds(object.objectIdx, ptr, ptr + 4, ptr + 8, ptr + 12);
    if (!ok) return null;

    return {
      left: readFloat32(module, ptr),
      bottom: readFloat32(module, ptr + 4),
      right: readFloat32(module, ptr + 8),
      top: readFloat32(module, ptr + 12),
    };
  } finally {
    module.wasmExports.free(ptr);
  }
}

function getObjectColor(
  object: PdfiumObjectLike,
  getterName: '_FPDFPageObj_GetFillColor' | '_FPDFPageObj_GetStrokeColor'
): string | undefined {
  const module = object.module;
  const getter = module?.[getterName];
  if (!module || !getter || object.objectIdx === undefined) return undefined;

  const ptr = module.wasmExports.malloc(16);
  if (!ptr) return undefined;

  try {
    const ok = getter(object.objectIdx, ptr, ptr + 4, ptr + 8, ptr + 12);
    if (!ok) return undefined;

    const alpha = readUint32(module, ptr + 12);
    if (alpha === 0) return undefined;

    return colorToHex(
      readUint32(module, ptr),
      readUint32(module, ptr + 4),
      readUint32(module, ptr + 8)
    );
  } finally {
    module.wasmExports.free(ptr);
  }
}

function getObjectStrokeWidth(object: PdfiumObjectLike): number | undefined {
  const module = object.module;
  if (!module?._FPDFPageObj_GetStrokeWidth || object.objectIdx === undefined) return undefined;

  const ptr = module.wasmExports.malloc(4);
  if (!ptr) return undefined;

  try {
    const ok = module._FPDFPageObj_GetStrokeWidth(object.objectIdx, ptr);
    return ok ? readFloat32(module, ptr) * RENDER_SCALE : undefined;
  } finally {
    module.wasmExports.free(ptr);
  }
}

function decodePdfUtf16(module: PdfiumModuleLike, ptr: number, length: number): string {
  if (length <= 1) return '';
  const buffer = new Uint8Array(module.HEAPU8.buffer, ptr, (length - 1) * 2);
  return new TextDecoder('utf-16le').decode(buffer).trim();
}

function extractTextObjectText(object: PdfiumObjectLike): string {
  const module = object.module;
  if (!module?._FPDFTextObj_GetText || !module._FPDFText_LoadPage || !module._FPDFText_ClosePage) return '';
  if (object.objectIdx === undefined || object.pageIdx === undefined) return '';

  const textPage = module._FPDFText_LoadPage(object.pageIdx);
  if (!textPage) return '';

  try {
    const length = module._FPDFTextObj_GetText(object.objectIdx, textPage, 0, 0);
    if (length <= 1) return '';

    const ptr = module.wasmExports.malloc(length * 2);
    if (!ptr) return '';

    try {
      const written = module._FPDFTextObj_GetText(object.objectIdx, textPage, ptr, length);
      return decodePdfUtf16(module, ptr, written);
    } finally {
      module.wasmExports.free(ptr);
    }
  } finally {
    module._FPDFText_ClosePage(textPage);
  }
}

function extractPathSegments(object: PdfiumObjectLike, pageHeight: number): PathSegment[] {
  const module = object.module;
  if (!module?._FPDFPath_CountSegments || !module._FPDFPath_GetPathSegment || !module._FPDFPathSegment_GetPoint || !module._FPDFPathSegment_GetType) {
    return [];
  }
  if (object.objectIdx === undefined) return [];

  const segmentCount = module._FPDFPath_CountSegments(object.objectIdx);
  const segments: PathSegment[] = [];
  let index = 0;

  const readPoint = (segment: number): Point | null => {
    const ptr = module.wasmExports.malloc(8);
    if (!ptr) return null;

    try {
      const ok = module._FPDFPathSegment_GetPoint!(segment, ptr, ptr + 4);
      if (!ok) return null;
      return pdfPointToCanvas({ x: readFloat32(module, ptr), y: readFloat32(module, ptr + 4) }, pageHeight);
    } finally {
      module.wasmExports.free(ptr);
    }
  };

  while (index < segmentCount) {
    const segment = module._FPDFPath_GetPathSegment(object.objectIdx, index);
    if (!segment) {
      index += 1;
      continue;
    }

    const type = module._FPDFPathSegment_GetType(segment);
    const point = readPoint(segment);
    if (!point) {
      index += 1;
      continue;
    }

    if (type === 2) {
      segments.push({ type: 'moveTo', points: [point] });
      index += 1;
    } else if (type === 0) {
      segments.push({ type: 'lineTo', points: [point] });
      index += 1;
    } else if (type === 1 && index + 2 < segmentCount) {
      const control2Segment = module._FPDFPath_GetPathSegment(object.objectIdx, index + 1);
      const endSegment = module._FPDFPath_GetPathSegment(object.objectIdx, index + 2);
      const control2 = control2Segment ? readPoint(control2Segment) : null;
      const end = endSegment ? readPoint(endSegment) : null;
      if (control2 && end) {
        segments.push({ type: 'bezierCurveTo', points: [point, control2, end] });
        index += 3;
      } else {
        index += 1;
      }
    } else {
      index += 1;
    }

    if (module._FPDFPathSegment_GetClose?.(segment)) {
      segments.push({ type: 'closePath', points: [] });
    }
  }

  return segments;
}

function boundsToRectangleSegments(bounds: PdfObjectBounds, pageHeight: number): PathSegment[] {
  const topLeft = pdfPointToCanvas({ x: bounds.left, y: bounds.top }, pageHeight);
  const topRight = pdfPointToCanvas({ x: bounds.right, y: bounds.top }, pageHeight);
  const bottomRight = pdfPointToCanvas({ x: bounds.right, y: bounds.bottom }, pageHeight);
  const bottomLeft = pdfPointToCanvas({ x: bounds.left, y: bounds.bottom }, pageHeight);

  return [
    { type: 'moveTo', points: [topLeft] },
    { type: 'lineTo', points: [topRight] },
    { type: 'lineTo', points: [bottomRight] },
    { type: 'lineTo', points: [bottomLeft] },
    { type: 'closePath', points: [] },
  ];
}

export class PdfParser {
  private page: PDFiumPage;

  constructor(page: PDFiumPage) {
    this.page = page;
  }

  async parseObjects(): Promise<SceneNode[]> {
    const nodes: SceneNode[] = [];
    const { originalHeight } = this.page.getOriginalSize();
    let extractedText = false;

    for (const object of this.iterPageObjects()) {
      if (object.type === 'text') {
        const textNode = this.parseTextObject(object, originalHeight);
        if (textNode) {
          nodes.push(textNode);
          extractedText = true;
        }
      } else if (object.type === 'path') {
        const pathNode = this.parsePathObject(object, originalHeight);
        if (pathNode) nodes.push(pathNode);
      } else if (object.type === 'image') {
        const imageNode = await this.parseImageObject(object, originalHeight);
        if (imageNode) nodes.push(imageNode);
      }
    }

    if (!extractedText) {
      const fallbackTextNode = this.parsePageTextFallback();
      if (fallbackTextNode) nodes.unshift(fallbackTextNode);
    }

    return nodes;
  }

  private iterPageObjects(): PdfiumObjectLike[] {
    const page = this.page as unknown as { objects?: () => Iterable<PdfiumObjectLike> };
    if (!page.objects) return [];
    return Array.from(page.objects());
  }

  private parseTextObject(object: PdfiumObjectLike, pageHeight: number): TextNode | null {
    const text = extractTextObjectText(object);
    if (!text) return null;

    const bounds = getObjectBounds(object);
    const position = bounds ? pdfBoundsToCanvas(bounds, pageHeight) : { x: 0, y: 0 };
    const fontSize = object.module?._FPDFTextObj_GetFontSize?.(object.objectIdx ?? 0) ?? DEFAULT_TEXT_FONT_SIZE;

    return {
      id: nanoid(),
      name: 'PDF Text',
      type: 'text',
      transform: { a: 1, b: 0, c: 0, d: 1, e: position.x, f: position.y },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: false,
      geometry: {
        text,
        fontSize: fontSize * RENDER_SCALE,
        fontFamily: 'Arial'
      },
      style: {
        fillColor: getObjectColor(object, '_FPDFPageObj_GetFillColor') || '#000000'
      }
    };
  }

  private parsePathObject(object: PdfiumObjectLike, pageHeight: number): PathNode | null {
    const bounds = getObjectBounds(object);
    const segments = extractPathSegments(object, pageHeight);
    const fallbackSegments = !segments.length && bounds ? boundsToRectangleSegments(bounds, pageHeight) : [];
    const pathSegments = segments.length ? segments : fallbackSegments;
    if (!pathSegments.length) return null;

    return {
      id: nanoid(),
      name: 'PDF Vector Path',
      type: 'path',
      transform: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: true,
      geometry: {
        segments: pathSegments,
        isClosed: pathSegments.some((segment) => segment.type === 'closePath')
      },
      style: {
        fillColor: getObjectColor(object, '_FPDFPageObj_GetFillColor') || 'transparent',
        strokeColor: getObjectColor(object, '_FPDFPageObj_GetStrokeColor') || 'transparent',
        strokeWidth: getObjectStrokeWidth(object) || 0,
      }
    };
  }

  private async parseImageObject(object: PdfiumObjectLike, pageHeight: number): Promise<ImageNode | null> {
    if (!object.render) return null;

    const rendered = await object.render({ render: renderBitmapToPngDataUrl });
    const dataUrl = new TextDecoder().decode(rendered.data);
    const bounds = getObjectBounds(object);
    const position = bounds ? pdfBoundsToCanvas(bounds, pageHeight) : { x: 0, y: 0, width: rendered.width, height: rendered.height };

    return {
      id: nanoid(),
      name: 'PDF Bitmap Image',
      type: 'image',
      transform: { a: 1, b: 0, c: 0, d: 1, e: position.x, f: position.y },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: false,
      geometry: {
        dataUrl,
        width: position.width,
        height: position.height
      }
    };
  }

  private parsePageTextFallback(): TextNode | null {
    const text = this.page.getText().trim();
    if (!text) return null;

    return {
      id: nanoid(),
      name: 'PDF Text',
      type: 'text',
      transform: { a: 1, b: 0, c: 0, d: 1, e: 8, f: 8 },
      opacity: 1,
      blendMode: 'source-over',
      visible: true,
      locked: false,
      geometry: {
        text,
        fontSize: DEFAULT_TEXT_FONT_SIZE,
        fontFamily: 'Arial'
      },
      style: {
        fillColor: '#000000'
      }
    };
  }
}

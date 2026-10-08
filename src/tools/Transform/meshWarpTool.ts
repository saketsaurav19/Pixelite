import type { ToolModule } from '../types';
import { toolState } from '../toolState';

/* ------------------------------------------------------------------ */
/*  State keys (kept on toolState)                                    */
/* ------------------------------------------------------------------ */

type Mode = 'layout' | 'warp';

export function mwGetMode(): Mode {
  return ((toolState as any)._mwMode || 'layout') as Mode;
}
export function mwSetMode(m: Mode) {
  (toolState as any)._mwMode = m;
}

export function mwGetMesh(): { x: number; y: number }[] | null {
  return (toolState as any)._mwMesh || null;
}
export function mwSetMesh(m: { x: number; y: number }[] | null) {
  (toolState as any)._mwMesh = m ? m.map(p => ({ ...p })) : null;
}

export function mwGetDrag(): { cornerIdx: number; startCoords: { x: number; y: number }; startPoints: { x: number; y: number }[] } | null {
  return (toolState as any)._mwDrag || null;
}
export function mwSetDrag(d: { cornerIdx: number; startCoords: { x: number; y: number }; startPoints: { x: number; y: number }[] } | null) {
  (toolState as any)._mwDrag = d;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ------------------------------------------------------------------ */
/*  Warp math (tri-subdivide affine)                                   */
/* ------------------------------------------------------------------ */

function drawTriangleWarp(
  ctx: CanvasRenderingContext2D,
  img: HTMLCanvasElement | HTMLImageElement,
  s0: { x: number; y: number },
  s1: { x: number; y: number },
  s2: { x: number; y: number },
  d0: { x: number; y: number },
  d1: { x: number; y: number },
  d2: { x: number; y: number }
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  const delta = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
  if (Math.abs(delta) < 0.0001) { ctx.restore(); return; }

  const a = ((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / delta;
  const c = ((s0.x - s2.x) * (d1.x - d2.x) - (s1.x - s2.x) * (d0.x - d2.x)) / delta;
  const e = d2.x - a * s2.x - c * s2.y;
  const b = ((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / delta;
  const d = ((s0.x - s2.x) * (d1.y - d2.y) - (s1.x - s2.x) * (d0.y - d2.y)) / delta;
  const f = d2.y - b * s2.x - d * s2.y;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function warpCanvasWithGridQuad(
  srcImg: HTMLCanvasElement | HTMLImageElement,
  dstCorners: { x: number; y: number }[],
  outW: number,
  outH: number,
  srcCorners: { x: number; y: number }[]
): HTMLCanvasElement {
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW;
  dstCanvas.height = outH;
  const ctx = dstCanvas.getContext('2d')!;

  // Triangle 1: TL, TR, BL  (0, 1, 3)
  drawTriangleWarp(ctx, srcImg,
    srcCorners[0], srcCorners[1], srcCorners[3],
    dstCorners[0], dstCorners[1], dstCorners[3]
  );

  // Triangle 2: TR, BR, BL  (1, 2, 3)
  drawTriangleWarp(ctx, srcImg,
    srcCorners[1], srcCorners[2], srcCorners[3],
    dstCorners[1], dstCorners[2], dstCorners[3]
  );

  return dstCanvas;
}

/* ------------------------------------------------------------------ */
/*  Tool Module                                                       */
/* ------------------------------------------------------------------ */

export const meshWarpTool: ToolModule = {
  id: 'mesh_warp',

  start: ({ activeLayerId, layers, setIsInteracting, documentSize }) => {
    setIsInteracting(true);
    const layer = layers.find((l: any) => l.id === activeLayerId);
    if (!layer) return;

    // Capture the original layer raster for baking
    const source = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement | null;
    if (source) {
      const copy = document.createElement('canvas');
      copy.width = source.width;
      copy.height = source.height;
      copy.getContext('2d')?.drawImage(source, 0, 0);
      toolState._mwOriginalCanvas = copy;
    }

    // Initialize 4-corner square in layer-local coordinates
    const w = layer.width || documentSize.w;
    const h = layer.height || documentSize.h;
    mwSetMesh([
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: h },
      { x: 0, y: h },
    ]);
    mwSetMode('layout');
    mwSetDrag(null);
  },

  move: ({ coords, lastPoint }) => {
    const drag = mwGetDrag();
    if (!drag) return;
    if (!lastPoint) return;

    const dx = coords.x - lastPoint.x;
    const dy = coords.y - lastPoint.y;
    const mesh = mwGetMesh();
    if (!mesh) return;

    const newMesh = mesh.map((p, i) => (i === drag.cornerIdx ? { x: p.x + dx, y: p.y + dy } : { ...p }));
    mwSetMesh(newMesh);
  },

  end: () => {
    mwSetDrag(null);
  },
};

/* ------------------------------------------------------------------ */
/*  Corner drag helpers (called by the overlay)                        */
/* ------------------------------------------------------------------ */

export function mwStartCornerDrag(cornerIdx: number, startCoords: { x: number; y: number }) {
  const mesh = mwGetMesh();
  if (!mesh) return;
  mwSetDrag({
    cornerIdx,
    startCoords: { ...startCoords },
    startPoints: mesh.map(p => ({ ...p })),
  });
}

export function mwClearMesh() {
  mwSetMesh(null);
  mwSetDrag(null);
  mwSetMode('layout');
  delete toolState._mwOriginalCanvas;
}

export async function mwBakeWarp(
  layerId: string,
  layers: any[],
  documentSize: { w: number; h: number },
  updateLayer: (id: string, updates: any) => void,
  recordHistory: (name: string) => void
) {
  const mesh = mwGetMesh();
  if (!mesh || mesh.length < 4) return;

  const layer = layers.find((l: any) => l.id === layerId);
  if (!layer || !layer.dataUrl) return;

  const srcImg = await loadImage(layer.dataUrl);
  const srcW = layer.width || documentSize.w;
  const srcH = layer.height || documentSize.h;

  // Source corners: original image pixel bounds
  const srcCorners: { x: number; y: number }[] = [
    { x: 0, y: 0 },
    { x: srcW, y: 0 },
    { x: srcW, y: srcH },
    { x: 0, y: srcH },
  ];

  // Destination grid: current mesh positions (layer-local)
  const dstGrid = mesh;

  // Compute output bounds
  const xMin = Math.min(...dstGrid.map(p => p.x));
  const yMin = Math.min(...dstGrid.map(p => p.y));
  const xMax = Math.max(...dstGrid.map(p => p.x));
  const yMax = Math.max(...dstGrid.map(p => p.y));
  const outW = Math.max(1, Math.round(xMax - xMin));
  const outH = Math.max(1, Math.round(yMax - yMin));

  // Shift destination grid to origin-relative for the output canvas
  const shiftedDst = dstGrid.map(p => ({ x: p.x - xMin, y: p.y - yMin }));

  // Warp using triangle subdivision
  const warped = warpCanvasWithGridQuad(srcImg, shiftedDst, outW, outH, srcCorners);

  const layerX = layer.position?.x || 0;
  const layerY = layer.position?.y || 0;

  updateLayer(layerId, {
    dataUrl: warped.toDataURL(),
    position: { x: layerX + xMin, y: layerY + yMin },
    width: outW,
    height: outH,
    rotation: 0,
  });
  recordHistory('Mesh Warp');
  mwClearMesh();
}

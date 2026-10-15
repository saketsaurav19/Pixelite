import type { LastFilterSelection } from '../store/types';

/**
 * Blend modes offered by Edit > Fade, expressed as canvas composite operations
 * so the browser's native compositor reproduces Photoshop's fade math:
 * out = before * (1 - opacity) + blend(before, after) * opacity.
 */
export const FADE_MODES: { label: string; value: GlobalCompositeOperation }[] = [
  { label: 'Normal', value: 'source-over' },
  { label: 'Multiply', value: 'multiply' },
  { label: 'Screen', value: 'screen' },
  { label: 'Overlay', value: 'overlay' },
  { label: 'Soft Light', value: 'soft-light' },
  { label: 'Hard Light', value: 'hard-light' },
  { label: 'Color Dodge', value: 'color-dodge' },
  { label: 'Color Burn', value: 'color-burn' },
  { label: 'Darken', value: 'darken' },
  { label: 'Lighten', value: 'lighten' },
  { label: 'Difference', value: 'difference' },
  { label: 'Exclusion', value: 'exclusion' },
  { label: 'Hue', value: 'hue' },
  { label: 'Saturation', value: 'saturation' },
  { label: 'Color', value: 'color' },
  { label: 'Luminosity', value: 'luminosity' },
];

/**
 * Rebuild the selection clip that was active when a filter ran. Call between
 * ctx.save() and ctx.restore(); returns false when there was no selection
 * (nothing clipped).
 */
export function traceFilterSelection(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sel: LastFilterSelection,
  offX: number,
  offY: number
): boolean {
  const hasRect = !!sel.selectionRect;
  const hasLasso = !!sel.lassoPaths && sel.lassoPaths.length > 0;
  if (!hasRect && !hasLasso) return false;
  ctx.beginPath();
  if (sel.isInverseSelection) ctx.rect(0, 0, w, h);
  if (hasRect) {
    const r = sel.selectionRect!;
    ctx.rect(r.x - offX, r.y - offY, r.w, r.h);
    ctx.clip(sel.isInverseSelection ? 'evenodd' : 'nonzero');
  } else {
    for (const path of sel.lassoPaths!) {
      if (path.length < 3) continue;
      ctx.moveTo(path[0].x - offX, path[0].y - offY);
      for (const p of path) ctx.lineTo(p.x - offX, p.y - offY);
      ctx.closePath();
    }
    ctx.clip('evenodd');
  }
  return true;
}

/**
 * Composite the faded result of a filter at the given opacity (0..1) and blend
 * mode. `before` is the pre-filter canvas, `after` the full filter output.
 */
export function compositeFade(
  before: ImageData,
  after: ImageData,
  opacity: number,
  mode: GlobalCompositeOperation
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = before.width;
  out.height = before.height;
  const ctx = out.getContext('2d')!;
  ctx.putImageData(before, 0, 0);
  const afterCanvas = document.createElement('canvas');
  afterCanvas.width = after.width;
  afterCanvas.height = after.height;
  afterCanvas.getContext('2d')!.putImageData(after, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = mode;
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(afterCanvas, 0, 0);
  ctx.restore();
  return out;
}

/** Paint an ImageData onto a canvas element via an offscreen canvas. */
export function paintImageData(canvas: HTMLCanvasElement, imageData: ImageData): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const tmp = document.createElement('canvas');
  tmp.width = imageData.width;
  tmp.height = imageData.height;
  tmp.getContext('2d')!.putImageData(imageData, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tmp, 0, 0);
}

/**
 * Paint a fade result onto a layer canvas: `before` pixels everywhere, then
 * the faded composite clipped to the stored filter selection.
 */
export function paintFadeResult(
  canvas: HTMLCanvasElement,
  before: ImageData,
  faded: HTMLCanvasElement,
  selection: LastFilterSelection,
  offX: number,
  offY: number
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const beforeCanvas = document.createElement('canvas');
  beforeCanvas.width = before.width;
  beforeCanvas.height = before.height;
  beforeCanvas.getContext('2d')!.putImageData(before, 0, 0);
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(beforeCanvas, 0, 0);
  traceFilterSelection(ctx, canvas.width, canvas.height, selection, offX, offY);
  ctx.drawImage(faded, 0, 0);
  ctx.restore();
}

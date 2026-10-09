import type { ToolModule } from '../types';
import { useStore } from '../../store/useStore';

/**
 * Zoom Tool (Z).
 *
 * Photoshop-style click zoom:
 *  - Click      -> zoom in, centered on the clicked point
 *  - Alt+Click  -> zoom out, centered on the clicked point
 *
 * The clicked document point stays under the cursor by shifting
 * canvasOffset to compensate for the zoom change. The canvas stack is
 * rendered with `scale(z) translate(ox, oy)` around a center
 * transform-origin, so for a clicked document point p with center
 * c = (w/2, h/2):
 *
 *   offset' = (z / z') * (p - c + offset) - (p - c)
 *
 * Rotation cancels out of the equation, so this holds even when the
 * canvas is rotated.
 */
const MIN_ZOOM = 0.01;
const MAX_ZOOM = 32;
const ZOOM_STEP = 1.5;

export const zoomTool: ToolModule = {
  id: 'zoom_tool',
  start: ({ coords, isAlt }) => {
    const store = useStore.getState();
    const { zoom, canvasOffset, documentSize } = store;

    const zoomingOut = !!isAlt;
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, zoomingOut ? zoom / ZOOM_STEP : zoom * ZOOM_STEP)
    );
    if (nextZoom === zoom) return;

    const c = { x: documentSize.w / 2, y: documentSize.h / 2 };
    const ratio = zoom / nextZoom;
    const vx = coords.x - c.x + canvasOffset.x;
    const vy = coords.y - c.y + canvasOffset.y;

    store.setCanvasOffset({
      x: ratio * vx - (coords.x - c.x),
      y: ratio * vy - (coords.y - c.y),
    });
    store.setZoom(nextZoom);
  },
};

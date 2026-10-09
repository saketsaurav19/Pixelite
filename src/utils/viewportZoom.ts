/**
 * Viewport-aware zoom helpers.
 *
 * The canvas zoom used to assume a desktop layout (hardcoded chrome offsets
 * and a fixed 0.5 initial zoom), which broke the mobile view: a new document
 * would render far wider than a phone screen. These helpers measure the real
 * `.canvas-viewport` element so "fit to screen" works on any layout.
 */

/** CSS breakpoint (max-width: 48rem) at which the mobile layout kicks in. */
const MOBILE_BREAKPOINT_PX = 768;

/** Fraction of the viewport the fitted document should occupy (margin). */
const FIT_PADDING = 0.94;

export interface ViewportSize {
  w: number;
  h: number;
}

/**
 * Measures the visible canvas viewport. Falls back to the window size minus
 * the surrounding chrome (mobile-aware) when the element isn't mounted yet,
 * e.g. creating a document from the welcome screen.
 */
export function getCanvasViewportSize(): ViewportSize {
  if (typeof document !== 'undefined') {
    const el = document.querySelector('.canvas-viewport');
    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        return { w: rect.width, h: rect.height };
      }
    }
  }
  if (typeof window !== 'undefined') {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT_PX;
    // Desktop chrome: sidebar 240 + toolbar 44 + margins 60 (x);
    // header 38 + options 32 + tabbar 24 + statusbar 40 (y).
    // Mobile chrome: header 50 (3.125rem) + options 44 (2.75rem) + tabbar 36 (2.25rem).
    const chromeX = isMobile ? 0 : 240 + 44 + 60;
    const chromeY = isMobile ? 50 + 44 + 36 : 38 + 32 + 24 + 40;
    return {
      w: Math.max(1, window.innerWidth - chromeX),
      h: Math.max(1, window.innerHeight - chromeY),
    };
  }
  return { w: 800, h: 600 };
}

/**
 * Zoom level that fits a document of the given size inside the canvas
 * viewport, clamped to the app's supported zoom range.
 */
export function computeFitZoom(docW: number, docH: number): number {
  if (!docW || !docH) return 0.5;
  const vp = getCanvasViewportSize();
  const zoom = Math.min((vp.w * FIT_PADDING) / docW, (vp.h * FIT_PADDING) / docH);
  return Math.min(32, Math.max(0.01, zoom));
}

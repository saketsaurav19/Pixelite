import { useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface MenuPosition {
  x: number;
  y: number;
}

interface AnchoredPosition {
  /** Ref to attach to the menu element so it can be measured. */
  ref: RefObject<HTMLDivElement | null>;
  /** Adjusted position that keeps the menu fully on-screen. */
  position: MenuPosition;
  /** False until the menu has been measured — keep it hidden to avoid a flash at the raw position. */
  ready: boolean;
}

/**
 * Keeps a context menu fully on-screen: if it would overflow the bottom edge
 * it opens upward instead, and if it would overflow the right edge it shifts
 * left. Measurement happens in `useLayoutEffect` (before paint), so there is
 * no visible jump.
 */
export function useAnchoredMenuPosition(requested: MenuPosition): AnchoredPosition {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<MenuPosition>(requested);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const margin = 8;
    let { x, y } = requested;
    // Flip upward when the menu would run off the bottom of the viewport.
    if (y + height > window.innerHeight - margin) {
      y = Math.max(margin, y - height);
    }
    // Shift left when the menu would run off the right edge.
    if (x + width > window.innerWidth - margin) {
      x = Math.max(margin, window.innerWidth - width - margin);
    }
    setPosition({ x, y });
    setReady(true);
  }, [requested]);

  return { ref, position, ready };
}

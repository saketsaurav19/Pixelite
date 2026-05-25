import type { CanvasRefs } from '../types';
import type { Layer } from '../../../store/useStore';

export const colorDistance = (data: Uint8ClampedArray, idx: number, r: number, g: number, b: number, a: number): number => {
  return Math.abs(data[idx] - r) + Math.abs(data[idx + 1] - g) + Math.abs(data[idx + 2] - b) + Math.abs(data[idx + 3] - a);
};

export const handleEyedropper = (
  x: number,
  y: number,
  activeLayerId: string | null,
  layers: Layer[],
  canvasRefs: CanvasRefs,
  setBrushColor: (color: string) => void
) => {
  const id = activeLayerId || layers[0]?.id;
  const canvas = canvasRefs.current[id];
  const ctx = canvas?.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const layer = layers.find(l => l.id === id);
  const lx = x - (layer?.position.x || 0);
  const ly = y - (layer?.position.y || 0);

  const pixel = ctx.getImageData(lx, ly, 1, 1).data;
  const hex = `#${((1 << 24) + (pixel[0] << 16) + (pixel[1] << 8) + pixel[2]).toString(16).slice(1)}`;
  setBrushColor(hex);
};

export const hexToRgba = (hex: string, alpha: number): string => {
  let cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

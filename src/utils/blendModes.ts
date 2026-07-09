import type { BlendMode } from '../store/types';

export const mapBlendModeToCanvas = (mode: BlendMode | undefined | null): GlobalCompositeOperation => {
  if (!mode || mode === 'pass through') {
    return 'source-over';
  }
  switch (mode) {
    case 'dissolve':
      return 'source-over';
    case 'linear-burn':
      return 'color-burn';
    case 'darker-color':
      return 'darken';
    case 'linear-dodge':
      return 'plus-lighter' as GlobalCompositeOperation;
    case 'lighter-color':
      return 'lighten';
    case 'vivid-light':
      return 'hard-light';
    case 'linear-light':
      return 'hard-light';
    case 'pin-light':
      return 'soft-light';
    case 'hard-mix':
      return 'overlay';
    case 'subtract':
      return 'difference';
    case 'divide':
      return 'color-dodge';
    default:
      // If it is a standard canvas composition mode, return it
      return mode as GlobalCompositeOperation;
  }
};

export const mapBlendModeToCss = (mode: BlendMode | undefined | null): string => {
  const canvasMode = mapBlendModeToCanvas(mode);
  if (canvasMode === 'source-over') {
    return 'normal';
  }
  return canvasMode;
};

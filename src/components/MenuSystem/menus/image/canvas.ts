import type { MenuItem } from '../types';

export const imageCanvasMenu: MenuItem[] = [
  { divider: true },
  { label: 'Image Size...', action: (store) => store.setIsImageSizeDialogOpen(true) },
  { label: 'Canvas Size...', action: (store) => store.setIsCanvasSizeDialogOpen(true) },
  { label: 'Image Rotation', submenu: [
    { label: '180°', action: (s) => s.setCanvasRotation?.(180) },
    { label: '90° CW', action: (s) => s.setCanvasRotation?.(90) },
    { label: '90° CCW', action: (s) => s.setCanvasRotation?.(-90) },
    { label: 'Flip Canvas Horizontal', action: (s) => s.flipCanvas?.('horizontal') },
    { label: 'Flip Canvas Vertical', action: (s) => s.flipCanvas?.('vertical') },
  ] },
  { label: 'Trim...', action: (s) => s.trimCanvas?.() },
];

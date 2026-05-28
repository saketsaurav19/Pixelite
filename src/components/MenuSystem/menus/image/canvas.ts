import type { MenuItem } from '../types';

export const imageCanvasMenu: MenuItem[] = [
  { divider: true },
  { label: 'Image Size...', action: (_s) => console.log('Image Size dialog') },
  { label: 'Canvas Size...', action: (_s) => console.log('Canvas Size dialog') },
  { label: 'Image Rotation', submenu: [
    { label: '180°', action: (s) => s.setCanvasRotation?.(180) },
    { label: '90° CW', action: (s) => s.setCanvasRotation?.(90) },
    { label: '90° CCW', action: (s) => s.setCanvasRotation?.(-90) },
    { label: 'Flip Canvas Horizontal', action: (_s) => console.log('Flip Horizontal') },
    { label: 'Flip Canvas Vertical', action: (_s) => console.log('Flip Vertical') },
  ] },
  { label: 'Trim...', action: (_s) => console.log('Trim dialog') },
];

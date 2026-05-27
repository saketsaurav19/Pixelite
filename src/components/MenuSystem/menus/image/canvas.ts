import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const imageCanvasMenu: MenuItem[] = [
  { divider: true },
  { label: 'Image Size...', action: placeholder() },
  { label: 'Canvas Size...', action: placeholder() },
  { label: 'Image Rotation', submenu: [
    { label: '180°', action: placeholder() },
    { label: '90° CW', action: placeholder() },
    { label: '90° CCW', action: placeholder() },
    { label: 'Flip Canvas Horizontal', action: placeholder() },
    { label: 'Flip Canvas Vertical', action: placeholder() },
  ] },
  { label: 'Trim...', action: placeholder() },
];

import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const imageModeMenu: MenuItem[] = [
  { label: 'Mode', submenu: [
    { label: 'RGB Color', action: placeholder() },
    { label: 'CMYK Color', action: placeholder() },
    { label: 'Grayscale', action: placeholder() },
    { label: 'Indexed Color', action: placeholder() },
  ] },
];

import type { MenuItem } from '../types';

export const imageModeMenu: MenuItem[] = [
  { label: 'Mode', submenu: [
    { label: 'RGB Color', action: (_s) => console.log('Set RGB Mode') },
    { label: 'CMYK Color', action: (_s) => console.log('Set CMYK Mode') },
    { label: 'Grayscale', action: (_s) => console.log('Set Grayscale Mode') },
    { label: 'Indexed Color', action: (_s) => console.log('Set Indexed Mode') },
  ] },
];

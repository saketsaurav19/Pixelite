import type { MenuItem } from '../types';

export const imageModeMenu: MenuItem[] = [
  { label: 'Mode', submenu: [
    { label: 'RGB Color', action: (s) => console.log('Set RGB Mode') },
    { label: 'CMYK Color', action: (s) => console.log('Set CMYK Mode') },
    { label: 'Grayscale', action: (s) => console.log('Set Grayscale Mode') },
    { label: 'Indexed Color', action: (s) => console.log('Set Indexed Mode') },
  ] },
];

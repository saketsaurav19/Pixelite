import type { MenuItem } from '../types';

export const imageAdjustmentMenu: MenuItem[] = [
  { label: 'Adjustments', submenu: [
    { label: 'Brightness/Contrast', action: (s) => console.log('Brightness/Contrast dialog') },
    { label: 'Levels', action: (s) => console.log('Levels dialog') },
    { label: 'Curves', action: (s) => console.log('Curves dialog') },
    { label: 'Hue/Saturation', action: (s) => console.log('Hue/Saturation dialog') },
    { label: 'Black & White', action: (s) => console.log('Apply Black & White') },
    { label: 'Color Balance', action: (s) => console.log('Color Balance dialog') },
  ] },
  { label: 'Auto Tone', action: (s) => console.log('Apply Auto Tone') },
  { label: 'Auto Contrast', action: (s) => console.log('Apply Auto Contrast') },
  { label: 'Auto Color', action: (s) => console.log('Apply Auto Color') },
];

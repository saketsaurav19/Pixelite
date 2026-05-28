import type { MenuItem } from '../types';

export const imageAdjustmentMenu: MenuItem[] = [
  { label: 'Adjustments', submenu: [
    { label: 'Brightness/Contrast', action: (_s) => console.log('Brightness/Contrast dialog') },
    { label: 'Levels', action: (_s) => console.log('Levels dialog') },
    { label: 'Curves', action: (_s) => console.log('Curves dialog') },
    { label: 'Hue/Saturation', action: (_s) => console.log('Hue/Saturation dialog') },
    { label: 'Black & White', action: (_s) => console.log('Apply Black & White') },
    { label: 'Color Balance', action: (_s) => console.log('Color Balance dialog') },
  ] },
  { label: 'Auto Tone', action: (_s) => console.log('Apply Auto Tone') },
  { label: 'Auto Contrast', action: (_s) => console.log('Apply Auto Contrast') },
  { label: 'Auto Color', action: (_s) => console.log('Apply Auto Color') },
];

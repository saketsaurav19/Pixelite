import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const imageAdjustmentMenu: MenuItem[] = [
  { label: 'Adjustments', submenu: [
    { label: 'Brightness/Contrast', action: placeholder() },
    { label: 'Levels', action: placeholder() },
    { label: 'Curves', action: placeholder() },
    { label: 'Hue/Saturation', action: placeholder() },
    { label: 'Black & White', action: placeholder() },
    { label: 'Color Balance', action: placeholder() },
  ] },
  { label: 'Auto Tone', action: placeholder() },
  { label: 'Auto Contrast', action: placeholder() },
  { label: 'Auto Color', action: placeholder() },
];

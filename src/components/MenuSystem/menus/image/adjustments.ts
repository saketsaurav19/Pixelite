import type { MenuItem } from '../types';

export const imageAdjustmentMenu: MenuItem[] = [
  { label: 'Adjustments', submenu: [
    { label: 'Brightness/Contrast', action: (store) => store.setActiveAdjustmentModal('brightness_contrast') },
    { label: 'Levels', action: (_s) => console.log('Levels dialog') },
    { label: 'Curves', action: (_s) => console.log('Curves dialog') },
    { label: 'Hue/Saturation', action: (store) => store.setActiveAdjustmentModal('hue_saturation') },
    { label: 'Black & White', action: (store) => store.setActiveAdjustmentModal('black_white') },
    { label: 'Photo Effects', action: (store) => store.setActiveAdjustmentModal('photo_effects') },
    { label: 'Color Balance', action: (_s) => console.log('Color Balance dialog') },
  ] },
  { label: 'Auto Tone', action: (_s) => console.log('Apply Auto Tone') },
  { label: 'Auto Contrast', action: (_s) => console.log('Apply Auto Contrast') },
  { label: 'Auto Color', action: (_s) => console.log('Apply Auto Color') },
];

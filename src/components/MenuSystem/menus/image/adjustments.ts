import type { MenuItem } from '../types';

export const imageAdjustmentMenu: MenuItem[] = [
  { label: 'Adjustments', submenu: [
    { label: 'Brightness/Contrast', action: (store) => store.addAdjustmentLayer('brightness_contrast') },
    { label: 'Levels', action: (store) => store.addAdjustmentLayer('levels') },
    { label: 'Curves', action: (store) => store.addAdjustmentLayer('curves') },
    { label: 'Exposure', action: (store) => store.addAdjustmentLayer('exposure') },
    { label: 'Vibrance', action: (store) => store.addAdjustmentLayer('vibrance') },
    { label: 'Hue/Saturation', action: (store) => store.addAdjustmentLayer('hue_saturation') },
    { label: 'Black & White', action: (store) => store.addAdjustmentLayer('black_white') },
    { label: 'Photo Effects', action: (store) => store.addAdjustmentLayer('photo_effects') },
    { label: 'Color Balance', action: (store) => store.addAdjustmentLayer('color_balance') },
  ] },
  { label: 'Auto Tone', action: (_s) => console.log('Apply Auto Tone') },
  { label: 'Auto Contrast', action: (_s) => console.log('Apply Auto Contrast') },
  { label: 'Auto Color', action: (_s) => console.log('Apply Auto Color') },
];

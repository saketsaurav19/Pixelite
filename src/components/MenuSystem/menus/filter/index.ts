import type { MenuItem } from '../types';

export const filterMenu: MenuItem[] = [
  { label: 'Filter Gallery...', action: (s) => s.applyFilterAction?.('filter_gallery') },
  { label: 'Camera Raw Filter...', action: (s) => s.applyFilterAction?.('camera_raw') },
  { divider: true },
  { label: 'Blur', submenu: [
    { label: 'Average', action: (s) => s.applyFilterAction?.('average') },
    { label: 'Blur', action: (s) => s.applyFilterAction?.('blur') },
    { label: 'Gaussian Blur...', action: (s) => s.applyFilterAction?.('gaussian_blur') },
    { label: 'Motion Blur...', action: (s) => s.applyFilterAction?.('motion_blur') }
  ] },
  { label: 'Distort', submenu: [
    { label: 'Displace...', action: (s) => s.applyFilterAction?.('displace') },
    { label: 'Pinch...', action: (s) => s.applyFilterAction?.('pinch') },
    { label: 'Ripple...', action: (s) => s.applyFilterAction?.('ripple') },
    { label: 'Wave...', action: (s) => s.applyFilterAction?.('wave') }
  ] },
  { label: 'Noise', submenu: [
    { label: 'Add Noise...', action: (s) => s.applyFilterAction?.('add_noise') },
    { label: 'Dust & Scratches...', action: (s) => s.applyFilterAction?.('dust_scratches') },
    { label: 'Median...', action: (s) => s.applyFilterAction?.('median') }
  ] },
  { label: 'Sharpen', submenu: [
    { label: 'Sharpen', action: (s) => s.applyFilterAction?.('sharpen') },
    { label: 'Sharpen More', action: (s) => s.applyFilterAction?.('sharpen_more') },
    { label: 'Unsharp Mask...', action: (s) => s.applyFilterAction?.('unsharp_mask') }
  ] },
  { label: 'Stylize', submenu: [
    { label: 'Emboss...', action: (s) => s.applyFilterAction?.('emboss') },
    { label: 'Find Edges', action: (s) => s.applyFilterAction?.('find_edges') },
    { label: 'Oil Paint...', action: (s) => s.applyFilterAction?.('oil_paint') }
  ] },
  { label: 'Other', submenu: [
    { label: 'High Pass...', action: (s) => s.applyFilterAction?.('high_pass') },
    { label: 'Maximum...', action: (s) => s.applyFilterAction?.('maximum') },
    { label: 'Minimum...', action: (s) => s.applyFilterAction?.('minimum') }
  ] },
];

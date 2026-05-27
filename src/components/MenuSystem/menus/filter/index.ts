import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const filterMenu: MenuItem[] = [
  { label: 'Filter Gallery...', action: placeholder() },
  { label: 'Camera Raw Filter...', action: placeholder() },
  { divider: true },
  { label: 'Blur', submenu: [{ label: 'Average', action: placeholder() }, { label: 'Blur', action: placeholder() }, { label: 'Gaussian Blur...', action: placeholder() }, { label: 'Motion Blur...', action: placeholder() }] },
  { label: 'Distort', submenu: [{ label: 'Displace...', action: placeholder() }, { label: 'Pinch...', action: placeholder() }, { label: 'Ripple...', action: placeholder() }, { label: 'Wave...', action: placeholder() }] },
  { label: 'Noise', submenu: [{ label: 'Add Noise...', action: placeholder() }, { label: 'Dust & Scratches...', action: placeholder() }, { label: 'Median...', action: placeholder() }] },
  { label: 'Sharpen', submenu: [{ label: 'Sharpen', action: placeholder() }, { label: 'Sharpen More', action: placeholder() }, { label: 'Unsharp Mask...', action: placeholder() }] },
  { label: 'Stylize', submenu: [{ label: 'Emboss...', action: placeholder() }, { label: 'Find Edges', action: placeholder() }, { label: 'Oil Paint...', action: placeholder() }] },
  { label: 'Other', submenu: [{ label: 'High Pass...', action: placeholder() }, { label: 'Maximum...', action: placeholder() }, { label: 'Minimum...', action: placeholder() }] },
];

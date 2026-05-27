import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const helpMenu: MenuItem[] = [
  { label: 'Pixelite Help...', action: placeholder() },
  { label: 'Learn & Tutorials', action: placeholder() },
  { divider: true },
  { label: 'System Info', action: placeholder() },
  { label: 'Keyboard Shortcuts', action: placeholder() },
  { divider: true },
  { label: 'About Pixelite', action: placeholder() },
];

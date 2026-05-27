import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const editTransformMenu: MenuItem[] = [
  { label: 'Paste Special', submenu: [
    { label: 'Paste in Place', action: placeholder() },
    { label: 'Paste Into', action: placeholder() },
    { label: 'Paste Outside', action: placeholder() },
  ] },
  { divider: true },
  { label: 'Free Transform', shortcut: 'Ctrl+T', action: placeholder() },
  { label: 'Content-Aware Scale', action: placeholder() },
  { label: 'Puppet Warp', action: placeholder() },
];

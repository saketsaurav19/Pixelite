import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const windowMenu: MenuItem[] = [
  { label: 'Arrange', submenu: [{ label: 'Cascade', action: placeholder() }, { label: 'Tile', action: placeholder() }, { label: 'Float All in Windows', action: placeholder() }] },
  { divider: true },
  { label: 'Workspace', submenu: [{ label: 'Essentials (Default)', action: placeholder() }, { label: 'Photography', action: placeholder() }, { label: 'Graphic and Web', action: placeholder() }, { label: 'Reset Essentials', action: placeholder() }] },
  { divider: true },
  { label: 'Layers', action: placeholder() },
  { label: 'History', action: placeholder() },
  { label: 'Properties', action: placeholder() },
  { label: 'Adjustments', action: placeholder() },
  { label: 'Navigator', action: placeholder() },
];

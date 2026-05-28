import type { MenuItem } from '../types';

export const windowMenu: MenuItem[] = [
  { label: 'Arrange', submenu: [
    { label: 'Cascade', action: (_s) => console.log('Cascade layout') },
    { label: 'Tile', action: (_s) => console.log('Tile layout') },
    { label: 'Float All in Windows', action: (_s) => console.log('Float layout') }
  ] },
  { divider: true },
  { label: 'Workspace', submenu: [
    { label: 'Essentials (Default)', action: (_s) => console.log('Reset to Essentials') },
    { label: 'Photography', action: (_s) => console.log('Set Photography workspace') },
    { label: 'Graphic and Web', action: (_s) => console.log('Set Graphic/Web workspace') },
    { label: 'Reset Essentials', action: (_s) => console.log('Reset workspace') }
  ] },
  { divider: true },
  { label: 'Layers', action: (s) => s.togglePanel?.('layers') },
  { label: 'History', action: (s) => s.togglePanel?.('history') },
  { label: 'Properties', action: (s) => s.togglePanel?.('properties') },
  { label: 'Adjustments', action: (s) => s.togglePanel?.('adjustments') },
  { label: 'Navigator', action: (s) => s.togglePanel?.('navigator') },
];

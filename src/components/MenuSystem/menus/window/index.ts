import type { MenuItem } from '../types';

export const windowMenu: MenuItem[] = [
  { label: 'Arrange', submenu: [
    { label: 'Cascade', action: (s) => console.log('Cascade layout') },
    { label: 'Tile', action: (s) => console.log('Tile layout') },
    { label: 'Float All in Windows', action: (s) => console.log('Float layout') }
  ] },
  { divider: true },
  { label: 'Workspace', submenu: [
    { label: 'Essentials (Default)', action: (s) => console.log('Reset to Essentials') },
    { label: 'Photography', action: (s) => console.log('Set Photography workspace') },
    { label: 'Graphic and Web', action: (s) => console.log('Set Graphic/Web workspace') },
    { label: 'Reset Essentials', action: (s) => console.log('Reset workspace') }
  ] },
  { divider: true },
  { label: 'Layers', action: (s) => s.togglePanel?.('layers') },
  { label: 'History', action: (s) => s.togglePanel?.('history') },
  { label: 'Properties', action: (s) => s.togglePanel?.('properties') },
  { label: 'Adjustments', action: (s) => s.togglePanel?.('adjustments') },
  { label: 'Navigator', action: (s) => s.togglePanel?.('navigator') },
];

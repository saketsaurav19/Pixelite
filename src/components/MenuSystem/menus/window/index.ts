import type { MenuItem } from '../types';

export const windowMenu: MenuItem[] = [
  { label: 'Arrange', submenu: [
    { label: 'Cascade', action: (s) => s.setDocumentLayout?.('cascade') },
    { label: 'Tile', action: (s) => s.setDocumentLayout?.('tile') },
    { label: 'Float All in Windows', action: (s) => s.setDocumentLayout?.('float') }
  ] },
  { divider: true },
  { label: 'Workspace', submenu: [
    { label: 'Essentials (Default)', action: (s) => s.setWorkspace?.('essentials') },
    { label: 'Photography', action: (s) => s.setWorkspace?.('photography') },
    { label: 'Graphic and Web', action: (s) => s.setWorkspace?.('graphic-web') },
    { label: 'Reset Essentials', action: (s) => s.setWorkspace?.('essentials') }
  ] },
  { divider: true },
  { label: 'Layers', action: (s) => s.togglePanel?.('layers') },
  { label: 'History', action: (s) => s.togglePanel?.('history') },
  { label: 'Properties', action: (s) => s.togglePanel?.('properties') },
  { label: 'Adjustments', action: (s) => s.togglePanel?.('adjustments') },
  { label: 'Navigator', action: (s) => s.togglePanel?.('navigator') },
];

import type { MenuItem } from '../types';

export const editCoreMenu: MenuItem[] = [
  { label: 'Undo', shortcut: 'Ctrl+Z', action: (s) => s.undo?.(), isEnabled: (s) => s.historyIndex > 0 },
  { label: 'Step Forward', shortcut: 'Shift+Ctrl+Z', action: (s) => s.redo?.(), isEnabled: (s) => s.historyIndex < s.history.length - 1 },
  { label: 'Step Backward', shortcut: 'Alt+Ctrl+Z', action: (s) => s.undo?.(), isEnabled: (s) => s.historyIndex > 0 },
  { divider: true },
  { label: 'Cut', shortcut: 'Ctrl+X', action: (_s) => console.log('Cut') },
  { label: 'Copy', shortcut: 'Ctrl+C', action: (_s) => console.log('Copy') },
  { label: 'Copy Merged', shortcut: 'Shift+Ctrl+C', action: (_s) => console.log('Copy Merged') },
  { label: 'Paste', shortcut: 'Ctrl+V', action: (_s) => console.log('Paste') },
];

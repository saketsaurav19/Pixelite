import type { MenuItem } from '../types';

export const selectMenu: MenuItem[] = [
  { label: 'All', shortcut: 'Ctrl+A', action: (s) => s.setSelectionRect?.({ x: 0, y: 0, w: s.documentSize.w, h: s.documentSize.h }, 'rect') },
  { label: 'Deselect', shortcut: 'Ctrl+D', action: (s) => { s.setSelectionRect?.(null); s.setLassoPaths?.([]); } },
  { label: 'Reselect', shortcut: 'Shift+Ctrl+D', action: (s) => s.reselect?.() },
  { label: 'Inverse', shortcut: 'Shift+Ctrl+I', action: (s) => s.inverseSelection?.() },
  { divider: true },
  { label: 'Subject', action: () => window.dispatchEvent(new CustomEvent('select-subject')) },
  { label: 'Sky', action: (_s) => console.log('Select Sky (AI feature)') },
  { label: 'Remove Background', action: () => window.dispatchEvent(new CustomEvent('remove-background')) },
  { label: 'Color Range...', action: (_s) => console.log('Color Range dialog') },
  { label: 'Modify', submenu: [
    { label: 'Border...', action: (s) => s.modifySelection?.('border', 5) },
    { label: 'Smooth...', action: (s) => s.modifySelection?.('smooth', 5) },
    { label: 'Expand...', action: (s) => s.modifySelection?.('expand', 5) },
    { label: 'Contract...', action: (s) => s.modifySelection?.('contract', 5) },
    { label: 'Feather...', action: (s) => s.setSelectionFeather?.(5) }
  ] },
  { label: 'Transform Selection', action: (_s) => console.log('Transform selection mode') },
];

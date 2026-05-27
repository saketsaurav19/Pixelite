import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const selectMenu: MenuItem[] = [
  { label: 'All', shortcut: 'Ctrl+A', action: (s) => s.setSelectionRect?.({ x: 0, y: 0, w: s.documentSize.w, h: s.documentSize.h }, 'rect') },
  { label: 'Deselect', shortcut: 'Ctrl+D', action: (s) => { s.setSelectionRect?.(null); s.setLassoPaths?.([]); } },
  { label: 'Reselect', shortcut: 'Shift+Ctrl+D', action: placeholder() },
  { label: 'Inverse', shortcut: 'Shift+Ctrl+I', action: (s) => s.inverseSelection?.() },
  { divider: true },
  { label: 'Subject', action: () => window.dispatchEvent(new CustomEvent('select-subject')) },
  { label: 'Sky', action: placeholder() },
  { label: 'Remove Background', action: () => window.dispatchEvent(new CustomEvent('remove-background')) },
  { label: 'Color Range...', action: placeholder() },
  { label: 'Modify', submenu: [{ label: 'Border...', action: placeholder() }, { label: 'Smooth...', action: placeholder() }, { label: 'Expand...', action: placeholder() }, { label: 'Contract...', action: placeholder() }, { label: 'Feather...', action: placeholder() }] },
  { label: 'Transform Selection', action: placeholder() },
];

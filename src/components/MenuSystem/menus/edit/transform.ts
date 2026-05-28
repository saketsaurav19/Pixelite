import type { MenuItem } from '../types';
import { pasteFromClipboard } from '../../../../utils/clipboardUtils';

export const editTransformMenu: MenuItem[] = [
  { label: 'Paste Special', submenu: [
    { label: 'Paste in Place', action: (s) => pasteFromClipboard(s, 'in_place'), isEnabled: (s) => !!s.clipboardDataUrl },
    { label: 'Paste Into', action: (s) => pasteFromClipboard(s, 'into'), isEnabled: (s) => !!s.clipboardDataUrl && !!s.selectionRect },
    { label: 'Paste Outside', action: (s) => pasteFromClipboard(s, 'outside'), isEnabled: (s) => !!s.clipboardDataUrl && !!s.selectionRect },
  ] },
  { divider: true },
  { label: 'Free Transform', shortcut: 'Ctrl+T', action: (s) => s.setActiveTool?.('transform') },
  { label: 'Content-Aware Scale', action: (_s) => console.log('Content-Aware Scale') },
  { label: 'Puppet Warp', action: (s) => s.setActiveTool?.('puppet_warp') },
];

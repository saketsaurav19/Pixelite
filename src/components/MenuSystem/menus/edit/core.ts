import type { MenuItem } from '../types';
import { copySelectionToClipboard, cutSelection, pasteFromClipboard } from '../../../../utils/clipboardUtils';

export const editCoreMenu: MenuItem[] = [
  { label: 'Redo', shortcut: 'Shift+Ctrl+Z', action: (s) => s.redo?.(), isEnabled: (s) => s.historyIndex < s.history.length - 1 },
  { label: 'Undo', shortcut: 'Alt+Ctrl+Z', action: (s) => s.undo?.(), isEnabled: (s) => s.historyIndex > 0 },
  { divider: true },
  { label: 'Cut', shortcut: 'Ctrl+X', action: (s) => cutSelection(s) },
  { label: 'Copy', shortcut: 'Ctrl+C', action: (s) => copySelectionToClipboard(s, false) },
  { label: 'Copy Merged', shortcut: 'Shift+Ctrl+C', action: (s) => copySelectionToClipboard(s, true) },
  { label: 'Paste', shortcut: 'Ctrl+V', action: (s) => pasteFromClipboard(s, 'center'), isEnabled: (s) => !!s.clipboardDataUrl },
  { divider: true },
  { label: 'Signature Trace...', action: (s) => s.setIsSignatureDialogOpen?.(true) },
];

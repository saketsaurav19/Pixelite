import type { MenuItem } from '../types';
import { placeholder } from '../types';

const clampZoom = (z: number) => Math.max(0.1, Math.min(32, z));

export const viewMenu: MenuItem[] = [
  { label: 'Zoom In', shortcut: 'Ctrl++', action: (s) => s.setZoom?.(clampZoom(s.zoom * 1.25)) },
  { label: 'Zoom Out', shortcut: 'Ctrl+-', action: (s) => s.setZoom?.(clampZoom(s.zoom / 1.25)) },
  { label: 'Fit on Screen', shortcut: 'Ctrl+0', action: placeholder() },
  { label: '100%', shortcut: 'Ctrl+1', action: (s) => s.setZoom?.(1) },
  { divider: true },
  { label: 'Screen Mode', submenu: [{ label: 'Standard Screen Mode', action: placeholder() }, { label: 'Full Screen Mode with Menu Bar', action: placeholder() }, { label: 'Full Screen Mode', action: placeholder() }] },
  { label: 'Extras', shortcut: 'Ctrl+H', action: placeholder() },
  { label: 'Rulers', shortcut: 'Ctrl+R', action: (s) => s.setShowRulers?.(!s.showRulers), isChecked: (s) => s.showRulers },
  { label: 'Guides', shortcut: 'Ctrl+;', action: placeholder() },
  { label: 'Snap To', submenu: [{ label: 'Guides', action: placeholder() }, { label: 'Layers', action: placeholder() }, { label: 'Document Bounds', action: placeholder() }, { label: 'All', action: placeholder() }] },
];

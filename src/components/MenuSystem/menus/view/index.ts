import type { MenuItem } from '../types';

const clampZoom = (z: number) => Math.max(0.1, Math.min(32, z));

export const viewMenu: MenuItem[] = [
  { label: 'Zoom In', shortcut: 'Ctrl++', action: (s) => s.setZoom?.(clampZoom(s.zoom * 1.25)) },
  { label: 'Zoom Out', shortcut: 'Ctrl+-', action: (s) => s.setZoom?.(clampZoom(s.zoom / 1.25)) },
  { label: 'Fit on Screen', shortcut: 'Ctrl+0', action: (s) => {
    const { w, h } = s.documentSize;
    const padding = 40;
    const availableW = window.innerWidth - 300;
    const availableH = window.innerHeight - 150;
    const zoom = Math.min((availableW - padding) / w, (availableH - padding) / h);
    s.setZoom?.(zoom);
    s.setCanvasOffset?.({ x: 0, y: 0 });
  } },
  { label: '100%', shortcut: 'Ctrl+1', action: (s) => s.setZoom?.(1) },
  { divider: true },
  { label: 'Screen Mode', submenu: [
    { label: 'Standard Screen Mode', action: (s) => s.setScreenMode?.('standard') },
    { label: 'Full Screen Mode with Menu Bar', action: (s) => s.setScreenMode?.('full-menu') },
    { label: 'Full Screen Mode', action: (s) => s.setScreenMode?.('full') }
  ] },
  { label: 'Extras', shortcut: 'Ctrl+H', action: (s) => s.togglePanel?.('extras') },
  { label: 'Rulers', shortcut: 'Ctrl+R', action: (s) => s.togglePanel?.('rulers') },
  { label: 'Guides', shortcut: 'Ctrl+;', action: (s) => s.togglePanel?.('guides') },
  { label: 'Snap To', submenu: [
    { label: 'Guides', action: (s) => s.setSnapSetting?.('guides', !s.snapSettings?.guides) },
    { label: 'Layers', action: (s) => s.setSnapSetting?.('layers', !s.snapSettings?.layers) },
    { label: 'Document Bounds', action: (s) => s.setSnapSetting?.('documentBounds', !s.snapSettings?.documentBounds) },
    { label: 'All', action: (s) => {
      const allOn = !s.snapSettings?.guides || !s.snapSettings?.layers || !s.snapSettings?.documentBounds;
      s.setSnapSetting?.('guides', allOn);
      s.setSnapSetting?.('layers', allOn);
      s.setSnapSetting?.('documentBounds', allOn);
    } }
  ] },
];

import type { MenuItem } from '../types';

export const layerManagementMenu: MenuItem[] = [
  { label: 'New', submenu: [
    { label: 'Layer...', action: (s) => s.addLayer?.({ name: 'Layer', type: 'paint' }) },
    { label: 'Layer from Background', action: (s) => {
      const bg = s.layers.find(l => l.name.toLowerCase() === 'background');
      if (bg) s.updateLayer?.(bg.id, { locked: false, name: 'Layer 0' });
    } },
    { label: 'Group...', action: (s) => s.addLayer?.({ name: 'Group', type: 'paint' }) }
  ] },
  { label: 'Duplicate Layer...', action: (s) => s.activeLayerId && s.duplicateLayer?.(s.activeLayerId), isEnabled: (s) => Boolean(s.activeLayerId) },
  { label: 'Delete', shortcut: 'Del', action: (s) => s.activeLayerId && s.removeLayer?.(s.activeLayerId), isEnabled: (s) => Boolean(s.activeLayerId) },
  { divider: true },
];

import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const layerManagementMenu: MenuItem[] = [
  { label: 'New', submenu: [{ label: 'Layer...', action: (s) => s.addLayer?.({ name: 'Layer', type: 'paint' }) }, { label: 'Layer from Background', action: placeholder() }, { label: 'Group...', action: placeholder() }] },
  { label: 'Duplicate Layer...', action: (s) => s.activeLayerId && s.duplicateLayer?.(s.activeLayerId), isEnabled: (s) => Boolean(s.activeLayerId) },
  { label: 'Delete', shortcut: 'Del', action: (s) => s.activeLayerId && s.removeLayer?.(s.activeLayerId), isEnabled: (s) => Boolean(s.activeLayerId) },
  { divider: true },
];

import type { MenuItem } from '../types';
import { placeholder } from '../types';

export const layerStylesMenu: MenuItem[] = [
  { label: 'Layer Style', submenu: [{ label: 'Blending Options...', action: placeholder() }, { label: 'Drop Shadow', action: placeholder() }, { label: 'Stroke', action: placeholder() }] },
  { label: 'Smart Objects', submenu: [{ label: 'Convert to Smart Object', action: placeholder() }, { label: 'Rasterize', action: placeholder() }] },
  { label: 'Rasterize', submenu: [{ label: 'Type', action: placeholder() }, { label: 'Shape', action: placeholder() }, { label: 'Layer', action: placeholder() }] },
  { label: 'Arrange', submenu: [{ label: 'Bring to Front', action: placeholder() }, { label: 'Bring Forward', action: placeholder() }, { label: 'Send Backward', action: placeholder() }, { label: 'Send to Back', action: placeholder() }] },
  { label: 'Merge Layers', action: placeholder() },
  { label: 'Flatten Image', action: placeholder() },
];

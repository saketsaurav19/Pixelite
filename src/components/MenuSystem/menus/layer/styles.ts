import type { MenuItem } from '../types';

export const layerStylesMenu: MenuItem[] = [
  { label: 'Layer Style', submenu: [
    { label: 'Blending Options...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('blending'); } },
    { label: 'Drop Shadow', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('shadow'); } },
    { label: 'Stroke', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('stroke'); } }
  ] },
  { label: 'Smart Objects', submenu: [
    { label: 'Convert to Smart Object', action: (s) => s.activeLayerId && s.updateLayer?.(s.activeLayerId, { type: 'image' }) },
    { label: 'Rasterize', action: (s) => s.activeLayerId && s.rasterizeLayer?.(s.activeLayerId) }
  ] },
  { label: 'Rasterize', submenu: [
    { label: 'Type', action: (s) => s.activeLayerId && s.rasterizeLayer?.(s.activeLayerId) },
    { label: 'Shape', action: (s) => s.activeLayerId && s.rasterizeLayer?.(s.activeLayerId) },
    { label: 'Layer', action: (s) => s.activeLayerId && s.rasterizeLayer?.(s.activeLayerId) }
  ] },
  { label: 'Arrange', submenu: [
    { label: 'Bring to Front', action: (s) => s.activeLayerId && s.reorderLayers?.(s.layers.findIndex(l => l.id === s.activeLayerId), 0) },
    { label: 'Bring Forward', action: (s) => s.activeLayerId && s.moveLayer?.(s.activeLayerId, 'up') },
    { label: 'Send Backward', action: (s) => s.activeLayerId && s.moveLayer?.(s.activeLayerId, 'down') },
    { label: 'Send to Back', action: (s) => s.activeLayerId && s.reorderLayers?.(s.layers.findIndex(l => l.id === s.activeLayerId), s.layers.length - 1) }
  ] },
  { label: 'Merge Layers', action: (s) => s.mergeLayers?.(s.layers.map(l => l.id)) },
  { label: 'Flatten Image', action: (s) => s.flattenImage?.() },
];

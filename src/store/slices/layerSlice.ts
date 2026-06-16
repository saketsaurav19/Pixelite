
import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, Layer } from '../types';
import { findLayerById, removeNode, insertNode, updateNode, flattenTree, moveNode, reorderNodes } from '../../utils/layerUtils';

export interface LayerSlice {
  layers: Layer[];
  activeLayerId: string | null;
  
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  duplicateLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  reorderLayers: (startIndex: number, endIndex: number) => void; // Old array-based, consider deprecating
  reorderNodesAction: (draggedId: string, targetId: string, position: 'before'|'after'|'inside') => void;
  setLayers: (layers: Layer[]) => void;
  mergeLayers: (ids: string[]) => void;
  flattenImage: () => void;
  rasterizeLayer: (id: string) => void;
}

export const createLayerSlice: StateCreator<EditorState, [], [], LayerSlice> = (set) => ({
  layers: [],
  activeLayerId: null,

  addLayer: (layer) => set((state) => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Layer ${flattenTree(state.layers).length + 1}`,
      visible: true,
      locked: false,
      lockPixels: false,
      lockPosition: false,
      lockTransparent: false,
      opacity: 1,
      fill: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      ...layer,
    } as Layer;
    return {
      layers: [newLayer, ...state.layers], // Adds to top level for now
      activeLayerId: newLayer.id,
    };
  }),

  removeLayer: (id) => set((state) => ({
    layers: removeNode(state.layers, id),
    activeLayerId: state.activeLayerId === id ? (state.layers[0]?.id || null) : state.activeLayerId
  })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  updateLayer: (id, updates) => set((state) => {
    const targetLayer = findLayerById(state.layers, id);
    let newLayers = state.layers;
    if (targetLayer && targetLayer.type === 'artboard' && updates.locked !== undefined) {
      const applyLockRecursively = (node: Layer, lockedVal: boolean): Layer => {
        const nextNode = { ...node, locked: lockedVal };
        if (nextNode.children) {
          nextNode.children = nextNode.children.map(child => applyLockRecursively(child, lockedVal));
        }
        return nextNode;
      };
      const updatedArtboard = applyLockRecursively(targetLayer, updates.locked);
      newLayers = updateNode(state.layers, id, updatedArtboard);
    } else {
      newLayers = updateNode(state.layers, id, updates);
    }
    return { layers: newLayers };
  }),

  duplicateLayer: (id) => set((state) => {
    const layerToDup = findLayerById(state.layers, id);
    if (!layerToDup) return state;
    const newLayer: Layer = {
      ...layerToDup,
      id: nanoid(),
      name: `${layerToDup.name} Copy`,
      position: layerToDup.position ? { x: layerToDup.position.x + 20, y: layerToDup.position.y + 20 } : {x:0, y:0}
    };
    return {
      layers: insertNode(state.layers, newLayer), // Insert at top level for now
      activeLayerId: newLayer.id,
    };
  }),

  toggleLayerVisibility: (id) => set((state) => {
    const layer = findLayerById(state.layers, id);
    if (!layer) return state;
    return {
      layers: updateNode(state.layers, id, { visible: !layer.visible })
    };
  }),

  moveLayer: (id, direction) => set((state) => ({
    layers: moveNode(state.layers, id, direction)
  })),

  reorderLayers: (startIndex, endIndex) => set((state) => {
    // Keep backward compat for now, assumes flat list
    const next = [...state.layers];
    if (startIndex >= 0 && startIndex < next.length && endIndex >= 0 && endIndex <= next.length) {
      const [removed] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, removed);
    }
    return { layers: next };
  }),

  reorderNodesAction: (draggedId, targetId, position) => set((state) => ({
    layers: reorderNodes(state.layers, draggedId, targetId, position)
  })),

  setLayers: (layers) => set({ layers }),

  mergeLayers: (ids) => set((state) => {
    let newLayers = state.layers;
    const layerToKeep = ids[0];
    for (let i = 1; i < ids.length; i++) {
        newLayers = removeNode(newLayers, ids[i]);
    }
    return { layers: newLayers, activeLayerId: layerToKeep };
  }),

  flattenImage: () => set((state) => {
    if (state.layers.length === 0) return state;
    const allLayers = flattenTree(state.layers);
    const bottomLayer = allLayers[allLayers.length - 1] || state.layers[0];
    const backgroundLayer: Layer = {
      ...bottomLayer,
      id: nanoid(),
      name: 'Background',
      locked: true,
      type: 'paint',
    };
    return { layers: [backgroundLayer], activeLayerId: backgroundLayer.id };
  }),

  rasterizeLayer: (id) => set((state) => ({
    layers: updateNode(state.layers, id, { type: 'paint' })
  })),
});

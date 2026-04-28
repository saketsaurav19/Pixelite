import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, Layer } from '../types';

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
  reorderLayers: (startIndex: number, endIndex: number) => void;
  setLayers: (layers: Layer[]) => void;
}

export const createLayerSlice: StateCreator<EditorState, [], [], LayerSlice> = (set) => ({
  layers: [],
  activeLayerId: null,

  addLayer: (layer) => set((state) => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Layer ${state.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      ...layer,
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),

  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter((l) => l.id !== id),
    activeLayerId: state.activeLayerId === id ? (state.layers[0]?.id || null) : state.activeLayerId
  })),

  setActiveLayer: (id) => set({ activeLayerId: id }),

  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((l) => (l.id === id ? { ...l, ...updates } : l)),
  })),

  duplicateLayer: (id) => set((state) => {
    const layerToDup = state.layers.find(l => l.id === id);
    if (!layerToDup) return state;
    const newLayer: Layer = {
      ...layerToDup,
      id: nanoid(),
      name: `${layerToDup.name} Copy`,
      position: { x: layerToDup.position.x + 20, y: layerToDup.position.y + 20 }
    };
    return {
      layers: [newLayer, ...state.layers],
      activeLayerId: newLayer.id,
    };
  }),

  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, visible: !l.visible } : l
    ),
  })),

  moveLayer: (id, direction) => set((state) => {
    const index = state.layers.findIndex(l => l.id === id);
    if (index === -1) return state;
    const newLayers = [...state.layers];
    if (direction === 'up' && index > 0) {
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
    } else if (direction === 'down' && index < newLayers.length - 1) {
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
    }
    return { layers: newLayers };
  }),

  reorderLayers: (startIndex, endIndex) => set((state) => {
    const next = [...state.layers];
    const [removed] = next.splice(startIndex, 1);
    next.splice(endIndex, 0, removed);
    return { layers: next };
  }),

  setLayers: (layers) => set({ layers }),
});

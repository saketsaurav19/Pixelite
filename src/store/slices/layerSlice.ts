
import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, Layer } from '../types';
import { findLayerById, findParentNode, removeNode, insertNode, updateNode, flattenTree, moveNode, reorderNodes } from '../../utils/layerUtils';

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
  addAdjustmentLayer: (type: 'brightness_contrast' | 'hue_saturation' | 'black_white' | 'photo_effects' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'color_balance') => void;
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
      width: layer.width !== undefined ? layer.width : state.documentSize.w,
      height: layer.height !== undefined ? layer.height : state.documentSize.h,
      blendMode: 'source-over',
      ...layer,
    } as Layer;
    return {
      layers: [newLayer, ...state.layers], // Adds to top level for now
      activeLayerId: newLayer.id,
    };
  }),

  removeLayer: (id) => set((state) => {
    const flatLayers = flattenTree(state.layers);
    const index = flatLayers.findIndex(l => l.id === id);
    let nextActiveId = state.activeLayerId;
    
    if (index !== -1) {
      const deletedNode = flatLayers[index];
      const deletedIds = new Set(flattenTree([deletedNode]).map(l => l.id));
      if (state.activeLayerId && deletedIds.has(state.activeLayerId)) {
        // Find next non-deleted layer
        let found = false;
        for (let i = index + 1; i < flatLayers.length; i++) {
          if (!deletedIds.has(flatLayers[i].id)) {
            nextActiveId = flatLayers[i].id;
            found = true;
            break;
          }
        }
        if (!found) {
          for (let i = index - 1; i >= 0; i--) {
            if (!deletedIds.has(flatLayers[i].id)) {
              nextActiveId = flatLayers[i].id;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          nextActiveId = null;
        }
      }
    }

    return {
      layers: removeNode(state.layers, id),
      activeLayerId: nextActiveId
    };
  }),

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

  addAdjustmentLayer: (type) => set((state) => {
    let name = 'Adjustment Layer';
    let defaultSettings: any = {};
    if (type === 'brightness_contrast') {
      name = 'Brightness/Contrast';
      defaultSettings = { brightness: 0, contrast: 0 };
    } else if (type === 'hue_saturation') {
      name = 'Hue/Saturation';
      defaultSettings = { hue: 0, saturation: 0, lightness: 0 };
    } else if (type === 'black_white') {
      name = 'Black & White';
      defaultSettings = { greyscale: true };
    } else if (type === 'photo_effects') {
      name = 'Photo Effects';
      defaultSettings = { effect: 'none' };
    } else if (type === 'exposure') {
      name = 'Exposure';
      defaultSettings = { exposure: { exposure: 0, offset: 0, gamma: 1.0 } };
    } else if (type === 'vibrance') {
      name = 'Vibrance';
      defaultSettings = { vibrance: 0 };
    } else if (type === 'color_balance') {
      name = 'Color Balance';
      defaultSettings = {
        colorBalance: {
          shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          preserveLuminosity: true
        }
      };
    } else if (type === 'levels') {
      name = 'Levels';
      defaultSettings = {
        levels: {
          master: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          red: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          green: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          blue: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 }
        }
      };
    } else if (type === 'curves') {
      name = 'Curves';
      defaultSettings = {
        curves: {
          master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
        }
      };
    }

    const count = flattenTree(state.layers).filter(l => l.type === 'adjustment' && l.adjustmentData?.type === type).length + 1;

    const newLayer: Layer = {
      id: nanoid(),
      name: `${name} ${count}`,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'adjustment',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      isNew: true,
      adjustmentData: {
        type,
        settings: defaultSettings
      }
    } as Layer;

    let newLayers = [...state.layers];
    if (state.activeLayerId) {
      const parent = findParentNode(state.layers, state.activeLayerId);
      if (parent && parent.children) {
        const activeIdx = parent.children.findIndex(c => c.id === state.activeLayerId);
        const updatedChildren = [...parent.children];
        updatedChildren.splice(activeIdx, 0, newLayer);
        newLayers = updateNode(state.layers, parent.id, { children: updatedChildren });
      } else {
        const activeIdx = state.layers.findIndex(l => l.id === state.activeLayerId);
        if (activeIdx !== -1) {
          newLayers.splice(activeIdx, 0, newLayer);
        } else {
          newLayers = [newLayer, ...newLayers];
        }
      }
    } else {
      newLayers = [newLayer, ...newLayers];
    }

    return {
      layers: newLayers,
      activeLayerId: newLayer.id,
      activeAdjustmentModal: type,
      adjustmentSourceLayerId: state.activeLayerId
    };
  }),
});

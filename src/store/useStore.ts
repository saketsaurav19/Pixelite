import { create } from 'zustand';
import { nanoid } from 'nanoid';

export type Tool = 'select' | 'move' | 'brush' | 'eraser' | 'text' | 'shape' | 'marquee';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  dataUrl?: string; // For image layers
  type: 'image' | 'paint' | 'text' | 'shape';
  position: { x: number; y: number };
  blendMode: GlobalCompositeOperation;
  textContent?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  shapeData?: { w: number; h: number; fill: string; stroke: string; strokeWidth: number };
}

interface HistoryEntry {
  name: string;
  state: {
    layers: Layer[];
    activeLayerId: string | null;
  };
}

interface EditorState {
  activeTool: Tool;
  zoom: number;
  layers: Layer[];
  activeLayerId: string | null;
  brushSize: number;
  strokeWidth: number;
  brushColor: string;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  history: HistoryEntry[];
  historyIndex: number;
  
  // Actions
  setActiveTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  duplicateLayer: (id: string) => void;
  setBrushSize: (size: number) => void;
  setStrokeWidth: (width: number) => void;
  setBrushColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setPrimaryOpacity: (opacity: number) => void;
  setSecondaryOpacity: (opacity: number) => void;
  undo: () => void;
  redo: () => void;
  recordHistory: (actionName: string) => void;
}

export const useStore = create<EditorState>((set) => ({
  activeTool: 'brush',
  zoom: 1,
  layers: [
    {
      id: nanoid(),
      name: 'Background',
      visible: true,
      locked: true,
      opacity: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
    },
  ],
  activeLayerId: null,
  brushSize: 40,
  strokeWidth: 2,
  brushColor: '#000000',
  secondaryColor: '#ffffff',
  primaryOpacity: 1,
  secondaryOpacity: 1,
  history: [],
  historyIndex: -1,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom }),
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
  updateLayer: (id, updates) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, ...updates } : l
    ),
  })),
  duplicateLayer: (id) => set((state) => {
    const layerToDup = state.layers.find(l => l.id === id);
    if (!layerToDup) return state;
    const newLayer = {
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
  removeLayer: (id) => set((state) => ({
    layers: state.layers.filter((l) => l.id !== id),
  })),
  setActiveLayer: (id) => set({ activeLayerId: id }),
  toggleLayerVisibility: (id) => set((state) => ({
    layers: state.layers.map((l) => 
      l.id === id ? { ...l, visible: !l.visible } : l
    ),
  })),
  setBrushSize: (size) => set({ brushSize: size }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setBrushColor: (color: string) => set({ brushColor: color }),
  setSecondaryColor: (color: string) => set({ secondaryColor: color }),
  setPrimaryOpacity: (opacity) => set({ primaryOpacity: opacity }),
  setSecondaryOpacity: (opacity) => set({ secondaryOpacity: opacity }),
  undo: () => set((state) => {
    if (state.historyIndex <= 0) return state;
    const prevIndex = state.historyIndex - 1;
    return {
      ...state.history[prevIndex].state,
      historyIndex: prevIndex,
    };
  }),
  redo: () => set((state) => {
    if (state.historyIndex >= state.history.length - 1) return state;
    const nextIndex = state.historyIndex + 1;
    return {
      ...state.history[nextIndex].state,
      historyIndex: nextIndex,
    };
  }),
  recordHistory: (name) => set((state) => {
    const newEntry = {
      name,
      state: {
        layers: state.layers,
        activeLayerId: state.activeLayerId,
      },
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    return {
      history: [...newHistory, newEntry],
      historyIndex: newHistory.length,
    };
  }),
}));

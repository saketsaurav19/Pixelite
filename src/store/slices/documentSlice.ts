import type { StateCreator } from 'zustand';
import type { EditorState } from '../types';

export interface DocumentSlice {
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  documentSize: { w: number; h: number };
  slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
  colorSamplers: { id: string; x: number; y: number; color: string }[];
  rulerData: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  vectorPaths: { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[];
  activePathIndex: number | null;
  penMode: 'path' | 'shape';
  cloneSource: { x: number; y: number } | null;
  customPattern: string | null;
  cropRect: { x: number; y: number; w: number; h: number } | null;

  setZoom: (zoom: number) => void;
  setCanvasOffset: (offset: { x: number; y: number }) => void;
  setCanvasRotation: (rotation: number) => void;
  setDocumentSize: (size: { w: number; h: number }) => void;
  setSlices: (slices: any[]) => void;
  addSlice: (rect: { x: number; y: number; w: number; h: number }) => void;
  clearSlices: () => void;
  addColorSampler: (coords: { x: number; y: number }, color: string) => void;
  removeColorSampler: (id: string) => void;
  clearColorSamplers: () => void;
  setRulerData: (data: any) => void;
  setVectorPaths: (updater: any) => void;
  setActivePathIndex: (index: number | null) => void;
  setPenMode: (mode: 'path' | 'shape') => void;
  setCloneSource: (source: { x: number; y: number } | null) => void;
  setCustomPattern: (pattern: string | null) => void;
  setCropRect: (updater: any) => void;
}

export const createDocumentSlice: StateCreator<EditorState, [], [], DocumentSlice> = (set) => ({
  zoom: 1,
  canvasOffset: { x: 0, y: 0 },
  canvasRotation: 0,
  documentSize: { w: 2000, h: 1400 },
  slices: [],
  colorSamplers: [],
  rulerData: null,
  vectorPaths: [],
  activePathIndex: null,
  penMode: 'path',
  cloneSource: null,
  customPattern: null,
  cropRect: null,

  setZoom: (zoom) => set({ zoom }),
  setCanvasOffset: (offset) => set({ canvasOffset: offset }),
  setCanvasRotation: (rotation) => set({ canvasRotation: rotation }),
  setDocumentSize: (documentSize) => set({ documentSize }),
  setSlices: (slices) => set({ slices }),
  addSlice: (rect) => set((state) => ({ 
    slices: [...state.slices, { id: (state.slices.length + 1).toString(), rect }] 
  })),
  clearSlices: () => set({ slices: [] }),
  addColorSampler: (coords, color) => set((state) => ({
    colorSamplers: [...state.colorSamplers, { id: (state.colorSamplers.length + 1).toString(), ...coords, color }]
  })),
  removeColorSampler: (id) => set((state) => ({
    colorSamplers: state.colorSamplers.filter(s => s.id !== id)
  })),
  clearColorSamplers: () => set({ colorSamplers: [] }),
  setRulerData: (rulerData) => set({ rulerData }),
  setVectorPaths: (updater) => set((state) => ({ 
    vectorPaths: typeof updater === 'function' ? updater(state.vectorPaths) : updater 
  })),
  setActivePathIndex: (index) => set({ activePathIndex: index }),
  setPenMode: (mode) => set({ penMode: mode }),
  setCloneSource: (cloneSource) => set({ cloneSource }),
  setCustomPattern: (customPattern) => set({ customPattern }),
  setCropRect: (updater) => set((state) => ({ 
    cropRect: typeof updater === 'function' ? updater(state.cropRect) : updater 
  })),
});

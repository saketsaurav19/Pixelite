import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, DocumentSpecificState, DocumentArchive } from '../types';

export interface DocumentSlice {
  currentProjectId: string | null;
  setCurrentProjectId: (id: string | null) => void;
  clipboardDataUrl: string | null;
  clipboardDataRect: { x: number; y: number; w: number; h: number } | null;
  setClipboardDataRect: (rect: { x: number; y: number; w: number; h: number } | null) => void;
  setClipboardDataUrl: (url: string | null) => void;
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
  showRulers: boolean;
  showGrid: boolean;
  showGuides: boolean;
  exifData: any;
  iccProfile: string;

  setExifData: (data: any) => void;
  setIccProfile: (profile: string) => void;

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
  setShowRulers: (val: boolean) => void;
  setShowGrid: (val: boolean) => void;
  setShowGuides: (val: boolean) => void;

  // Multi-tab actions
  addDocument: (name?: string, size?: { w: number; h: number }, initialState?: any) => void;
  closeDocument: (id: string) => void;
  switchDocument: (id: string) => void;
}

const extractDocumentState = (state: EditorState): DocumentSpecificState => ({
  layers: state.layers,
  activeLayerId: state.activeLayerId,
  history: state.history,
  historyIndex: state.historyIndex,
  documentSize: state.documentSize,
  zoom: state.zoom,
  canvasOffset: state.canvasOffset,
  canvasRotation: state.canvasRotation,
  lassoPaths: state.lassoPaths,
  selectionRect: state.selectionRect,
  isInverseSelection: state.isInverseSelection,
  selectionTolerance: state.selectionTolerance,
  selectionContiguous: state.selectionContiguous,
  slices: state.slices,
  colorSamplers: state.colorSamplers,
  rulerData: state.rulerData,
  vectorPaths: state.vectorPaths,
  activePathIndex: state.activePathIndex,
  penMode: state.penMode,
  cloneSource: state.cloneSource,
  customPattern: state.customPattern,
  cropRect: state.cropRect,
  showRulers: state.showRulers,
  showGrid: state.showGrid,
  showGuides: state.showGuides,
  lights: state.lights,
  isLightingEnabled: state.isLightingEnabled,
  lightingQuality: state.lightingQuality,
  lightingDepthScale: state.lightingDepthScale,
  ambientIntensity: state.ambientIntensity,
  ambientColor: state.ambientColor,
  showLightSource: state.showLightSource,
  workflow: state.workflow,
});

const createInitialDocumentState = (size?: { w: number; h: number }): DocumentSpecificState => {
  const bgLayerId = nanoid();
  return {
    layers: [{
      id: bgLayerId,
      name: 'Background',
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
    }],
    activeLayerId: bgLayerId,
    history: [],
    historyIndex: 0,
    documentSize: size || { w: 1920, h: 1080 },
    zoom: 0.5,
    canvasOffset: { x: 0, y: 0 },
    canvasRotation: 0,
    lassoPaths: [],
    selectionRect: null,
    isInverseSelection: false,
    selectionTolerance: 32,
    selectionContiguous: true,
    slices: [],
    colorSamplers: [],
    rulerData: null,
    vectorPaths: [],
    activePathIndex: null,
    penMode: 'path',
    cloneSource: null,
    customPattern: null,
    cropRect: null,
    showRulers: true,
    showGrid: false,
    showGuides: true,
    lights: [],
    isLightingEnabled: false,
    lightingQuality: 'medium',
    lightingDepthScale: 200,
    ambientIntensity: 0.1,
    ambientColor: '#ffffff',
    showLightSource: true,
    workflow: {
      step: 'image',
      status: {
        image: 'completed',
        depth: 'pending',
        simulation: 'pending',
        refinement: 'pending',
        output: 'pending'
      }
    }
  };
};

export const createDocumentSlice: StateCreator<EditorState, [], [], DocumentSlice> = (set) => ({
  currentProjectId: null,
  setCurrentProjectId: (id) => set({ currentProjectId: id }),
  clipboardDataUrl: null,
  clipboardDataRect: null,
  setClipboardDataUrl: (url) => set({ clipboardDataUrl: url }),
  setClipboardDataRect: (rect) => set({ clipboardDataRect: rect }),
  zoom: 0.5,
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
  exifData: null,
  iccProfile: 'sRGB IEC61966-2.1',
  setExifData: (exifData) => set({ exifData }),
  setIccProfile: (iccProfile) => set({ iccProfile }),

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
  showRulers: true,
  showGrid: false,
  showGuides: true,
  setShowRulers: (showRulers) => set({ showRulers }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setShowGuides: (showGuides) => set({ showGuides }),

  addDocument: (name, size, initialState) => set((state) => {
    const currentDocIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    let updatedDocuments = [...state.documents];

    // Save current document state if it exists in the array
    if (currentDocIndex !== -1) {
      updatedDocuments[currentDocIndex] = {
        ...updatedDocuments[currentDocIndex],
        state: extractDocumentState(state)
      };
    }

    // Helper to check if a document state is empty
    const isStateEmpty = (docState: DocumentSpecificState) => {
      return !docState.layers || docState.layers.length === 0 || (
        docState.layers.length === 1 &&
        docState.layers[0].name === 'Background' &&
        docState.layers[0].type === 'paint' &&
        !docState.layers[0].dataUrl
      );
    };

    let targetIndex = -1;
    // Only replace an empty document if a name is provided (which indicates opening an image/file)
    if (name) {
      if (currentDocIndex !== -1 && isStateEmpty(updatedDocuments[currentDocIndex].state)) {
        targetIndex = currentDocIndex;
      } else {
        targetIndex = updatedDocuments.findIndex(d => isStateEmpty(d.state));
      }
    }

    const newId = nanoid();
    const newName = name || `Untitled-${state.documents.length + 1}`;

    const defaultState = createInitialDocumentState(size);
    const newDocState = initialState
      ? { ...defaultState, ...initialState }
      : defaultState;

    // Validate that activeLayerId points to an actual layer in the new document.
    // When merging defaultState (which has a background layer ID) with an initialState
    // that replaces layers (e.g. opening an image), the activeLayerId may point to a
    // layer that no longer exists. Always correct it to point to the first real layer.
    const layerIds = new Set((newDocState.layers || []).map((l: any) => l.id));
    if (!newDocState.activeLayerId || !layerIds.has(newDocState.activeLayerId)) {
      newDocState.activeLayerId = newDocState.layers?.[0]?.id ?? null;
    }

    const newDoc: DocumentArchive = {
      id: newId,
      name: newName,
      state: newDocState
    };

    if (targetIndex !== -1) {
      updatedDocuments[targetIndex] = newDoc;
    } else {
      updatedDocuments.push(newDoc);
    }

    return {
      documents: updatedDocuments,
      activeDocumentId: newId,
      activeDocumentName: newName,
      ...newDocState
    };
  }),

  switchDocument: (id) => set((state) => {
    if (id === state.activeDocumentId) return state;

    // 1. Save current flat state into the documents array
    const currentDocIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
    if (currentDocIndex === -1) return state;

    const updatedDocuments = [...state.documents];
    updatedDocuments[currentDocIndex] = {
      ...updatedDocuments[currentDocIndex],
      state: extractDocumentState(state)
    };

    // 2. Load target document state
    const targetDoc = updatedDocuments.find(d => d.id === id);
    if (!targetDoc) return state;

    return {
      documents: updatedDocuments,
      activeDocumentId: targetDoc.id,
      activeDocumentName: targetDoc.name,
      ...targetDoc.state
    };
  }),

  closeDocument: (id) => set((state) => {
    const isClosingActive = id === state.activeDocumentId;
    const remainingDocs = state.documents.filter(d => d.id !== id);

    if (remainingDocs.length === 0) {
      const initialId = nanoid();
      const initialName = 'Untitled-1';
      const initialState = createInitialDocumentState();
      return {
        documents: [{ id: initialId, name: initialName, state: initialState }],
        activeDocumentId: initialId,
        activeDocumentName: initialName,
        ...initialState
      };
    }

    if (!isClosingActive) {
      return { documents: remainingDocs };
    }

    // Switching to the nearest tab
    const closedIndex = state.documents.findIndex(d => d.id === id);
    const nextIndex = Math.min(closedIndex, remainingDocs.length - 1);
    const nextDoc = remainingDocs[nextIndex];

    return {
      documents: remainingDocs,
      activeDocumentId: nextDoc.id,
      activeDocumentName: nextDoc.name,
      ...nextDoc.state
    };
  }),
});

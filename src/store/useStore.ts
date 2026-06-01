import { create } from 'zustand';
import type { EditorState } from './types';
import { createLayerSlice } from './slices/layerSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createToolSlice } from './slices/toolSlice';
import { createHistorySlice } from './slices/historySlice';
import { createDocumentSlice } from './slices/documentSlice';
import { createLightingSlice } from './slices/lightingSlice';
import { createUISlice } from './slices/uiSlice';

export type { EditorState, Layer, Tool } from './types';

export const useStore = create<EditorState>()((...a) => ({
  ...createLayerSlice(...a),
  ...createSelectionSlice(...a),
  ...createToolSlice(...a),
  ...createHistorySlice(...a),
  ...createDocumentSlice(...a),
  ...createLightingSlice(...a),
  ...createUISlice(...a),
  documents: [],
  activeDocumentId: '',
  activeDocumentName: '',
}));

import { nanoid } from 'nanoid';
// Initialize history with initial state
const initialDocId = nanoid();
const initialState = {
  layers: [],
  activeLayerId: null,
  history: [
    {
      name: 'Initial State',
      state: {
        layers: [],
        activeLayerId: null,
        lassoPaths: [],
        selectionRect: null,
        isInverseSelection: false,
        documentSize: { w: 1920, h: 1080 },
        selectionTolerance: 32,
        selectionContiguous: true,
        slices: [],
        colorSamplers: [],
        canvasRotation: 0,
        zoom: 1,
        canvasOffset: { x: 0, y: 0 },
        rulerData: null,
        vectorPaths: [],
        activePathIndex: null,
        penMode: 'path' as const,
        cloneSource: null,
        customPattern: null,
        cropRect: null,
        showRulers: true,
        showGrid: false,
        showGuides: true,
        lights: [],
        isLightingEnabled: false,
        lightingQuality: 'medium' as const,
        lightingDepthScale: 200,
        ambientIntensity: 0.1,
        ambientColor: '#ffffff',
        showLightSource: true,
        workflow: {
          step: 'image' as const,
          status: {
            image: 'pending' as const,
            depth: 'pending' as const,
            simulation: 'pending' as const,
            refinement: 'pending' as const,
            output: 'pending' as const,
          },
        },
      },
    },
  ],
  historyIndex: 0,
  documentSize: { w: 1920, h: 1080 },
  zoom: 1,
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
  penMode: 'path' as const,
  cloneSource: null,
  customPattern: null,
  cropRect: null,
  showRulers: true,
  showGrid: false,
  showGuides: true,
  lights: [],
  isLightingEnabled: false,
  lightingQuality: 'medium' as const,
  lightingDepthScale: 200,
  ambientIntensity: 0.1,
  ambientColor: '#ffffff',
  showLightSource: true,
  workflow: {
    step: 'image' as const,
    status: {
      image: 'pending' as const,
      depth: 'pending' as const,
      simulation: 'pending' as const,
      refinement: 'pending' as const,
      output: 'pending' as const,
    },
  },
};

useStore.setState({
  documents: [{
    id: initialDocId,
    name: 'Untitled-1',
    state: initialState
  }],
  activeDocumentId: initialDocId,
  activeDocumentName: 'Untitled-1',
  ...initialState
});

// Expose for E2E testing
if (typeof window !== 'undefined') {
  (window as any)._useStore = useStore;
}

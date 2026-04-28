import { create } from 'zustand';
import type { EditorState } from './types';
import { createLayerSlice } from './slices/layerSlice';
import { createSelectionSlice } from './slices/selectionSlice';
import { createToolSlice } from './slices/toolSlice';
import { createHistorySlice } from './slices/historySlice';
import { createDocumentSlice } from './slices/documentSlice';

export type { EditorState, Layer, Tool } from './types';

export const useStore = create<EditorState>()((...a) => ({
  ...createLayerSlice(...a),
  ...createSelectionSlice(...a),
  ...createToolSlice(...a),
  ...createHistorySlice(...a),
  ...createDocumentSlice(...a),
}));

// Initialize history with initial state
useStore.setState({
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
        toolStrength: 50,
        toolHardness: 50,
        canvasRotation: 0,
        gradientType: 'linear',
        selectionMode: 'new',
        selectionFeather: 0,
        selectionAntiAlias: true,
        healingSourceMode: 'sampled',
        patchMode: 'source',
        contentAwareMoveMode: 'move',
        moveAutoSelect: true,
        moveShowTransform: false,
        textFontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'left',
      },
    },
  ],
  historyIndex: 0,
});

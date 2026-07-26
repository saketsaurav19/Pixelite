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

if (typeof window !== 'undefined') {
  (window as any).__store = useStore;
}

import { loadPreferences, savePreferences } from '../utils/preferenceStorage';

// Subscribe to preference changes and persist them
if (typeof window !== 'undefined') {
  let lastSaved = '';
  useStore.subscribe((state) => {
    const prefs = {
      visiblePanels: state.visiblePanels,
      snapSettings: state.snapSettings,
      screenMode: state.screenMode,
      rulerUnit: state.rulerUnit,
      quickMaskColor: state.quickMaskColor,
      zoomScroll: state.zoomScroll,
      glassMenus: state.glassMenus,
      cursorOffset: state.cursorOffset,
      dezgoApiKey: state.dezgoApiKey,
      showGrid: state.showGrid,
      gridColor: state.gridColor,
      gridType: state.gridType,
      gridGapX: state.gridGapX,
      gridGapY: state.gridGapY,
      gridSubdivision: state.gridSubdivision,
      showGuides: state.showGuides,
      guidesColor: state.guidesColor,
      globalGuidesColor: state.globalGuidesColor,
      interpolation: state.interpolation,
      topDockCollapsed: state.topDockCollapsed,
      adjustmentsCollapsed: state.adjustmentsCollapsed,
      bottomDockCollapsed: state.bottomDockCollapsed,
      topDockTab: state.topDockTab,
      bottomDockTab: state.bottomDockTab,
      mobileActivePanel: state.mobileActivePanel,
    };
    const json = JSON.stringify(prefs);
    if (json !== lastSaved) {
      lastSaved = json;
      savePreferences(prefs);
    }
  });
}

import { nanoid } from 'nanoid';
// Initialize history with initial state
const initialDocId = nanoid();
const initialState = {
  layers: [],
  activeLayerId: null,
  selectedLayerIds: [],
  history: [
    {
      name: 'Initial State',
      state: {
        layers: [],
        activeLayerId: null,
        selectedLayerIds: [],
        lassoPaths: [],
        selectionRect: null,
        isInverseSelection: false,
        documentSize: { w: 1920, h: 1080 },
        selectionTolerance: 32,
        selectionContiguous: true,
        slices: [],
        colorSamplers: [],
        canvasRotation: 0,
        zoom: 0.5,
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
        guidesColor: '#00ff00',
        globalGuidesColor: '#0088ff',
        gridColor: '#808080',
        gridType: 'square' as const,
        gridGapX: 105,
        gridGapY: 105,
        gridSubdivision: 4,
        interpolation: 'bilinear' as const,
        lights: [],
        isLightingEnabled: false,
        lightingQuality: 'medium' as const,
        lightingDepthScale: 200,
        ambientIntensity: 0.1,
        ambientColor: '#ffffff',
        showLightSource: true,
        colorMode: 'rgb' as const,
        bitDepth: 8 as const,
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
  penMode: 'path' as const,
  cloneSource: null,
  customPattern: null,
  cropRect: null,
  showRulers: true,
  showGrid: false,
  showGuides: true,
  guidesColor: '#00ff00',
  globalGuidesColor: '#0088ff',
  gridColor: '#808080',
        gridType: 'square' as const,
  gridGapX: 105,
  gridGapY: 105,
  gridSubdivision: 4,
  interpolation: 'bilinear' as const,
  lights: [],
  isLightingEnabled: false,
  lightingQuality: 'medium' as const,
  lightingDepthScale: 200,
  ambientIntensity: 0.1,
  ambientColor: '#ffffff',
  showLightSource: true,
  colorMode: 'rgb' as const,
  bitDepth: 8 as const,
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

const savedPrefs = typeof window !== 'undefined' ? loadPreferences() : null;

useStore.setState({
  documents: [{
    id: initialDocId,
    name: 'Untitled-1',
    state: {
      ...initialState,
      ...(savedPrefs ? {
        showGrid: savedPrefs.showGrid,
        gridColor: savedPrefs.gridColor,
        gridType: savedPrefs.gridType as any,
        gridGapX: savedPrefs.gridGapX,
        gridGapY: savedPrefs.gridGapY,
        gridSubdivision: savedPrefs.gridSubdivision,
        showGuides: savedPrefs.showGuides,
        guidesColor: savedPrefs.guidesColor,
        globalGuidesColor: savedPrefs.globalGuidesColor,
        interpolation: savedPrefs.interpolation as any,
      } : {}),
    },
  }],
  activeDocumentId: initialDocId,
  activeDocumentName: 'Untitled-1',
  ...initialState,
  ...(savedPrefs ? {
    visiblePanels: savedPrefs.visiblePanels as any,
    snapSettings: savedPrefs.snapSettings as any,
    screenMode: savedPrefs.screenMode as any,
    rulerUnit: savedPrefs.rulerUnit as any,
    quickMaskColor: savedPrefs.quickMaskColor,
    zoomScroll: savedPrefs.zoomScroll,
    glassMenus: savedPrefs.glassMenus,
    cursorOffset: savedPrefs.cursorOffset,
    dezgoApiKey: savedPrefs.dezgoApiKey,
    showGrid: savedPrefs.showGrid,
    gridColor: savedPrefs.gridColor,
    gridType: savedPrefs.gridType as any,
    gridGapX: savedPrefs.gridGapX,
    gridGapY: savedPrefs.gridGapY,
    gridSubdivision: savedPrefs.gridSubdivision,
    showGuides: savedPrefs.showGuides,
    guidesColor: savedPrefs.guidesColor,
    globalGuidesColor: savedPrefs.globalGuidesColor,
    interpolation: savedPrefs.interpolation as any,
    topDockCollapsed: savedPrefs.topDockCollapsed,
    adjustmentsCollapsed: savedPrefs.adjustmentsCollapsed,
    bottomDockCollapsed: savedPrefs.bottomDockCollapsed,
    topDockTab: savedPrefs.topDockTab as any,
    bottomDockTab: savedPrefs.bottomDockTab as any,
    mobileActivePanel: savedPrefs.mobileActivePanel as any,
  } : {}),
});

// Expose for E2E testing
if (typeof window !== 'undefined') {
  (window as any)._useStore = useStore;
}

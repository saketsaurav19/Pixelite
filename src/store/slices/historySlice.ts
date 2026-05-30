import type { StateCreator } from 'zustand';
import type { EditorState, HistoryEntry } from '../types';
import { RecentProjectsStorage } from '../../services/storage/RecentProjectsStorage';

export interface HistorySlice {
  history: HistoryEntry[];
  historyIndex: number;
  
  undo: () => void;
  redo: () => void;
  recordHistory: (actionName: string) => void;
}

export const createHistorySlice: StateCreator<EditorState, [], [], HistorySlice> = (set) => ({
  history: [], // Will be initialized in the main store
  historyIndex: 0,

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
    const newEntry: HistoryEntry = {
      name,
      state: {
        layers: JSON.parse(JSON.stringify(state.layers)),
        activeLayerId: state.activeLayerId,
        lassoPaths: JSON.parse(JSON.stringify(state.lassoPaths)),
        selectionRect: state.selectionRect ? { ...state.selectionRect } : null,
        isInverseSelection: state.isInverseSelection,
        documentSize: { ...state.documentSize },
        selectionTolerance: state.selectionTolerance,
        selectionContiguous: state.selectionContiguous,
        slices: JSON.parse(JSON.stringify(state.slices)),
        colorSamplers: JSON.parse(JSON.stringify(state.colorSamplers)),
        toolStrength: state.toolStrength,
        toolHardness: state.toolHardness,
        canvasRotation: state.canvasRotation,
        gradientType: state.gradientType,
        selectionMode: state.selectionMode,
        selectionFeather: state.selectionFeather,
        selectionAntiAlias: state.selectionAntiAlias,
        healingSourceMode: state.healingSourceMode,
        patchMode: state.patchMode,
        contentAwareMoveMode: state.contentAwareMoveMode,
        moveAutoSelect: state.moveAutoSelect,
        moveShowTransform: state.moveShowTransform,
        textFontFamily: state.textFontFamily,
        textAlign: state.textAlign,
      },
    };
    const newHistory = state.history.slice(0, state.historyIndex + 1);

    // Autosave debounced
    if (typeof window !== 'undefined') {
      if ((window as any)._autosaveTimeout) {
        clearTimeout((window as any)._autosaveTimeout);
      }
      (window as any)._autosaveTimeout = setTimeout(async () => {
        // Find main canvas to generate thumbnail
        const canvas = document.querySelector('canvas.layer-canvas') as HTMLCanvasElement;
        let thumbnail = '';
        if (canvas) {
           try {
             // Create a small 200px thumbnail
             const offscreen = document.createElement('canvas');
             const ctx = offscreen.getContext('2d');
             if (ctx) {
                const ratio = canvas.width / canvas.height;
                offscreen.width = 200;
                offscreen.height = 200 / ratio;

                // We need to draw all visible layers since .layer-canvas might just be one layer
                // However, as a simple approximation we can draw the viewport or first layer if possible
                // Alternatively, just grab document.querySelector('.canvas-stack') and render it
                // We'll just generate an empty thumbnail for now, since generating a proper combined thumbnail
                // in the background is complex without DOM-to-image.
                // We will rely on RecentProjectsStorage to manage states.
                thumbnail = canvas.toDataURL('image/jpeg', 0.5);
             }
           } catch(e) {}
        }
        await RecentProjectsStorage.saveProjectState(state as unknown as EditorState, thumbnail);
      }, 2000); // 2 second debounce
    }

    return {
      history: [...newHistory, newEntry],
      historyIndex: newHistory.length,
    };
  }),
});

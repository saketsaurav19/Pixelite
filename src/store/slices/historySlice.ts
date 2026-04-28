import type { StateCreator } from 'zustand';
import type { EditorState, HistoryEntry } from '../types';

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
    return {
      history: [...newHistory, newEntry],
      historyIndex: newHistory.length,
    };
  }),
});

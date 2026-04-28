import type { StateCreator } from 'zustand';
import type { EditorState } from '../types';

export interface SelectionSlice {
  lassoPaths: { x: number; y: number }[][];
  selectionRect: { x: number; y: number; w: number; h: number } | null;
  selectionShape: 'rect' | 'ellipse' | 'lasso';
  isInverseSelection: boolean;
  selectionTolerance: number;
  selectionContiguous: boolean;
  selectionMode: 'new' | 'add' | 'subtract' | 'intersect';
  selectionFeather: number;
  selectionAntiAlias: boolean;

  setLassoPaths: (updater: any) => void;
  setSelectionRect: (updater: any, shape?: 'rect' | 'ellipse') => void;
  setIsInverseSelection: (value: boolean) => void;
  inverseSelection: () => void;
  setSelectionTolerance: (tolerance: number) => void;
  setSelectionContiguous: (contiguous: boolean) => void;
  setSelectionMode: (mode: 'new' | 'add' | 'subtract' | 'intersect') => void;
  setSelectionFeather: (val: number) => void;
  setSelectionAntiAlias: (val: boolean) => void;
}

export const createSelectionSlice: StateCreator<EditorState, [], [], SelectionSlice> = (set, get) => ({
  lassoPaths: [],
  selectionRect: null,
  selectionShape: 'rect',
  isInverseSelection: false,
  selectionTolerance: 32,
  selectionContiguous: true,
  selectionMode: 'new',
  selectionFeather: 0,
  selectionAntiAlias: true,

  setLassoPaths: (updater) => set((state) => ({
    lassoPaths: typeof updater === 'function' ? updater(state.lassoPaths) : updater,
    selectionShape: 'lasso',
    isInverseSelection: false,
  })),

  setSelectionRect: (updater, shape) => set((state) => ({
    selectionRect: typeof updater === 'function' ? updater(state.selectionRect) : updater,
    selectionShape: shape !== undefined ? shape : state.selectionShape,
    isInverseSelection: false,
  })),

  setIsInverseSelection: (value) => set({ isInverseSelection: value }),

  inverseSelection: () => {
    const state = get();
    const { w, h } = state.documentSize;
    if (!state.selectionRect && state.lassoPaths.length === 0) {
      set({
        selectionRect: { x: 0, y: 0, w, h },
        lassoPaths: [],
        isInverseSelection: false,
      });
    } else {
      set({ isInverseSelection: !state.isInverseSelection });
    }
  },

  setSelectionTolerance: (selectionTolerance) => set({ selectionTolerance }),
  setSelectionContiguous: (selectionContiguous) => set({ selectionContiguous }),
  setSelectionMode: (selectionMode) => set({ selectionMode }),
  setSelectionFeather: (val) => set({ selectionFeather: val }),
  setSelectionAntiAlias: (val) => set({ selectionAntiAlias: val }),
});

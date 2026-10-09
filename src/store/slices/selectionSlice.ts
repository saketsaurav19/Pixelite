import type { StateCreator } from 'zustand';
import type { EditorState } from '../types';
import { normRect, offsetPolygon, chaikin, rectToPolygon, signedArea } from '../../utils/selectionModify';

export interface SelectionSlice {
  lassoPaths: { x: number; y: number }[][];
  selectionRect: { x: number; y: number; w: number; h: number } | null;
  selectionShape: 'rect' | 'ellipse' | 'lasso';
  isInverseSelection: boolean;
  selectionTolerance: number;
  selectionContiguous: boolean;
  selectionMode: 'replace' | 'subtract' | 'intersect' | 'unite';
  selectionFeather: number;
  selectionAntiAlias: boolean;

  setLassoPaths: (updater: any) => void;
  setSelectionRect: (updater: any, shape?: 'rect' | 'ellipse') => void;
  setIsInverseSelection: (value: boolean) => void;
  inverseSelection: () => void;
  setSelectionTolerance: (tolerance: number) => void;
  setSelectionContiguous: (contiguous: boolean) => void;
  setSelectionMode: (mode: 'replace' | 'subtract' | 'intersect' | 'unite') => void;
  setSelectionFeather: (val: number) => void;
  setSelectionAntiAlias: (val: boolean) => void;
  reselect: () => void;
  modifySelection: (type: 'expand' | 'contract' | 'border' | 'smooth', amount: number) => void;
  selectModifyRequest: { type: 'expand' | 'contract' | 'border' | 'smooth' | 'feather' } | null;
  openSelectModifyDialog: (type: 'expand' | 'contract' | 'border' | 'smooth' | 'feather') => void;
  closeSelectModifyDialog: () => void;
}

export const createSelectionSlice: StateCreator<EditorState, [], [], SelectionSlice> = (set, get) => ({
  lassoPaths: [],
  selectionRect: null,
  selectionShape: 'rect',
  isInverseSelection: false,
  selectionTolerance: 32,
  selectionContiguous: true,
  selectionMode: 'replace',
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
  reselect: () => set((state) => {
    return state;
  }),
  modifySelection: (type, amount) => {
    const state = get();
    const amt = Math.max(0, amount);
    const hasRect = !!state.selectionRect;
    const hasPaths = state.lassoPaths.length > 0;
    if (amt <= 0 || (!hasRect && !hasPaths)) return;
    const { w: docW, h: docH } = state.documentSize;
    const label = { expand: 'Expand Selection', contract: 'Contract Selection', border: 'Border Selection', smooth: 'Smooth Selection' }[type];

    if (type === 'expand' || type === 'contract') {
      const delta = type === 'expand' ? amt : -amt;
      if (hasRect) {
        const r = normRect(state.selectionRect!);
        const nx = Math.max(0, r.x - delta);
        const ny = Math.max(0, r.y - delta);
        const nx2 = Math.min(docW, r.x + r.w + delta);
        const ny2 = Math.min(docH, r.y + r.h + delta);
        const w = nx2 - nx;
        const h = ny2 - ny;
        if (w <= 0 || h <= 0) {
          set({ selectionRect: null, lassoPaths: [], isInverseSelection: false });
        } else {
          set({ selectionRect: { x: nx, y: ny, w, h } });
        }
      } else {
        const paths = state.lassoPaths
          .map((p) => offsetPolygon(p, delta))
          .filter((p) => p.length >= 3);
        set({ lassoPaths: paths });
      }
      state.recordHistory?.(label);
      return;
    }

    // Smooth / Border work on polygons; convert rect/ellipse selections first.
    const polys = hasRect
      ? [rectToPolygon(state.selectionRect!, state.selectionShape)]
      : state.lassoPaths;

    if (type === 'smooth') {
      const iters = Math.min(4, Math.max(1, Math.round(amt / 5)));
      const smoothed = polys.map((p) => {
        let q = p;
        for (let i = 0; i < iters; i++) q = chaikin(q);
        return q;
      });
      set({ selectionRect: null, lassoPaths: smoothed, selectionShape: 'lasso' });
      state.recordHistory?.(label);
      return;
    }

    if (type === 'border') {
      const half = amt / 2;
      const out: { x: number; y: number }[][] = [];
      for (const p of polys) {
        const outer = offsetPolygon(p, half);
        const inner = offsetPolygon(p, -half);
        if (outer.length >= 3) out.push(outer);
        // The inner path becomes a hole via evenodd clipping (see selectionUtils).
        if (inner.length >= 3 && Math.abs(signedArea(inner)) > 1) out.push(inner);
      }
      set({ selectionRect: null, lassoPaths: out, selectionShape: 'lasso' });
      state.recordHistory?.(label);
      return;
    }
  },

  selectModifyRequest: null,
  openSelectModifyDialog: (type) => set({ selectModifyRequest: { type } }),
  closeSelectModifyDialog: () => set({ selectModifyRequest: null }),
});

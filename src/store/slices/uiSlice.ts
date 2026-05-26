import { StateCreator } from 'zustand';
import type { EditorState } from '../types';

export const createUISlice: StateCreator<EditorState> = (set) => ({
  isNewDocumentDialogOpen: false,
  isExportDialogOpen: false,
  isFileInfoDialogOpen: false,

  setIsNewDocumentDialogOpen: (isOpen: boolean) => set({ isNewDocumentDialogOpen: isOpen }),
  setIsExportDialogOpen: (isOpen: boolean) => set({ isExportDialogOpen: isOpen }),
  setIsFileInfoDialogOpen: (isOpen: boolean) => set({ isFileInfoDialogOpen: isOpen }),
});

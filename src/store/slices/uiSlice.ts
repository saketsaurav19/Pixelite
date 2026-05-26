import type { StateCreator } from 'zustand';
import type { EditorState } from '../types';

export interface UISlice {
  isNewDocumentDialogOpen: boolean;
  isExportDialogOpen: boolean;
  isFileInfoDialogOpen: boolean;
  isMobileMenuOpen: boolean;
  activeMobileSubmenu: string | null;

  setIsNewDocumentDialogOpen: (isOpen: boolean) => void;
  setIsExportDialogOpen: (isOpen: boolean) => void;
  setIsFileInfoDialogOpen: (isOpen: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setActiveMobileSubmenu: (menu: string | null) => void;
}

export const createUISlice: StateCreator<EditorState, [], [], UISlice> = (set) => ({
  isNewDocumentDialogOpen: false,
  isExportDialogOpen: false,
  isFileInfoDialogOpen: false,
  isMobileMenuOpen: false,
  activeMobileSubmenu: null,

  setIsNewDocumentDialogOpen: (isOpen: boolean) => set({ isNewDocumentDialogOpen: isOpen }),
  setIsExportDialogOpen: (isOpen: boolean) => set({ isExportDialogOpen: isOpen }),
  setIsFileInfoDialogOpen: (isOpen: boolean) => set({ isFileInfoDialogOpen: isOpen }),
  setIsMobileMenuOpen: (isOpen: boolean) => set({ isMobileMenuOpen: isOpen }),
  setActiveMobileSubmenu: (menu: string | null) => set({ activeMobileSubmenu: menu }),
});

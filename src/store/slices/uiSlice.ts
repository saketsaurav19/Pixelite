import type { StateCreator } from 'zustand';
import type { EditorState } from '../types';

export interface UISlice {
  isNewDocumentDialogOpen: boolean;
  isExportDialogOpen: boolean;
  isFileInfoDialogOpen: boolean;
  isMobileMenuOpen: boolean;
  showRulers: boolean;
  rulerUnit: 'px' | 'in' | 'cm';
  activeMobileSubmenu: string | null;

  setIsNewDocumentDialogOpen: (isOpen: boolean) => void;
  setIsExportDialogOpen: (isOpen: boolean) => void;
  setIsFileInfoDialogOpen: (isOpen: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setShowRulers: (show: boolean) => void;
  setRulerUnit: (unit: 'px' | 'in' | 'cm') => void;
  setActiveMobileSubmenu: (menu: string | null) => void;
}

export const createUISlice: StateCreator<EditorState, [], [], UISlice> = (set) => ({
  isNewDocumentDialogOpen: false,
  isExportDialogOpen: false,
  isFileInfoDialogOpen: false,
  isMobileMenuOpen: false,
  showRulers: false,
  rulerUnit: 'px',
  activeMobileSubmenu: null,

  setIsNewDocumentDialogOpen: (isOpen: boolean) => set({ isNewDocumentDialogOpen: isOpen }),
  setIsExportDialogOpen: (isOpen: boolean) => set({ isExportDialogOpen: isOpen }),
  setIsFileInfoDialogOpen: (isOpen: boolean) => set({ isFileInfoDialogOpen: isOpen }),
  setIsMobileMenuOpen: (isOpen: boolean) => set({ isMobileMenuOpen: isOpen }),
  setShowRulers: (show: boolean) => set({ showRulers: show }),
  setRulerUnit: (unit: 'px' | 'in' | 'cm') => set({ rulerUnit: unit }),
  setActiveMobileSubmenu: (menu: string | null) => set({ activeMobileSubmenu: menu }),
});

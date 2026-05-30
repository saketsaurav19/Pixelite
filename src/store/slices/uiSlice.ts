import type { StateCreator } from 'zustand';
import type { EditorState, Alert } from '../types';

export interface UISlice {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  removeAlert: (id: string) => void;
  isNewDocumentDialogOpen: boolean;
  isExportDialogOpen: boolean;
  exportFormat: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | 'image/gif' | 'application/pdf';
  isFileInfoDialogOpen: boolean;
  isOpenRecentDialogOpen: boolean;
  isOpenFromCloudDialogOpen: boolean;
  isHelpDialogOpen: boolean;
  isAboutDialogOpen: boolean;
  isKeyboardShortcutsDialogOpen: boolean;
  isSystemInfoDialogOpen: boolean;
  isCameraDialogOpen: boolean;
  isMobileMenuOpen: boolean;
  showRulers: boolean;
  rulerUnit: 'px' | 'in' | 'cm';
  activeMobileSubmenu: string | null;
  screenMode: 'standard' | 'full-menu' | 'full';
  visiblePanels: {
    layers: boolean;
    history: boolean;
    properties: boolean;
    adjustments: boolean;
    navigator: boolean;
    extras: boolean;
    rulers: boolean;
    guides: boolean;
  };
  snapSettings: {
    guides: boolean;
    layers: boolean;
    documentBounds: boolean;
  };

  setIsNewDocumentDialogOpen: (isOpen: boolean) => void;
  setIsExportDialogOpen: (isOpen: boolean) => void;
  setIsFileInfoDialogOpen: (isOpen: boolean) => void;
  setIsOpenRecentDialogOpen: (isOpen: boolean) => void;
  setIsOpenFromCloudDialogOpen: (isOpen: boolean) => void;
  setIsHelpDialogOpen: (isOpen: boolean) => void;
  setIsAboutDialogOpen: (isOpen: boolean) => void;
  setIsKeyboardShortcutsDialogOpen: (isOpen: boolean) => void;
  setIsSystemInfoDialogOpen: (isOpen: boolean) => void;
  setIsCameraDialogOpen: (isOpen: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  setShowRulers: (show: boolean) => void;
  setRulerUnit: (unit: 'px' | 'in' | 'cm') => void;
  setActiveMobileSubmenu: (menu: string | null) => void;
  setScreenMode: (mode: 'standard' | 'full-menu' | 'full') => void;
  togglePanel: (panel: keyof UISlice['visiblePanels']) => void;
  setSnapSetting: (setting: keyof UISlice['snapSettings'], value: boolean) => void;
}

export const createUISlice: StateCreator<EditorState, [], [], UISlice> = (set, get) => ({
  alerts: [],
  exportFormat: 'image/png',
  isNewDocumentDialogOpen: false,
  isExportDialogOpen: false,
  isFileInfoDialogOpen: false,
  isOpenRecentDialogOpen: false,
  isOpenFromCloudDialogOpen: false,
  isHelpDialogOpen: false,
  isAboutDialogOpen: false,
  isKeyboardShortcutsDialogOpen: false,
  isSystemInfoDialogOpen: false,
  isCameraDialogOpen: false,
  isMobileMenuOpen: false,
  showRulers: false,
  rulerUnit: 'px',
  activeMobileSubmenu: null,
  screenMode: 'standard',
  visiblePanels: {
    layers: true,
    history: true,
    properties: true,
    adjustments: true,
    navigator: true,
    extras: true,
    rulers: false,
    guides: true,
  },
  snapSettings: {
    guides: true,
    layers: true,
    documentBounds: true,
  },

  setIsNewDocumentDialogOpen: (isOpen) => set({ isNewDocumentDialogOpen: isOpen }),
  setIsExportDialogOpen: (isOpen) => set({ isExportDialogOpen: isOpen }),
  setIsFileInfoDialogOpen: (isOpen) => set({ isFileInfoDialogOpen: isOpen }),
  setIsOpenRecentDialogOpen: (isOpen) => set({ isOpenRecentDialogOpen: isOpen }),
  setIsOpenFromCloudDialogOpen: (isOpen) => set({ isOpenFromCloudDialogOpen: isOpen }),
  setIsHelpDialogOpen: (isOpen) => set({ isHelpDialogOpen: isOpen }),
  setIsAboutDialogOpen: (isOpen) => set({ isAboutDialogOpen: isOpen }),
  setIsKeyboardShortcutsDialogOpen: (isOpen) => set({ isKeyboardShortcutsDialogOpen: isOpen }),
  setIsSystemInfoDialogOpen: (isOpen) => set({ isSystemInfoDialogOpen: isOpen }),
  setIsCameraDialogOpen: (isOpen) => set({ isCameraDialogOpen: isOpen }),
  setIsMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  setShowRulers: (show) => set({ showRulers: show }),
  setRulerUnit: (unit) => set({ rulerUnit: unit }),
  setActiveMobileSubmenu: (menu) => set({ activeMobileSubmenu: menu }),
  setScreenMode: (screenMode) => set({ screenMode }),
  togglePanel: (panel) => set((state) => ({
    visiblePanels: { ...state.visiblePanels, [panel]: !state.visiblePanels[panel] }
  })),
  addAlert: (alert) => {
    const id = Math.random().toString(36).substring(2, 9);
    setTimeout(() => {
      get().removeAlert(id);
    }, 3000);
    set((state) => ({ alerts: [...state.alerts, { ...alert, id }] }));
  },

  removeAlert: (id) => set((state) => ({ alerts: state.alerts.filter((a: any) => a.id !== id) })),

  setSnapSetting: (setting, value) => set((state) => ({
    snapSettings: { ...state.snapSettings, [setting]: value }
  })),
});

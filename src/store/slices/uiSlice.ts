import type { StateCreator } from 'zustand';
import type { EditorState, Alert } from '../types';

const defaultShortcuts: Record<string, string> = {
  file_new: 'Ctrl+N',
  file_open: 'Ctrl+O',
  file_save: 'Ctrl+S',
  file_print: 'Ctrl+P',
  edit_undo: 'Ctrl+Z',
  edit_redo: 'Shift+Ctrl+Z',
  edit_cut: 'Ctrl+X',
  edit_copy: 'Ctrl+C',
  edit_paste: 'Ctrl+V',
  edit_free_transform: 'Ctrl+T',
  edit_preferences: 'Ctrl+K',
  adjust_levels: 'Ctrl+L',
  adjust_curves: 'Ctrl+M',
  adjust_hue_saturation: 'Ctrl+U',
  adjust_color_balance: 'Ctrl+B',
  adjust_invert: 'Ctrl+I',
  dialog_image_size: 'Alt+Ctrl+I',
  dialog_canvas_size: 'Alt+Ctrl+C',
  view_zoom_fit: 'Ctrl+0',
  view_zoom_100: 'Ctrl+1',
  view_rulers: 'Ctrl+R',
};

export interface UISlice {
  alerts: Alert[];
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  removeAlert: (id: string) => void;
  isNewDocumentDialogOpen: boolean;
  isCanvasSizeDialogOpen: boolean;
  isImageSizeDialogOpen: boolean;
  isContentAwareScaleDialogOpen: boolean;
  isFilterGalleryDialogOpen: boolean;
  filterGallerySelectedType: string;
  isLayerStyleDialogOpen: boolean;
  layerStyleActiveTab: 'blending' | 'shadow' | 'stroke';
  isColorRangeDialogOpen: boolean;
  isTransformSelectionDialogOpen: boolean;
  documentLayout: 'tabs' | 'cascade' | 'tile' | 'float';
  isExportDialogOpen: boolean;
  exportFormat: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | 'image/gif' | 'application/pdf';
  isFileInfoDialogOpen: boolean;
  isWarpDialogOpen: boolean;
  isOpenRecentDialogOpen: boolean;
  isPreferencesDialogOpen: boolean;
  isOpenFromCloudDialogOpen: boolean;
  quickMaskColor: string;
  zoomScroll: boolean;
  glassMenus: boolean;
  cursorOffset: number;
  dezgoApiKey: string;
  isHelpDialogOpen: boolean;
  isAboutDialogOpen: boolean;
  isKeyboardShortcutsDialogOpen: boolean;
  isPrecisionFillDialogOpen: boolean;
  setIsPrecisionFillDialogOpen: (isOpen: boolean) => void;
  isServerlessShareDialogOpen: boolean;
  serverlessShareTab: 'url' | 'webrtc' | 'public';
  setIsServerlessShareDialogOpen: (isOpen: boolean, tab?: 'url' | 'webrtc' | 'public') => void;
  shortcuts: Record<string, string>;
  setShortcut: (commandId: string, shortcutString: string) => void;
  isSystemInfoDialogOpen: boolean;
  isCameraDialogOpen: boolean;
  isSignatureDialogOpen: boolean;
  mobileCapturedImage: string | null;
  isMobileMenuOpen: boolean;
  showRulers: boolean;
  rulerUnit: 'px' | 'in' | 'cm';
  activeAdjustmentModal: 'brightness_contrast' | 'hue_saturation' | 'black_white' | 'photo_effects' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'color_balance' | 'channel_mixer' | 'color_lookup' | null;
  setActiveAdjustmentModal: (modal: 'brightness_contrast' | 'hue_saturation' | 'black_white' | 'photo_effects' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'color_balance' | 'channel_mixer' | 'color_lookup' | null) => void;
  adjustmentSourceLayerId: string | null;
  setAdjustmentSourceLayerId: (id: string | null) => void;
  activeMobileSubmenu: string | null;
  screenMode: 'standard' | 'full-menu' | 'full';
  visibleChannels: { r: boolean; g: boolean; b: boolean };
  selectedChannel: 'RGB' | 'r' | 'g' | 'b';
  toggleChannelVisibility: (channel: 'r' | 'g' | 'b') => void;
  setSelectedChannel: (channel: 'RGB' | 'r' | 'g' | 'b') => void;
  visiblePanels: {
    layers: boolean;
    history: boolean;
    properties: boolean;
    adjustments: boolean;
    navigator: boolean;
    extras: boolean;
    rulers: boolean;
    guides: boolean;
    swatches: boolean;
    channels: boolean;
    paths: boolean;
  };
  snapSettings: {
    guides: boolean;
    layers: boolean;
    documentBounds: boolean;
  };

  // Panel collapse & tab states (persisted)
  topDockCollapsed: boolean;
  adjustmentsCollapsed: boolean;
  bottomDockCollapsed: boolean;
  topDockTab: 'history' | 'swatches';
  bottomDockTab: 'layers' | 'channels' | 'paths';
  mobileActivePanel: 'layers' | 'adjustments' | 'history';

  setTopDockCollapsed: (val: boolean) => void;
  setAdjustmentsCollapsed: (val: boolean) => void;
  setBottomDockCollapsed: (val: boolean) => void;
  setTopDockTab: (tab: 'history' | 'swatches') => void;
  setBottomDockTab: (tab: 'layers' | 'channels' | 'paths') => void;
  setMobileActivePanel: (panel: 'layers' | 'adjustments' | 'history') => void;

  setIsNewDocumentDialogOpen: (isOpen: boolean) => void;
  setIsCanvasSizeDialogOpen: (isOpen: boolean) => void;
  setIsImageSizeDialogOpen: (isOpen: boolean) => void;
  setIsContentAwareScaleDialogOpen: (isOpen: boolean) => void;
  setIsFilterGalleryDialogOpen: (isOpen: boolean) => void;
  setFilterGallerySelectedType: (type: string) => void;
  setIsLayerStyleDialogOpen: (isOpen: boolean) => void;
  setLayerStyleActiveTab: (tab: 'blending' | 'shadow' | 'stroke') => void;
  setIsColorRangeDialogOpen: (isOpen: boolean) => void;
  setIsTransformSelectionDialogOpen: (isOpen: boolean) => void;
  setDocumentLayout: (layout: 'tabs' | 'cascade' | 'tile' | 'float') => void;
  setWorkspace: (workspace: 'essentials' | 'photography' | 'graphic-web') => void;
  setIsExportDialogOpen: (isOpen: boolean) => void;
  setExportFormat: (format: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/svg+xml' | 'image/gif' | 'application/pdf') => void;
  setIsFileInfoDialogOpen: (isOpen: boolean) => void;
  setIsWarpDialogOpen: (isOpen: boolean) => void;
  setIsOpenRecentDialogOpen: (isOpen: boolean) => void;
  setIsPreferencesDialogOpen: (isOpen: boolean) => void;
  setIsOpenFromCloudDialogOpen: (isOpen: boolean) => void;
  setQuickMaskColor: (color: string) => void;
  setZoomScroll: (val: boolean) => void;
  setGlassMenus: (val: boolean) => void;
  setCursorOffset: (val: number) => void;
  setDezgoApiKey: (key: string) => void;
  setIsHelpDialogOpen: (isOpen: boolean) => void;
  setIsAboutDialogOpen: (isOpen: boolean) => void;
  setIsKeyboardShortcutsDialogOpen: (isOpen: boolean) => void;
  setIsSystemInfoDialogOpen: (isOpen: boolean) => void;
  setIsCameraDialogOpen: (isOpen: boolean) => void;
  setIsSignatureDialogOpen: (isOpen: boolean) => void;
  setMobileCapturedImage: (image: string | null) => void;
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
  isCanvasSizeDialogOpen: false,
  isImageSizeDialogOpen: false,
  isContentAwareScaleDialogOpen: false,
  isFilterGalleryDialogOpen: false,
  filterGallerySelectedType: 'gaussian_blur',
  isLayerStyleDialogOpen: false,
  layerStyleActiveTab: 'blending',
  isColorRangeDialogOpen: false,
  isTransformSelectionDialogOpen: false,
  documentLayout: 'tabs',
  isExportDialogOpen: false,
  isFileInfoDialogOpen: false,
  isWarpDialogOpen: false,
  isOpenRecentDialogOpen: false,
  isPreferencesDialogOpen: false,
  isOpenFromCloudDialogOpen: false,
  quickMaskColor: '#000000',
  zoomScroll: false,
  glassMenus: false,
  cursorOffset: 0,
  dezgoApiKey: '',
  isHelpDialogOpen: false,
  isAboutDialogOpen: false,
  isKeyboardShortcutsDialogOpen: false,
  shortcuts: (() => {
    try {
      const saved = localStorage.getItem('pixelite_shortcuts');
      if (saved) {
        return { ...defaultShortcuts, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load shortcuts', e);
    }
    return defaultShortcuts;
  })(),
  isSystemInfoDialogOpen: false,
  isCameraDialogOpen: false,
  isSignatureDialogOpen: false,
  mobileCapturedImage: null,
  isMobileMenuOpen: false,
  showRulers: false,
  rulerUnit: 'px',
  activeAdjustmentModal: null,
  adjustmentSourceLayerId: null,
  activeMobileSubmenu: null,
  screenMode: 'standard',
  visibleChannels: { r: true, g: true, b: true },
  selectedChannel: 'RGB',
  visiblePanels: {
    layers: true,
    history: true,
    properties: true,
    adjustments: true,
    navigator: true,
    extras: true,
    rulers: false,
    guides: true,
    swatches: true,
    channels: true,
    paths: true,
  },
  snapSettings: {
    guides: true,
    layers: true,
    documentBounds: true,
  },

  topDockCollapsed: false,
  adjustmentsCollapsed: false,
  bottomDockCollapsed: false,
  topDockTab: 'history',
  bottomDockTab: 'layers',
  mobileActivePanel: 'layers',

  setIsNewDocumentDialogOpen: (isOpen) => set({ isNewDocumentDialogOpen: isOpen }),
  setIsCanvasSizeDialogOpen: (isOpen) => set({ isCanvasSizeDialogOpen: isOpen }),
  setIsImageSizeDialogOpen: (isOpen) => set({ isImageSizeDialogOpen: isOpen }),
  setIsContentAwareScaleDialogOpen: (isOpen) => set({ isContentAwareScaleDialogOpen: isOpen }),
  setIsFilterGalleryDialogOpen: (isOpen) => set({ isFilterGalleryDialogOpen: isOpen }),
  setFilterGallerySelectedType: (type) => set({ filterGallerySelectedType: type }),
  setIsLayerStyleDialogOpen: (isOpen) => set({ isLayerStyleDialogOpen: isOpen }),
  setLayerStyleActiveTab: (tab) => set({ layerStyleActiveTab: tab }),
  setIsColorRangeDialogOpen: (isOpen) => set({ isColorRangeDialogOpen: isOpen }),
  setIsTransformSelectionDialogOpen: (isOpen) => set({ isTransformSelectionDialogOpen: isOpen }),
  setDocumentLayout: (layout) => set({ documentLayout: layout }),
  setWorkspace: (workspace) => set((state) => {
    let visible = { ...state.visiblePanels };
    if (workspace === 'essentials') {
      visible = {
        layers: true,
        history: true,
        properties: false,
        adjustments: true,
        navigator: true,
        extras: false,
        rulers: true,
        guides: true,
        swatches: true,
        channels: false,
        paths: false
      };
    } else if (workspace === 'photography') {
      visible = {
        layers: true,
        history: false,
        properties: true,
        adjustments: true,
        navigator: true,
        extras: false,
        rulers: false,
        guides: false,
        swatches: false,
        channels: true,
        paths: false
      };
    } else if (workspace === 'graphic-web') {
      visible = {
        layers: true,
        history: true,
        properties: true,
        adjustments: false,
        navigator: false,
        extras: true,
        rulers: true,
        guides: true,
        swatches: true,
        channels: false,
        paths: true
      };
    }
    setTimeout(() => {
      get().addAlert({
        type: 'success',
        message: `Workspace changed to ${workspace === 'graphic-web' ? 'Graphic and Web' : workspace.charAt(0).toUpperCase() + workspace.slice(1)}.`
      });
    }, 0);
    return { visiblePanels: visible };
  }),
  setIsExportDialogOpen: (isOpen) => set({ isExportDialogOpen: isOpen }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setIsFileInfoDialogOpen: (isOpen) => set({ isFileInfoDialogOpen: isOpen }),
  setIsWarpDialogOpen: (isOpen) => set({ isWarpDialogOpen: isOpen }),
  setIsOpenRecentDialogOpen: (isOpen) => set({ isOpenRecentDialogOpen: isOpen }),
  setIsPreferencesDialogOpen: (isOpen) => set({ isPreferencesDialogOpen: isOpen }),
  setIsOpenFromCloudDialogOpen: (isOpen) => set({ isOpenFromCloudDialogOpen: isOpen }),
  setQuickMaskColor: (quickMaskColor) => set({ quickMaskColor }),
  setZoomScroll: (zoomScroll) => set({ zoomScroll }),
  setGlassMenus: (glassMenus) => set({ glassMenus }),
  setCursorOffset: (cursorOffset) => set({ cursorOffset }),
  setDezgoApiKey: (dezgoApiKey) => set({ dezgoApiKey }),
  setIsHelpDialogOpen: (isOpen) => set({ isHelpDialogOpen: isOpen }),
  setIsAboutDialogOpen: (isOpen) => set({ isAboutDialogOpen: isOpen }),
  setIsKeyboardShortcutsDialogOpen: (isOpen) => set({ isKeyboardShortcutsDialogOpen: isOpen }),
  isPrecisionFillDialogOpen: false,
  setIsPrecisionFillDialogOpen: (isOpen) => set({ isPrecisionFillDialogOpen: isOpen }),
  isServerlessShareDialogOpen: false,
  serverlessShareTab: 'url',
  setIsServerlessShareDialogOpen: (isOpen, tab = 'url') => set({ isServerlessShareDialogOpen: isOpen, serverlessShareTab: tab }),
  setShortcut: (commandId, shortcutString) => set((state) => {
    const updated = { ...state.shortcuts, [commandId]: shortcutString };
    try {
      localStorage.setItem('pixelite_shortcuts', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save shortcuts', e);
    }
    return { shortcuts: updated };
  }),
  setIsSystemInfoDialogOpen: (isOpen) => set({ isSystemInfoDialogOpen: isOpen }),
  setIsCameraDialogOpen: (isOpen) => set({ isCameraDialogOpen: isOpen }),
  setIsSignatureDialogOpen: (isOpen) => set({ isSignatureDialogOpen: isOpen }),
  setMobileCapturedImage: (image) => set({ mobileCapturedImage: image }),
  setIsMobileMenuOpen: (isOpen) => set({ isMobileMenuOpen: isOpen }),
  setShowRulers: (show) => set({ showRulers: show }),
  setRulerUnit: (unit) => set({ rulerUnit: unit }),
  setActiveAdjustmentModal: (modal) => set((state) => ({
    activeAdjustmentModal: modal,
    adjustmentSourceLayerId: modal ? (state.adjustmentSourceLayerId || state.activeLayerId) : null
  })),
  setAdjustmentSourceLayerId: (id) => set({ adjustmentSourceLayerId: id }),
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

  toggleChannelVisibility: (channel) => set((state) => ({
    visibleChannels: {
      ...state.visibleChannels,
      [channel]: !state.visibleChannels[channel]
    }
  })),

  setSelectedChannel: (channel) => set({ selectedChannel: channel }),

  setSnapSetting: (setting, value) => set((state) => ({
    snapSettings: { ...state.snapSettings, [setting]: value }
  })),

  setTopDockCollapsed: (val) => set({ topDockCollapsed: val }),
  setAdjustmentsCollapsed: (val) => set({ adjustmentsCollapsed: val }),
  setBottomDockCollapsed: (val) => set({ bottomDockCollapsed: val }),
  setTopDockTab: (tab) => set({ topDockTab: tab }),
  setBottomDockTab: (tab) => set({ bottomDockTab: tab }),
  setMobileActivePanel: (panel) => set({ mobileActivePanel: panel }),
});

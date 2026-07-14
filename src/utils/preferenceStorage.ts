const STORAGE_KEY = 'pixelite_preferences';

export interface PersistedPreferences {
  visiblePanels: Record<string, boolean>;
  snapSettings: Record<string, boolean>;
  screenMode: string;
  rulerUnit: string;
  quickMaskColor: string;
  zoomScroll: boolean;
  glassMenus: boolean;
  cursorOffset: number;
  dezgoApiKey: string;
  showGrid: boolean;
  gridColor: string;
  gridType: string;
  gridGapX: number;
  gridGapY: number;
  gridSubdivision: number;
  showGuides: boolean;
  guidesColor: string;
  globalGuidesColor: string;
  interpolation: string;
  topDockCollapsed: boolean;
  adjustmentsCollapsed: boolean;
  bottomDockCollapsed: boolean;
  topDockTab: string;
  bottomDockTab: string;
  mobileActivePanel: string;
}

const defaultPreferences: PersistedPreferences = {
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
  snapSettings: { guides: true, layers: true, documentBounds: true },
  screenMode: 'standard',
  rulerUnit: 'px',
  quickMaskColor: '#000000',
  zoomScroll: false,
  glassMenus: false,
  cursorOffset: 0,
  dezgoApiKey: '',
  showGrid: false,
  gridColor: '#808080',
  gridType: 'square',
  gridGapX: 105,
  gridGapY: 105,
  gridSubdivision: 4,
  showGuides: true,
  guidesColor: '#00ff00',
  globalGuidesColor: '#0088ff',
  interpolation: 'bilinear',
  topDockCollapsed: false,
  adjustmentsCollapsed: false,
  bottomDockCollapsed: false,
  topDockTab: 'history',
  bottomDockTab: 'layers',
  mobileActivePanel: 'layers',
};

export function loadPreferences(): PersistedPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...defaultPreferences, ...parsed };
    }
  } catch {
  }
  return { ...defaultPreferences };
}

export function savePreferences(prefs: Partial<PersistedPreferences>) {
  try {
    const current = loadPreferences();
    const merged = { ...current, ...prefs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
  }
}

export function resetPreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

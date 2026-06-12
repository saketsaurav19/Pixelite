export type Tool =
  | 'move' | 'artboard' | 'marquee' | 'ellipse_marquee' | 'lasso' | 'polygonal_lasso' | 'magnetic_lasso'
  | 'quick_selection' | 'magic_wand' | 'object_selection' | 'crop' | 'perspective_crop' | 'slice' | 'slice_select'
  | 'eyedropper' | 'color_sampler' | 'ruler' | 'healing' | 'healing_brush' | 'patch' | 'content_aware_move' | 'red_eye'
  | 'brush' | 'pencil' | 'color_replacement' | 'mixer_brush' | 'history_brush' | 'art_history_brush' | 'clone' | 'pattern_stamp'
  | 'eraser' | 'background_eraser' | 'magic_eraser' | 'rectangle_eraser' | 'lasso_eraser' | 'gradient' | 'paint_bucket'
  | 'blur' | 'sharpen' | 'smudge' | 'dodge' | 'burn' | 'sponge' | 'text' | 'vertical_text' | 'pen' | 'free_pen'
  | 'curvature_pen' | 'add_anchor' | 'delete_anchor' | 'convert_point' | 'path_select' | 'direct_select'
  | 'shape' | 'ellipse_shape' | 'triangle_shape' | 'polygon_shape' | 'line_shape' | 'custom_shape'
  | 'hand' | 'rotate_view' | 'zoom_tool' | 'lighting';

export type BlendMode = GlobalCompositeOperation | 'pass through';

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  dataUrl?: string;
  type?: 'image' | 'paint' | 'text' | 'shape' | 'group' | 'layer' | 'artboard';
  blendMode: BlendMode;
  position?: { x: number; y: number };
}

export type Layer = BaseLayer & {
  type: 'image' | 'paint' | 'text' | 'shape' | 'group' | 'artboard';
  width?: number;
  height?: number;
  children?: Layer[];
  collapsed?: boolean;

  // Artboard properties
  backgroundColor?: string;
  backgroundTransparent?: boolean;
  exportSettings?: any;
  clippingEnabled?: boolean;
  dpi?: number;
  guides?: any[];

  // LayerData fields directly on Layer for easier migration
  dataUrl?: string;
  textContent?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  isVertical?: boolean;
  shapeData?: {
    type: 'rect' | 'path' | 'ellipse';
    w?: number; h?: number;
    points?: { x: number; y: number }[];
    fill: string; stroke: string; strokeWidth: number;
    smooth?: boolean;
    closed?: boolean;
    cornerRadius?: number;
    svgPath?: string;
  };
  thumbnail?: string;
  depthMap?: string; // Data URL of the depth map
  normalMap?: string; // Data URL of the normal map
  position: { x: number; y: number };
};

export interface Light {
  id: string;
  name?: string;
  type: 'point' | 'spot' | 'area';
  position: { x: number; y: number; z: number };
  intensity: number;
  color: string; // Hex color
  radius: number;
  falloff: 'linear' | 'quadratic';
  direction?: { x: number; y: number; z: number };
  angle?: number;
  distance?: number; // Orbital distance for cinematic positioning
  visible: boolean;
}

export interface DocumentSpecificState {
  layers: Layer[];
  activeLayerId: string | null;
  history: HistoryEntry[];
  historyIndex: number;
  documentSize: { w: number; h: number };
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  lassoPaths: { x: number; y: number }[][];
  selectionRect: { x: number; y: number; w: number; h: number } | null;
  isInverseSelection: boolean;
  selectionTolerance: number;
  selectionContiguous: boolean;
  slices: { id: string; rect: { x: number; y: number; w: number; h: number } }[];
  colorSamplers: { id: string; x: number; y: number; color: string }[];
  rulerData: { start: { x: number; y: number }; end: { x: number; y: number } } | null;
  vectorPaths: { points: { x: number; y: number }[]; closed: boolean; smooth?: boolean }[];
  activePathIndex: number | null;
  penMode: 'path' | 'shape';
  cloneSource: { x: number; y: number } | null;
  customPattern: string | null;
  cropRect: { x: number; y: number; w: number; h: number } | null;
  showRulers: boolean;
  showGrid: boolean;
  showGuides: boolean;
  lights: Light[];
  isLightingEnabled: boolean;
  lightingQuality: 'low' | 'medium' | 'high';
  lightingDepthScale: number;
  ambientIntensity: number;
  ambientColor: string;
  showLightSource: boolean;
  workflow: {
    step: 'image' | 'depth' | 'simulation' | 'refinement' | 'output';
    status: Record<'image' | 'depth' | 'simulation' | 'refinement' | 'output', 'pending' | 'completed' | 'error' | 'loading'>;
  };
}

export interface DocumentArchive {
  id: string;
  name: string;
  state: DocumentSpecificState;
}

export interface HistoryEntry {
  name: string;
  state: Omit<DocumentSpecificState, 'history' | 'historyIndex'>;
}

export interface EditorState extends DocumentSpecificState {
  // Global App State
  documents: DocumentArchive[];
  activeDocumentId: string;
  activeDocumentName: string;

  // Tool State
  activeTool: Tool;
  activeToolVariants: Record<string, Tool>;
  brushSize: number;
  strokeWidth: number;
  brushColor: string;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  toolStrength: number;
  toolHardness: number;
  toningRange: 'shadows' | 'midtones' | 'highlights';
  spongeMode: 'desaturate' | 'saturate';
  redEyePupilSize: number;
  redEyeDarkenAmount: number;
  isTyping: boolean;
  cornerRadius: number;
  polygonSides: number;
  starPoints: number;
  starInnerRadius: number;
  selectionFeather: number;
  selectionAntiAlias: boolean;
  gradientType: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
  healingSourceMode: 'sampled' | 'pattern';
  patchMode: 'source' | 'destination';
  contentAwareMoveMode: 'move' | 'extend';
  moveAutoSelect: boolean;
  moveShowTransform: boolean;
  textFontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  textEditor: { x: number; y: number; value: string } | null;
  selectionShape: 'rect' | 'ellipse' | 'lasso';
  selectionMode: 'new' | 'add' | 'subtract' | 'intersect';

  clipboardDataUrl: string | null;
  exifData: any;
  iccProfile: string;

  // UI State
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
  isMobileMenuOpen: boolean;
  isCameraDialogOpen: boolean;
  mobileCapturedImage: string | null;
  rulerUnit: 'px' | 'in' | 'cm';
  setRulerUnit: (unit: 'px' | 'in' | 'cm') => void;
  setShowRulers: (show: boolean) => void;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  activeMobileSubmenu: string | null;
  setActiveMobileSubmenu: (menu: string | null) => void;
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

  // Actions - These will be defined in slices
  [key: string]: any;
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
}

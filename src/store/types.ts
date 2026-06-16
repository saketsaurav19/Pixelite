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

export interface TextRun {
  str: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  strokeColor?: string;
  opacity?: number;
  x: number;
  y: number;
  rotation?: number;
}

export interface BaseLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  lockPixels?: boolean;
  lockPosition?: boolean;
  lockTransparent?: boolean;
  opacity: number;
  fill?: number;
  dataUrl?: string;
  type?: 'image' | 'paint' | 'text' | 'shape' | 'group' | 'layer' | 'artboard' | 'table';
  blendMode: BlendMode;
  position?: { x: number; y: number };
}

export interface AnnotationData {
  id: string;
  subtype: string;
  rect: number[];
  url?: string;
  contents?: string;
  fieldName?: string;
  fieldValue?: any;
  color?: string;
  fieldType?: string;
  alternativeText?: string;
  multiLine?: boolean;
  options?: { value: string; displayValue: string }[];
  exportValue?: string;
}

export type Layer = BaseLayer & {
  type: 'image' | 'paint' | 'text' | 'shape' | 'group' | 'artboard' | 'table';
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
  depthMap?: string;
  normalMap?: string;
  position: { x: number; y: number };

  // PDF extraction fields
  rotation?: number;           // CSS rotation in degrees (from text/image transform)
  fontWeight?: string;         // 'normal' | 'bold' | '100'–'900'
  fontFamily?: string;         // resolved font family
  isWatermark?: boolean;       // detected watermark element
  runs?: TextRun[];            // per-character-run style data for exact font rendering
  annotations?: AnnotationData[]; // embedded PDF annotations on this layer
  /** HarfBuzz per-cluster positions for correct complex-script span layout. */
  shapedPositions?: Array<{ text: string; x: number; xAdvance: number; direction: 'ltr' | 'rtl' }>;
  fontChecksum?: string;
  fontName?: string;
  pdfMetadata?: {              // document-level metadata (on page artboard)
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
  // PDF table data — rendered as HTML <table> in CanvasLayer
  tableData?: {
    x: number; y: number;
    width: number; height: number;
    rows: number; cols: number;
    rowHeights: number[];
    colWidths: number[];
    cells: Array<{
      row: number; col: number;
      x: number; y: number;
      width: number; height: number;
      text: string;
      fontSize: number;
      fontWeight: string;
      fontFamily: string;
      color: string;
      textAlign: 'left' | 'center' | 'right';
    }>;
  };
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
  textEditor: { x: number; y: number; value: string; layerId?: string } | null;
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
  isSignatureDialogOpen: boolean;
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
    swatches: boolean;
    channels: boolean;
    paths: boolean;
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

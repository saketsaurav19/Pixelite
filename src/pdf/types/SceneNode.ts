export type SceneNodeType = 'page' | 'group' | 'path' | 'image' | 'text' | 'mask' | 'table';

export interface SceneNodeTransform {
  a: number; // m11 (scale X / cos rotation)
  b: number; // m12 (sin rotation)
  c: number; // m21 (-sin rotation)
  d: number; // m22 (scale Y / cos rotation)
  e: number; // tx (translate X)
  f: number; // ty (translate Y)
}

export interface Point {
  x: number;
  y: number;
}

export interface PathSegment {
  type: 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'closePath';
  points: Point[];
}

export interface PathGeometry {
  segments: PathSegment[];
  isClosed: boolean;
}

export interface ShapeStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;       // fill opacity (0–1)
  strokeOpacity?: number; // stroke opacity (0–1)
  blendMode?: string;     // CSS blend mode string
  lineCap?: 'butt' | 'round' | 'square';
  lineJoin?: 'miter' | 'round' | 'bevel';
  miterLimit?: number;
  lineDashPattern?: number[];
  lineDashPhase?: number;
}

export interface TextRun {
  str: string;
  fontSize: number;
  fontFamily?: string;
  fontWeight?: string;    // 'normal' | 'bold' | '100'–'900'
  color?: string;         // CSS fill color
  strokeColor?: string;   // CSS stroke color
  opacity?: number;       // fill opacity (0–1)
  x: number;
  y: number;
  rotation?: number;      // degrees, from transform matrix
}

import type { TextCluster } from '../../pdf/worker/engines/WasmShaper';

export interface TextGeometry {
  text: string;           // merged full string (for compat)
  fontSize: number;       // dominant font size of the run group
  fontFamily?: string;    // dominant font family
  fontWeight?: string;    // 'normal' | 'bold'
  color?: string;         // dominant fill color
  strokeColor?: string;
  opacity?: number;       // dominant opacity
  rotation?: number;      // degrees — from the text matrix
  isWatermark?: boolean;  // true if detected as a watermark element
  runs?: TextRun[];       // per-character-run rich data
  /** HarfBuzz per-cluster positions for correct complex-script span layout. */
  shapedPositions?: TextCluster[];
  fontChecksum?: string;
  fontName?: string;
}

export interface ImageGeometry {
  dataUrl: string;        // Base64 encoded or blob URL
  width: number;
  height: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;       // authoring tool
  producer?: string;      // PDF producer
  createdAt?: string;
  modifiedAt?: string;
}

export interface AnnotationData {
  id: string;
  subtype: string;        // 'Link' | 'Text' | 'Widget' | 'Stamp' | ...
  rect: number[];         // [x1, y1, x2, y2] in page space
  url?: string;           // for Link annotations
  contents?: string;      // for Text (comment) annotations
  fieldName?: string;     // for Widget (form) annotations
  fieldValue?: any;       // current form field value
  color?: string;         // annotation color if set
  fieldType?: string;     // 'Tx' | 'Btn' | 'Ch' etc
  alternativeText?: string;
  multiLine?: boolean;
  options?: { value: string; displayValue: string }[];
  exportValue?: string;
}

export interface BaseSceneNode {
  id: string;
  type: SceneNodeType;
  name: string;
  transform: SceneNodeTransform;
  children?: SceneNode[];
  clipPath?: SceneNode;   // Reference to a path node used as a mask
  opacity: number;
  blendMode: string;
  visible: boolean;
  locked: boolean;
}

export interface PageNode extends BaseSceneNode {
  type: 'page';
  width: number;
  height: number;
  annotations?: AnnotationData[];
}

export interface GroupNode extends BaseSceneNode {
  type: 'group';
}

export interface PathNode extends BaseSceneNode {
  type: 'path';
  geometry: PathGeometry;
  style: ShapeStyle;
}

export interface ImageNode extends BaseSceneNode {
  type: 'image';
  geometry: ImageGeometry;
}

export interface TextNode extends BaseSceneNode {
  type: 'text';
  geometry: TextGeometry;
  style: ShapeStyle;
}

export interface MaskNode extends BaseSceneNode {
  type: 'mask';
  geometry: PathGeometry;
}

// ─── Table types ─────────────────────────────────────────────────────────────

export interface TableCell {
  row: number;
  col: number;
  x: number;          // left edge in screen px (absolute on page)
  y: number;          // top edge in screen px
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  rowSpan?: number;
  colSpan?: number;
}

export interface TableData {
  x: number;           // table left in screen px
  y: number;           // table top in screen px
  width: number;
  height: number;
  rows: number;
  cols: number;
  cells: TableCell[];
  rowHeights: number[];
  colWidths: number[];
}

export interface TableNode extends BaseSceneNode {
  type: 'table';
  tableData: TableData;
}

export type SceneNode = PageNode | GroupNode | PathNode | ImageNode | TextNode | MaskNode | TableNode;

export interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  nodes: SceneNode[];
}


export type SceneNodeType = 'page' | 'group' | 'path' | 'image' | 'text' | 'mask';

export interface SceneNodeTransform {
  a: number; // m11
  b: number; // m12
  c: number; // m21
  d: number; // m22
  e: number; // tx
  f: number; // ty
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
  opacity?: number;
  blendMode?: string;
}

export interface TextGeometry {
  text: string;
  fontSize: number;
  fontFamily?: string;
}

export interface ImageGeometry {
  dataUrl: string; // Base64 encoded or blob URL
  width: number;
  height: number;
}

export interface BaseSceneNode {
  id: string;
  type: SceneNodeType;
  name: string;
  transform: SceneNodeTransform;
  children?: SceneNode[];
  clipPath?: SceneNode; // Reference to a path node used as a mask
  opacity: number;
  blendMode: string;
  visible: boolean;
  locked: boolean;
}

export interface PageNode extends BaseSceneNode {
  type: 'page';
  width: number;
  height: number;
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

export type SceneNode = PageNode | GroupNode | PathNode | ImageNode | TextNode | MaskNode;

export interface PageData {
  pageIndex: number;
  width: number;
  height: number;
  nodes: SceneNode[];
}

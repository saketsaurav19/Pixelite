import type { SceneNode, PageData } from './SceneNode';

export interface PdfEngineAdapter {
  loadDocument(data: ArrayBuffer): Promise<void>;
  getPages(): Promise<PageData[]>;
  extractObjects(pageIndex: number): Promise<SceneNode[]>;
  closeDocument(): Promise<void>;
}

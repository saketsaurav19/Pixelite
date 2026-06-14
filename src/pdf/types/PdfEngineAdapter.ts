import type { SceneNode, PageData, DocumentMetadata, AnnotationData } from './SceneNode';

export interface PdfEngineAdapter {
  loadDocument(data: ArrayBuffer): Promise<void>;
  getPages(): Promise<PageData[]>;
  extractObjects(pageIndex: number): Promise<SceneNode[]>;
  closeDocument(): Promise<void>;
  renderPageToDataUrl?(
    pageIndex: number,
    scale?: number,
    options?: {
      includeText?: boolean;
      includeImages?: boolean;
      includeVectors?: boolean;
    }
  ): Promise<string>;
  extractMetadata?(): Promise<DocumentMetadata>;
  extractAnnotations?(pageIndex: number, pageHeight: number): Promise<AnnotationData[]>;
}

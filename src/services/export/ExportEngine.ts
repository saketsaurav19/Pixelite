import { FileSystemService } from '../file/FileSystemService';

export interface ExportOptions {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
  flatten?: boolean;
}

export class ExportEngine {
  /**
   * Basic raster export using browser native APIs.
   * In a full implementation, this would orchestrate WorkerExportBridge, RasterExportService, etc.
   */
  static async exportCanvas(
    canvas: HTMLCanvasElement,
    options: ExportOptions
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // If resizing is needed, we would use OffscreenCanvas or a temporary canvas here.
      // For now, basic export.
      try {
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          },
          options.format,
          options.quality ?? 0.92
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  static async downloadExport(canvas: HTMLCanvasElement, options: ExportOptions) {
    const blob = await this.exportCanvas(canvas, options);
    const ext = options.format === 'image/jpeg' ? 'jpg' : options.format.split('/')[1];
    const filename = options.filename || `export.${ext}`;
    FileSystemService.downloadBlob(blob, filename);
  }
}

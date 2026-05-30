import { FileSystemService } from '../file/FileSystemService';

import piexif from 'piexifjs';

export interface ExportOptions {
  format: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  width?: number;
  height?: number;
  filename?: string;
  flatten?: boolean;
  exifData?: any;
  iccProfile?: string;
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
    let blob = await this.exportCanvas(canvas, options);
    const ext = options.format === 'image/jpeg' ? 'jpg' : options.format.split('/')[1];
    const filename = options.filename || `export.${ext}`;

    if (options.format === 'image/jpeg' && options.exifData) {
      try {
        const reader = new FileReader();
        const blobWithExif = await new Promise<Blob>((resolve) => {
          reader.onload = (e) => {
            if (e.target?.result && typeof e.target.result === 'string') {
              try {
                const exifStr = piexif.dump(options.exifData);
                const newJpeg = piexif.insert(exifStr, e.target.result);

                // Convert back to blob
                const byteString = atob(newJpeg.split(',')[1]);
                const mimeString = newJpeg.split(',')[0].split(':')[1].split(';')[0];
                const ab = new ArrayBuffer(byteString.length);
                const ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) {
                    ia[i] = byteString.charCodeAt(i);
                }
                resolve(new Blob([ab], { type: mimeString }));
              } catch (exifErr) {
                console.warn("Failed to inject EXIF data", exifErr);
                resolve(blob); // fallback to original
              }
            } else {
               resolve(blob);
            }
          };
          reader.onerror = () => resolve(blob);
          reader.readAsDataURL(blob);
        });
        blob = blobWithExif;
      } catch (e) {
        console.warn("EXIF processing error", e);
      }
    }

    FileSystemService.downloadBlob(blob, filename);
  }
}

export interface ImportResult {
  name: string;
  type: 'image' | 'psd';
  dataUrl?: string; // For images
  // For PSDs, we might return parsed layer data
  psdData?: any;
  width: number;
  height: number;
}

export class ImportEngine {
  /**
   * Reads a file and returns basic image data.
   * Heavy parsing (PSD) should be routed to workers.
   */
  static async importFile(file: File): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        const result = event.target?.result;

        if (file.name.toLowerCase().endsWith('.psd')) {
           // We will handle PSD parsing in a worker later.
           // For scaffolding, just return the ArrayBuffer.
           resolve({
             name: file.name,
             type: 'psd',
             psdData: result,
             width: 0,
             height: 0
           });
           return;
        }

        // Standard Image
        if (typeof result === 'string') {
          const img = new Image();
          img.onload = () => {
            resolve({
              name: file.name,
              type: 'image',
              dataUrl: result,
              width: img.width,
              height: img.height
            });
          };
          img.onerror = () => reject(new Error('Failed to load image'));
          img.src = result;
        } else {
            reject(new Error('Unexpected file read result type'));
        }
      };

      reader.onerror = () => reject(reader.error);

      if (file.name.toLowerCase().endsWith('.psd')) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }
}

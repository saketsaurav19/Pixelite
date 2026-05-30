export class WorkerExportBridge {
  private worker: Worker | null = null;
  private messageCallbacks = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void }>();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    // Vite handles worker instantiation
    this.worker = new Worker(new URL('../../workers/fileWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
    this.worker.onerror = (err) => {
      console.error("Worker error:", err);
    };
  }

  private handleWorkerMessage(e: MessageEvent) {
    const { id, success, error, ...data } = e.data;
    const callback = this.messageCallbacks.get(id);

    if (callback) {
      if (success) {
        callback.resolve(data);
      } else {
        callback.reject(new Error(error));
      }
      this.messageCallbacks.delete(id);
    }
  }

    async generatePSD(layers: any[], width: number, height: number): Promise<Uint8Array> {
    if (!this.worker) throw new Error("Worker not initialized");

    const id = Math.random().toString(36).substring(7);

    // Rasterize layers into ImageData in the main thread to pass to the worker
    const rasterizedChildren = await Promise.all(layers.map(async (layer) => {
      let imageData: ImageData;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Default empty layer (transparent)
      imageData = ctx.createImageData(width, height);

      if (layer.visible && layer.opacity > 0) {
          ctx.globalAlpha = layer.opacity;
          if (layer.blendMode) {
             ctx.globalCompositeOperation = layer.blendMode;
          }

          if (layer.type === 'image' || layer.type === 'paint') {
              if (layer.dataUrl) {
                  const img = new Image();
                  await new Promise((resolve, reject) => {
                      img.onload = resolve;
                      img.onerror = reject;
                      img.src = layer.dataUrl!;
                  });
                  ctx.drawImage(img, layer.position.x, layer.position.y);
              }
          }
          // We could add support for text/shape rendering here in the future if needed,
          // but for now, ag-psd takes composite ImageData per layer.

          imageData = ctx.getImageData(0, 0, width, height);
      }

      return {
        name: layer.name || 'Layer',
        opacity: layer.opacity !== undefined ? layer.opacity : 1,
        hidden: !layer.visible,
        blendMode: layer.blendMode === 'source-over' ? 'normal' : layer.blendMode || 'normal',
        left: 0,
        top: 0,
        imageData
      };
    }));

    return new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, { resolve: (res) => resolve(res.buffer), reject });
      this.worker!.postMessage({ type: 'GENERATE_PSD', children: rasterizedChildren, width, height, id });
    });
  }
    async parsePSD(buffer: ArrayBuffer): Promise<any> {
    if (!this.worker) throw new Error("Worker not initialized");

    const id = Math.random().toString(36).substring(7);

    const parsedPsd: any = await new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, { resolve: (res) => resolve(res.psd), reject });
      this.worker!.postMessage({ type: 'PARSE_PSD', buffer, id }, [buffer]);
    });

    // Now convert the returned ImageData objects back to DataUrls
    if (parsedPsd && parsedPsd.children) {
        for (const layer of parsedPsd.children) {
             if (layer.imageData) {
                  const canvas = document.createElement('canvas');
                  canvas.width = layer.imageData.width || parsedPsd.width;
                  canvas.height = layer.imageData.height || parsedPsd.height;
                  const ctx = canvas.getContext('2d')!;
                  ctx.putImageData(layer.imageData, 0, 0);
                  layer.dataUrl = canvas.toDataURL('image/png');
                  delete layer.imageData; // save memory
             }
        }
    }
    return parsedPsd;
  }
  terminate() {
      if(this.worker) {
          this.worker.terminate();
          this.worker = null;
      }
  }
}

// Singleton instance for the app to share
export const workerExportBridge = new WorkerExportBridge();

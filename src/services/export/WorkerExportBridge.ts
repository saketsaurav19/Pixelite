import { readPsd, writePsdUint8Array, initializeCanvas } from 'ag-psd';

let canvasInitialized = false;
function ensureCanvasInitialized() {
  if (!canvasInitialized) {
    initializeCanvas(
      (width: number, height: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas as any;
      },
      (width: number, height: number) => new ImageData(width, height)
    );
    canvasInitialized = true;
  }
}

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
    ensureCanvasInitialized();
    const reversedLayers = [...layers].reverse();
    const rasterizedChildren = await Promise.all(reversedLayers.map(async (layer) => {
      let imageData: ImageData;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;

      // Default empty layer (transparent)
      imageData = ctx.createImageData(width, height);

      if (layer.visible && layer.opacity > 0) {
          ctx.globalAlpha = layer.opacity * (layer.fill !== undefined ? layer.fill : 1);
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

    const psdData = {
      width,
      height,
      children: rasterizedChildren
    };

    return writePsdUint8Array(psdData as any);
  }
      async parsePSD(buffer: ArrayBuffer): Promise<any> {
    ensureCanvasInitialized();
    const psd = readPsd(buffer);

    // Now convert the returned ImageData/Canvas objects to DataUrls
    const processLayer = async (layer: any) => {
      if (layer.canvas) {
        layer.dataUrl = layer.canvas.toDataURL('image/png');
        delete layer.canvas;
      } else if (layer.imageData) {
        const canvas = document.createElement('canvas');
        canvas.width = layer.imageData.width || psd.width;
        canvas.height = layer.imageData.height || psd.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(layer.imageData, 0, 0);
        layer.dataUrl = canvas.toDataURL('image/png');
        delete layer.imageData; // save memory
      }

      if (layer.children) {
        for (const child of layer.children) {
          await processLayer(child);
        }
      }
    };

    if (psd && psd.children) {
      for (const layer of psd.children) {
        await processLayer(layer);
      }
    }

    return psd;
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

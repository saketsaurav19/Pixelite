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

  async generatePSD(children: any[], width: number, height: number): Promise<Uint8Array> {
    if (!this.worker) throw new Error("Worker not initialized");

    const id = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, { resolve: (res) => resolve(res.buffer), reject });

      // Need to convert Canvas to ImageData because we can't send CanvasElements to a worker directly.
      const sanitizedChildren = children.map(c => {
         if (c.canvas instanceof HTMLCanvasElement || c.canvas instanceof OffscreenCanvas) {
           const ctx = c.canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
           const imageData = ctx.getImageData(0, 0, width, height);
           return { ...c, canvas: undefined, imageData };
         }
         return c;
      });

      this.worker!.postMessage({ type: 'GENERATE_PSD', children: sanitizedChildren, width, height, id });
    });
  }

  async parsePSD(buffer: ArrayBuffer): Promise<any> {
    if (!this.worker) throw new Error("Worker not initialized");

    const id = Math.random().toString(36).substring(7);

    return new Promise((resolve, reject) => {
      this.messageCallbacks.set(id, { resolve: (res) => resolve(res.psd), reject });
      this.worker!.postMessage({ type: 'PARSE_PSD', buffer, id }, [buffer]);
    });
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

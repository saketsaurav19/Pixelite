import type { PageData, SceneNode } from '../types/SceneNode';
import { nanoid } from 'nanoid';

export class WorkerClient {
  private worker: Worker | null = null;
  private resolvers: Map<string, { resolve: Function; reject: Function }> = new Map();

  async init(): Promise<void> {
    if (this.worker) return;

    this.worker = new Worker(new URL('./pdf.worker.ts', import.meta.url), {
      type: 'module',
    });

    this.worker.onmessage = (e: MessageEvent) => {
      const { id, type, payload, error } = e.data;
      if (this.resolvers.has(id)) {
        const { resolve, reject } = this.resolvers.get(id)!;
        this.resolvers.delete(id);
        if (type === 'SUCCESS') {
          resolve(payload);
        } else {
          reject(new Error(error));
        }
      }
    };

    await this.sendMessage('INIT');
  }

  private sendMessage(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        return reject(new Error('Worker not initialized'));
      }
      const id = nanoid();
      this.resolvers.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  async loadDocument(data: ArrayBuffer): Promise<void> {
    await this.init();
    await this.sendMessage('LOAD_DOCUMENT', { data });
  }

  async getPages(): Promise<PageData[]> {
    return this.sendMessage('GET_PAGES');
  }

  async extractObjects(pageIndex: number): Promise<{ backgroundDataUrl: string; nodes: SceneNode[] }> {
    return this.sendMessage('EXTRACT_OBJECTS', { pageIndex });
  }

  async closeDocument(): Promise<void> {
    await this.sendMessage('CLOSE_DOCUMENT');
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

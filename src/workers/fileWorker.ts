import { writePsdUint8Array, readPsd } from "ag-psd";

export type WorkerMessage =
  | { type: 'PARSE_PSD'; buffer: ArrayBuffer; id: string }
  | { type: 'GENERATE_PSD'; children: any[]; width: number; height: number; id: string };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { type, id } = e.data;

    switch (type) {
      case 'PARSE_PSD': {
        const psd = readPsd(e.data.buffer);
        self.postMessage({ type: 'PSD_PARSED', id, psd, success: true });
        break;
      }
      case 'GENERATE_PSD': {
        const { children, width, height } = e.data;

        // Convert the minimal child representation back to what ag-psd needs.
        // We expect ImageData or similar to be passed, as we can't pass HTMLCanvasElement to workers directly unless via OffscreenCanvas,
        // but for simplicity in this scaffolding, we assume the main thread sends ImageData or Uint8ClampedArray.

        const psdData = {
          width,
          height,
          children: children.map(c => ({
             ...c,
             // Note: actual canvas conversion logic must be handled carefully.
             // If main thread sends ImageData, ag-psd needs canvas.
             // We'd use OffscreenCanvas here to reconstruct.
             canvas: (() => {
                if (c.imageData) {
                  const oc = new OffscreenCanvas(width, height);
                  const ctx = oc.getContext('2d');
                  if (ctx) ctx.putImageData(c.imageData, 0, 0);
                  return oc;
                }
                return undefined;
             })()
          }))
        };

        const buffer = writePsdUint8Array(psdData as any);
        self.postMessage({ type: 'PSD_GENERATED', id, buffer, success: true }, [buffer.buffer]);
        break;
      }
      default:
        throw new Error(`Unknown worker message type: ${(e.data as any).type}`);
    }
  } catch (error: any) {
    self.postMessage({
      type: 'ERROR',
      id: e.data.id,
      error: error.message,
      success: false
    });
  }
};

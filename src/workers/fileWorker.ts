import { writePsdUint8Array, readPsd, initializeCanvas } from "ag-psd";

initializeCanvas(
  (width: number, height: number): HTMLCanvasElement => {
    return new OffscreenCanvas(width, height) as unknown as HTMLCanvasElement;
  },
  (width: number, height: number): ImageData => {
    return new ImageData(width, height);
  },
);

export type WorkerMessage =
  | { type: "PARSE_PSD"; buffer: ArrayBuffer; id: string }
  | {
      type: "GENERATE_PSD";
      children: any[];
      width: number;
      height: number;
      id: string;
    };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { type, id } = e.data;

    switch (type) {
      case "PARSE_PSD": {
        const psd = readPsd(e.data.buffer);

        // Convert OffscreenCanvas to Blob so it can be sent back to the main thread
        const processLayer = async (layer: any) => {
          if (layer.canvas && layer.canvas instanceof OffscreenCanvas) {
            layer.blob = await layer.canvas.convertToBlob({
              type: "image/png",
            });
            delete layer.canvas; // Remove canvas to avoid serialization errors
          }
          if (layer.children) {
            for (const child of layer.children) {
              await processLayer(child);
            }
          }
        };

        if (psd.children) {
          for (const child of psd.children) {
            await processLayer(child);
          }
        }
        self.postMessage({ type: "PSD_PARSED", id, psd, success: true });
        break;
      }
      case "GENERATE_PSD": {
        const { children, width, height } = e.data;

        // Convert the minimal child representation back to what ag-psd needs.
        // We expect ImageData or similar to be passed, as we can't pass HTMLCanvasElement to workers directly unless via OffscreenCanvas,
        // but for simplicity in this scaffolding, we assume the main thread sends ImageData or Uint8ClampedArray.

        const psdData = {
          width,
          height,
          children: children.map((c) => ({
            ...c,
            // Note: actual canvas conversion logic must be handled carefully.
            // Pass imageData directly as ag-psd supports it natively without canvas.
            imageData: c.imageData,
          })),
        };

        const buffer = writePsdUint8Array(psdData as any);
        self.postMessage({ type: "PSD_GENERATED", id, buffer, success: true }, [
          buffer.buffer,
        ]);
        break;
      }
      default:
        throw new Error(`Unknown worker message type: ${(e.data as any).type}`);
    }
  } catch (error: any) {
    self.postMessage({
      type: "ERROR",
      id: e.data.id,
      error: error.message,
      success: false,
    });
  }
};

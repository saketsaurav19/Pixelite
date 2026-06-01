// File worker currently not needed for PSD as it was moved to main thread to fix OffscreenCanvas compatibility issues with ag-psd.
// Keeping the worker scaffolding in case other heavy tasks (like zip, large HEIC, etc.) need a dedicated worker.

export type WorkerMessage = { type: 'PING' };

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  try {
    const { type } = e.data;
    if (type === 'PING') {
      self.postMessage({ type: 'PONG', success: true });
    }
  } catch (error: any) {
    self.postMessage({ type: 'ERROR', error: error.message, success: false });
  }
};

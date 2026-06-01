import { PdfjsEngineAdapter } from './engines/PdfjsEngineAdapter';

const adapter = new PdfjsEngineAdapter();

self.onmessage = async (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'INIT':
        await adapter.init();
        self.postMessage({ id, type: 'SUCCESS' });
        break;

      case 'LOAD_DOCUMENT':
        await adapter.loadDocument(payload.data);
        self.postMessage({ id, type: 'SUCCESS' });
        break;

      case 'GET_PAGES': {
        const pages = await adapter.getPages();
        self.postMessage({ id, type: 'SUCCESS', payload: pages });
        break;
      }
      case 'EXTRACT_OBJECTS': {
        const nodes = await adapter.extractObjects(payload.pageIndex);
        self.postMessage({ id, type: 'SUCCESS', payload: nodes });
        break;
      }
      case 'CLOSE_DOCUMENT':
        await adapter.closeDocument();
        self.postMessage({ id, type: 'SUCCESS' });
        break;

      default:
        self.postMessage({ id, type: 'ERROR', error: `Unknown command ${type}` });
    }
  } catch (error: any) {
    self.postMessage({ id, type: 'ERROR', error: error.message });
  }
};

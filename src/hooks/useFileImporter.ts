import { useStore } from '../store/useStore';
import { ImportEngine } from '../services/import/ImportEngine';
import { workerExportBridge } from '../services/export/WorkerExportBridge';
import type { Layer } from '../store/types';

export const useFileImporter = () => {
  const {
    layers,
    setLayers,
    documentSize,
    setDocumentSize,
    recordHistory,
    setCurrentProjectId,
    setHistory,
    addDocument
  } = useStore();

  const handleFileImport = async (file: File, isPlace: boolean = false): Promise<void> => {
    try {
      const result = await ImportEngine.importFile(file);

      if (result.type === 'psd') {
        const psdData = await workerExportBridge.parsePSD(result.psdData);

        const newLayers: Layer[] = [];
        const processPsdLayer = (child: any) => {
          if (child.children) {
            child.children.forEach(processPsdLayer);
          } else if (child.dataUrl) {
            newLayers.push({
              id: Math.random().toString(36).substring(7),
              name: child.name || 'Layer',
              type: 'image',
              dataUrl: child.dataUrl,
              position: { x: child.left || 0, y: child.top || 0 },
              visible: child.hidden !== true,
              locked: false,
              opacity: typeof child.opacity === 'number' ? child.opacity : 1,
              blendMode: child.blendMode === 'pass through' || !child.blendMode ? 'source-over' : child.blendMode
            });
          }
        };
        if (psdData.children) psdData.children.forEach(processPsdLayer);

        if (!isPlace) {
          addDocument(file.name, { w: psdData.width, h: psdData.height }, {
            layers: newLayers.reverse(),
            documentSize: { w: psdData.width, h: psdData.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open PSD', state: { layers: newLayers.reverse(), documentSize: { w: psdData.width, h: psdData.height } } }],
            historyIndex: 0
          });
        } else {
          setLayers([...layers, ...newLayers.reverse()]);
          recordHistory(`Place PSD ${file.name}`);
        }

      } else if (result.type === 'gif' && result.frames) {
        const newLayers: Layer[] = result.frames.map((frame, index) => ({
          id: Math.random().toString(36).substring(7),
          name: frame.name || `Frame ${index + 1}`,
          type: 'image' as any,
          dataUrl: frame.dataUrl,
          position: isPlace
            ? { x: (documentSize.w - result.width) / 2, y: (documentSize.h - result.height) / 2 }
            : { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        }));
        if (!isPlace) {
          addDocument(file.name, { w: result.width, h: result.height }, {
            layers: newLayers.reverse(),
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open GIF', state: { layers: newLayers.reverse(), documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          setLayers([...layers, ...newLayers.reverse()]);
          recordHistory(`Place GIF ${result.name}`);
        }

      } else if (result.type === 'svg' && result.layers) {
        if (!isPlace) {
          addDocument(file.name, { w: result.width, h: result.height }, {
            layers: result.layers.reverse(),
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open SVG', state: { layers: result.layers.reverse(), documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          setLayers([...layers, ...result.layers.reverse()]);
          recordHistory(`Place SVG ${result.name}`);
        }

      } else if (result.type === 'pdf' && result.layers) {
        if (!isPlace) {
          addDocument(file.name, { w: result.width, h: result.height }, {
            layers: result.layers,
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open PDF', state: { layers: result.layers, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          const offsetLayers = result.layers.map((pg) => ({
            ...pg,
            position: {
              x: (pg.position?.x || 0) + (documentSize.w - result.width) / 2,
              y: (pg.position?.y || 0) + (documentSize.h - result.height) / 2,
            },
          }));
          setLayers([...offsetLayers, ...layers]);
          recordHistory(`Place PDF ${result.name}`);
        }

      } else if (result.type === 'image' && result.dataUrl) {
        if (!isPlace) {
          const newDocLayers = [{
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image' as any,
            dataUrl: result.dataUrl,
            position: { x: 0, y: 0 },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over' as any
          }];
          addDocument(file.name, { w: result.width, h: result.height }, {
            layers: newDocLayers,
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open Image', state: { layers: newDocLayers, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
          if (result.exifData) (useStore.getState() as any).setExifData(result.exifData);
          if (result.iccProfile) (useStore.getState() as any).setIccProfile(result.iccProfile);
        } else {
          setLayers([...layers, {
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image' as any,
            dataUrl: result.dataUrl,
            position: {
              x: (documentSize.w - result.width) / 2,
              y: (documentSize.h - result.height) / 2
            },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over' as any
          }]);
          recordHistory(`Place ${result.name}`);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to open file.');
    }
  };

  return { handleFileImport };
};
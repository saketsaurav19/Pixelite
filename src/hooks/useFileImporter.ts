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
    setHistory
  } = useStore();

  const handleFileImport = async (file: File, isPlace: boolean = false): Promise<void> => {
    try {
      const result = await ImportEngine.importFile(file);

      if (result.type === 'psd') {
        const psdData = await workerExportBridge.parsePSD(result.psdData);

        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
          setDocumentSize({ w: psdData.width, h: psdData.height });
        }

        const newLayers: Layer[] = [];

        const processPsdLayer = (child: any) => {
          if (child.children) {
             child.children.forEach(processPsdLayer);
          } else if (child.dataUrl) {
            newLayers.push({
              id: Math.random().toString(36).substring(7),
              name: child.name || "Layer",
              type: "image",
              dataUrl: child.dataUrl,
              position: {
                x: child.left || 0,
                y: child.top || 0
              },
              visible: child.hidden !== true,
              locked: false,
              opacity: typeof child.opacity === "number" ? child.opacity / 255 : 1,
              blendMode: child.blendMode === "pass through" || !child.blendMode ? "source-over" : child.blendMode
            });
          }
        };

        if (psdData.children) {
          psdData.children.forEach(processPsdLayer);
        }

        if (!isPlace) {
          setLayers(newLayers.reverse());
        } else {
          setLayers([...layers, ...newLayers.reverse()]);
        }
        recordHistory(isPlace ? `Place PSD ${file.name}` : `Open PSD ${file.name}`);
      } else if (result.type === 'gif' && result.frames) {
        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
          setDocumentSize({ w: result.width, h: result.height });
        }

        const newLayers: Layer[] = result.frames.map((frame, index) => ({
          id: Math.random().toString(36).substring(7),
          name: frame.name || `Frame ${index + 1}`,
          type: 'image',
          dataUrl: frame.dataUrl,
          position: isPlace ? {
            x: (documentSize.w - result.width) / 2,
            y: (documentSize.h - result.height) / 2
          } : { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        }));

        if (!isPlace) {
          setLayers(newLayers.reverse());
        } else {
          setLayers([...layers, ...newLayers.reverse()]);
        }
        recordHistory(isPlace ? `Place GIF ${result.name}` : `Open GIF ${result.name}`);
      } else if (result.type === 'svg' && result.layers) {
        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
          setDocumentSize({ w: result.width, h: result.height });
        }

        if (!isPlace) {
          setLayers(result.layers.reverse());
        } else {
          setLayers([...layers, ...result.layers.reverse()]);
        }
        recordHistory(isPlace ? `Place SVG ${result.name}` : `Open SVG ${result.name}`);
      } else if (result.type === 'pdf' && result.layers) {
        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
          setDocumentSize({ w: result.width, h: result.height });
        }

        const pdfGroup: Layer = {
          id: Math.random().toString(36).substring(7),
          name: 'PDF Pages',
          type: 'group',
          children: result.layers.reverse(), // stack pages bottom to top
          collapsed: false,
          position: isPlace ? {
            x: (documentSize.w - result.width) / 2,
            y: (documentSize.h - result.height) / 2
          } : { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'pass through'
        };

        if (!isPlace) {
          setLayers([pdfGroup]);
        } else {
          setLayers([pdfGroup, ...layers]);
        }
        recordHistory(isPlace ? `Place PDF ${result.name}` : `Open PDF ${result.name}`);
      } else if (result.type === 'image' && result.dataUrl) {
        const isDefaultBackground =
          layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
          if (result.exifData) {
            (useStore.getState() as any).setExifData(result.exifData);
          }
          if (result.iccProfile) {
            (useStore.getState() as any).setIccProfile(result.iccProfile);
          }
        }
        if (!isPlace && (layers.length === 0 || isDefaultBackground)) {
          setDocumentSize({ w: result.width, h: result.height });
          setLayers([{
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image',
            dataUrl: result.dataUrl,
            position: { x: 0, y: 0 },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over'
          }]);
        } else {
          setLayers([...layers, {
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image',
            dataUrl: result.dataUrl,
            position: {
              x: (documentSize.w - result.width) / 2,
              y: (documentSize.h - result.height) / 2
            },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over'
          }]);
        }
        recordHistory(isPlace ? `Place ${result.name}` : `Open ${result.name}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to open file.');
    }
  };

  return { handleFileImport };
};

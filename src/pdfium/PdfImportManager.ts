import { WorkerClient } from './workers/WorkerClient';
import { convertSceneNodeToLayer } from './sceneGraph/LayerConversion';
import type { Layer } from '../store/types';
import { nanoid } from 'nanoid';

export interface PdfImportResult {
  layers: Layer[];
  width: number;
  height: number;
}

export class PdfImportManager {
  static async importPdf(arrayBuffer: ArrayBuffer): Promise<PdfImportResult> {
    const workerClient = new WorkerClient();

    try {
      await workerClient.init();
      await workerClient.loadDocument(arrayBuffer);

      const pages = await workerClient.getPages();

      const topLevelLayers: Layer[] = [];
      let currentX = 0;
      let currentY = 0;
      let currentRowHeight = 0;
      let maxDocWidth = 0;
      const padding = 20;
      const maxRowWidth = typeof window !== 'undefined' ? window.innerWidth : 1920;

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];

        if (currentX > 0 && currentX + page.width > maxRowWidth) {
          currentX = 0;
          currentY += currentRowHeight + padding;
          currentRowHeight = 0;
        }

        const pageX = currentX;
        const pageY = currentY;

        currentX += page.width + padding;
        currentRowHeight = Math.max(currentRowHeight, page.height);
        if (currentX - padding > maxDocWidth) {
          maxDocWidth = currentX - padding;
        }

        // Extract nodes for this page via worker
        const nodes = await workerClient.extractObjects(i);

        const artboardBg: Layer = {
          id: nanoid(),
          name: `Background`,
          type: 'shape',
          visible: true,
          locked: true,
          opacity: 1,
          blendMode: 'source-over',
          position: { x: pageX, y: pageY },
          shapeData: {
            type: 'rect',
            w: page.width,
            h: page.height,
            fill: '#ffffff',
            stroke: '',
            strokeWidth: 0,
          }
        };

        const subLayers = nodes.map(node => convertSceneNodeToLayer(node, pageX, pageY));

        const pageGroup: Layer = {
          id: nanoid(),
          name: `Page ${i + 1}`,
          type: 'group',
          // CanvasLayer gives lower child indexes a higher z-index, so keep the
          // locked white artboard after imported page content so it stays behind.
          children: [...subLayers, artboardBg],
          collapsed: false,
          position: { x: pageX, y: pageY },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'pass through' as any,
        };

        topLevelLayers.push(pageGroup);
      }

      await workerClient.closeDocument();
      workerClient.terminate();

      return {
        layers: topLevelLayers,
        width: maxDocWidth > 0 ? maxDocWidth : maxRowWidth,
        height: currentY + currentRowHeight,
      };
    } catch (error) {
      workerClient.terminate();
      throw error;
    }
  }
}

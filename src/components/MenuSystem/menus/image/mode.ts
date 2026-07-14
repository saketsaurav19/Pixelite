import type { MenuItem, MenuLeafItem } from '../types';
import type { EditorState } from '../../../store/types';
import { flattenTree } from '../../../utils/layerUtils';

export const imageModeMenu: MenuItem[] = [
  { label: 'Mode', submenu: [
    {
      label: 'RGB Color',
      action: (store) => { store.setColorMode('rgb'); },
      isEnabled: (store) => store.colorMode !== 'rgb',
    },
    {
      label: 'CMYK Color',
      action: (store) => {
        store.addAlert?.({ type: 'info', message: 'CMYK mode is not supported in the browser. The image will remain in RGB.' });
      },
    },
    {
      label: 'Grayscale',
      action: (store) => {
        const allLayers = flattenTree(store.layers);
        const rasterLayers = allLayers.filter(l => l.type === 'paint' || l.type === 'image');
        if (rasterLayers.length === 0) return;

        let completed = 0;
        for (const layer of rasterLayers) {
          const srcUrl = layer.dataUrl;
          if (srcUrl) {
            const img = new Image();
            img.onload = () => {
              const offscreen = document.createElement('canvas');
              offscreen.width = img.width;
              offscreen.height = img.height;
              const octx = offscreen.getContext('2d')!;
              octx.drawImage(img, 0, 0);
              const imageData = octx.getImageData(0, 0, offscreen.width, offscreen.height);
              const data = imageData.data;
              for (let i = 0; i < data.length; i += 4) {
                const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                data[i] = data[i + 1] = data[i + 2] = gray;
              }
              octx.putImageData(imageData, 0, 0);
              store.updateLayer(layer.id, { dataUrl: offscreen.toDataURL() });
              completed++;
              if (completed === rasterLayers.length) store.recordHistory('Convert to Grayscale');
            };
            img.onerror = () => { completed++; if (completed === rasterLayers.length) store.recordHistory('Convert to Grayscale'); };
            img.src = srcUrl;
          } else {
            completed++;
            if (completed === rasterLayers.length) store.recordHistory('Convert to Grayscale');
          }
        }
        store.setColorMode('grayscale');
      },
      isEnabled: (store) => store.colorMode !== 'grayscale',
    },
    {
      label: 'Indexed Color',
      action: (store) => {
        store.addAlert?.({ type: 'info', message: 'Indexed color mode is not implemented yet.' });
      },
    },
    { divider: true },
    ...[8, 16, 32].map((depth): MenuLeafItem => ({
      label: `${depth} Bits/Channel`,
      action: (store: EditorState) => store.setBitDepth(depth as 8 | 16 | 32),
      isChecked: (store: EditorState) => store.bitDepth === depth,
    })),
  ] },
];

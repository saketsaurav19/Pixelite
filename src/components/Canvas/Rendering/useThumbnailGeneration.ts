import { useEffect, useRef } from 'react';
import type { Layer } from '../../../store/useStore';
import type { CanvasRefs } from '../types';

const generateThumbnail = (
  layer: Layer,
  documentSize: { w: number; h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void,
  lastContentRef: React.MutableRefObject<{ [key: string]: string }>
): void => {
  // If it's a group, recursively generate thumbnails for children
  if ((layer.type === 'group' || layer.type === 'artboard') && layer.children) {
    layer.children.forEach(child => {
      generateThumbnail(child, documentSize, canvasRefs, updateLayer, lastContentRef);
    });
    return;
  }

  const { thumbnail, ...content } = layer;
  const contentStr = JSON.stringify(content);
  if (lastContentRef.current[layer.id] !== contentStr) {
    const thumbCanvas = document.createElement('canvas');
    const maxSize = 48;

    if (layer.type === 'text') {
      thumbCanvas.width = maxSize;
      thumbCanvas.height = maxSize;
      const thumbCtx = thumbCanvas.getContext('2d');
      if (thumbCtx) {
        const colorStr = (layer.color || '#000000').toLowerCase();
        let isNearWhite = false;
        
        if (colorStr.includes('rgb')) {
          const match = colorStr.match(/\d+/g);
          if (match && match.length >= 3) {
            const r = parseInt(match[0]);
            const g = parseInt(match[1]);
            const b = parseInt(match[2]);
            if (r > 220 && g > 220 && b > 220) {
              isNearWhite = true;
            }
          }
        } else if (colorStr.startsWith('#')) {
          const hex = colorStr.slice(1);
          if (hex.length === 3) {
            const r = parseInt(hex[0], 16) * 17;
            const g = parseInt(hex[1], 16) * 17;
            const b = parseInt(hex[2], 16) * 17;
            if (r > 220 && g > 220 && b > 220) isNearWhite = true;
          } else if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16);
            const g = parseInt(hex.slice(2, 4), 16);
            const b = parseInt(hex.slice(4, 6), 16);
            if (r > 220 && g > 220 && b > 220) isNearWhite = true;
          }
        } else if (colorStr === 'white' || colorStr === '#fff' || colorStr === '#ffffff') {
          isNearWhite = true;
        }

        // Background
        thumbCtx.fillStyle = isNearWhite ? '#000000' : '#ffffff';
        thumbCtx.fillRect(0, 0, maxSize, maxSize);

        // Text rendering
        thumbCtx.fillStyle = layer.color || '#000000';
        thumbCtx.font = 'bold 11px sans-serif';
        thumbCtx.textAlign = 'center';
        thumbCtx.textBaseline = 'middle';
        
        let dispText = layer.textContent || 'T';
        if (dispText.length > 5) {
          dispText = dispText.substring(0, 4) + '..';
        }
        thumbCtx.fillText(dispText, maxSize / 2, maxSize / 2);

        updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
        lastContentRef.current[layer.id] = contentStr;
      }
    } else {
      const canvas = canvasRefs.current[layer.id];
      if (canvas) {
        const docAspect = documentSize.w / documentSize.h;
        let thumbW, thumbH;
        if (docAspect > 1) {
          thumbW = maxSize;
          thumbH = maxSize / docAspect;
        } else {
          thumbH = maxSize;
          thumbW = maxSize * docAspect;
        }

        thumbCanvas.width = thumbW;
        thumbCanvas.height = thumbH;
        const thumbCtx = thumbCanvas.getContext('2d');
        if (thumbCtx) {
          const scaleX = thumbW / documentSize.w;
          const scaleY = thumbH / documentSize.h;
          thumbCtx.drawImage(
            canvas,
            0, 0, canvas.width, canvas.height,
            layer.position.x * scaleX, layer.position.y * scaleY,
            thumbW, thumbH
          );
          updateLayer(layer.id, { thumbnail: thumbCanvas.toDataURL() });
          lastContentRef.current[layer.id] = contentStr;
        }
      }
    }
  }
};

export const useThumbnailGeneration = (
  layers: Layer[],
  documentSize: { w: number, h: number },
  canvasRefs: CanvasRefs,
  updateLayer: (id: string, updates: Partial<Layer>) => void
) => {
  const lastContentRef = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      layers.forEach(layer => {
        generateThumbnail(layer, documentSize, canvasRefs, updateLayer, lastContentRef);
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [layers, updateLayer, documentSize]);
};

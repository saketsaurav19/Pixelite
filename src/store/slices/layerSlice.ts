
import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, Layer } from '../types';
import { findLayerById, findParentNode, removeNode, insertNode, updateNode, flattenTree, moveNode, reorderNodes } from '../../utils/layerUtils';
import { FilterService } from '../../services/image/FilterService';

export interface LayerSlice {
  layers: Layer[];
  activeLayerId: string | null;
  selectedLayerIds: string[];
  
  addLayer: (layer: Partial<Layer>) => void;
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  setSelectedLayerIds: (ids: string[]) => void;
  updateLayer: (id: string, updates: Partial<Layer>) => void;
  duplicateLayer: (id: string) => void;
  toggleLayerVisibility: (id: string) => void;
  moveLayer: (id: string, direction: 'up' | 'down') => void;
  reorderLayers: (startIndex: number, endIndex: number) => void; // Old array-based, consider deprecating
  reorderNodesAction: (draggedId: string, targetId: string, position: 'before'|'after'|'inside') => void;
  setLayers: (layers: Layer[]) => void;
  mergeLayers: (ids: string[]) => void;
  flattenImage: () => void;
  rasterizeLayer: (id: string) => void;
  addAdjustmentLayer: (type: 'brightness_contrast' | 'hue_saturation' | 'black_white' | 'photo_effects' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'color_balance' | 'channel_mixer' | 'color_lookup') => void;
  autoAlignLayers: () => Promise<void>;
  autoBlendLayers: () => Promise<void>;
  autoTone: () => void;
  autoContrast: () => void;
  autoColor: () => void;
  applyFilterAction: (filterType: string) => void;
  applyActualFilter: (filterType: string, options: any) => void;
  flipCanvas: (direction: 'horizontal' | 'vertical') => Promise<void>;
  trimCanvas: () => void;
}

export const createLayerSlice: StateCreator<EditorState, [], [], LayerSlice> = (set, get) => ({
  layers: [],
  activeLayerId: null,
  selectedLayerIds: [],

  addLayer: (layer) => set((state) => {
    const newLayer: Layer = {
      id: nanoid(),
      name: `Layer ${flattenTree(state.layers).length + 1}`,
      visible: true,
      locked: false,
      lockPixels: false,
      lockPosition: false,
      lockTransparent: false,
      opacity: 1,
      fill: 1,
      type: 'paint',
      position: { x: 0, y: 0 },
      width: layer.width !== undefined ? layer.width : state.documentSize.w,
      height: layer.height !== undefined ? layer.height : state.documentSize.h,
      blendMode: 'source-over',
      ...layer,
    } as Layer;
    return {
      layers: [newLayer, ...state.layers], // Adds to top level for now
      activeLayerId: newLayer.id,
      selectedLayerIds: [newLayer.id]
    };
  }),

  removeLayer: (id) => set((state) => {
    const idsToDelete = state.selectedLayerIds.includes(id) ? state.selectedLayerIds : [id];
    let newLayers = state.layers;
    idsToDelete.forEach(deleteId => {
      newLayers = removeNode(newLayers, deleteId);
    });

    const flatLayers = flattenTree(newLayers);
    let nextActiveId = state.activeLayerId;
    if (nextActiveId && idsToDelete.includes(nextActiveId)) {
      nextActiveId = flatLayers.length > 0 ? flatLayers[0].id : null;
    }

    return {
      layers: newLayers,
      activeLayerId: nextActiveId,
      selectedLayerIds: nextActiveId ? [nextActiveId] : []
    };
  }),

  setActiveLayer: (id) => set({
    activeLayerId: id,
    selectedLayerIds: id ? [id] : []
  }),

  setSelectedLayerIds: (ids) => set({
    selectedLayerIds: ids,
    activeLayerId: ids.length > 0 ? ids[ids.length - 1] : null
  }),

  updateLayer: (id, updates) => set((state) => {
    const targetLayer = findLayerById(state.layers, id);
    let finalUpdates = updates;
    if (targetLayer && targetLayer.importedFromPdf) {
      const isVisualUpdate = Object.keys(updates).some(key => key !== 'importedFromPdf' && key !== 'isModified' && key !== 'thumbnail');
      if (isVisualUpdate) {
        finalUpdates = { ...updates, isModified: true };
      }
    }
    let newLayers = state.layers;
    if (targetLayer && targetLayer.type === 'artboard' && finalUpdates.locked !== undefined) {
      const applyLockRecursively = (node: Layer, lockedVal: boolean): Layer => {
        const nextNode = { ...node, locked: lockedVal };
        if (nextNode.children) {
          nextNode.children = nextNode.children.map(child => applyLockRecursively(child, lockedVal));
        }
        return nextNode;
      };
      const updatedArtboard = applyLockRecursively(targetLayer, finalUpdates.locked);
      newLayers = updateNode(state.layers, id, updatedArtboard);
    } else {
      newLayers = updateNode(state.layers, id, finalUpdates);
    }
    return { layers: newLayers };
  }),

  duplicateLayer: (id) => {
    const state = get();
    const layerToDup = findLayerById(state.layers, id);
    if (!layerToDup) return;

    let bounds = state.selectionRect;
    const lassoPaths = state.lassoPaths;

    // Calculate bounding box for lasso/magnetic selection paths
    if (!bounds && lassoPaths && lassoPaths.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      let hasPoints = false;
      lassoPaths.forEach((path) => {
        path.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.x > maxX) maxX = p.x;
          if (p.y > maxY) maxY = p.y;
          hasPoints = true;
        });
      });
      if (hasPoints) {
        bounds = {
          x: Math.round(minX),
          y: Math.round(minY),
          w: Math.round(maxX - minX),
          h: Math.round(maxY - minY),
        };
      }
    }

    let isSelectionDuplicate = false;
    let newLayer: Layer | null = null;

    if (bounds && bounds.w > 0 && bounds.h > 0) {
      const canvas = document.querySelector(`canvas[data-layer-id="${id}"]`) as HTMLCanvasElement;
      if (canvas) {
        const layerPos = layerToDup.position || { x: 0, y: 0 };
        const layerMinX = layerPos.x;
        const layerMinY = layerPos.y;
        const layerMaxX = layerPos.x + canvas.width;
        const layerMaxY = layerPos.y + canvas.height;

        const interMinX = Math.max(bounds.x, layerMinX);
        const interMinY = Math.max(bounds.y, layerMinY);
        const interMaxX = Math.min(bounds.x + bounds.w, layerMaxX);
        const interMaxY = Math.min(bounds.y + bounds.h, layerMaxY);

        const interW = interMaxX - interMinX;
        const interH = interMaxY - interMinY;

        if (interW > 0 && interH > 0) {
          isSelectionDuplicate = true;
          const srcX = interMinX - layerMinX;
          const srcY = interMinY - layerMinY;

          // Create selection mask
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = interW;
          maskCanvas.height = interH;
          const maskCtx = maskCanvas.getContext('2d')!;

          maskCtx.fillStyle = 'black';
          if (lassoPaths && lassoPaths.length > 0) {
            maskCtx.beginPath();
            lassoPaths.forEach((path) => {
              if (path.length < 3) return;
              maskCtx.moveTo(path[0].x - interMinX, path[0].y - interMinY);
              path.forEach((p) => maskCtx.lineTo(p.x - interMinX, p.y - interMinY));
              maskCtx.closePath();
            });
            maskCtx.fill();
          } else {
            maskCtx.fillRect(bounds.x - interMinX, bounds.y - interMinY, bounds.w, bounds.h);
          }

          // Crop and mask pixels
          const resultCanvas = document.createElement('canvas');
          resultCanvas.width = interW;
          resultCanvas.height = interH;
          const resultCtx = resultCanvas.getContext('2d')!;

          resultCtx.drawImage(canvas, srcX, srcY, interW, interH, 0, 0, interW, interH);
          resultCtx.globalCompositeOperation = 'destination-in';
          resultCtx.drawImage(maskCanvas, 0, 0);

          newLayer = {
            id: nanoid(),
            name: `${layerToDup.name} Selection Copy`,
            visible: true,
            locked: false,
            lockPixels: false,
            lockPosition: false,
            lockTransparent: false,
            opacity: 1,
            fill: 1,
            type: 'paint',
            position: { x: interMinX, y: interMinY },
            width: interW,
            height: interH,
            dataUrl: resultCanvas.toDataURL(),
            blendMode: 'source-over',
          };
        }
      }
    }

    if (!isSelectionDuplicate || !newLayer) {
      const srcPos = layerToDup.position || { x: 0, y: 0 };
      newLayer = {
        ...layerToDup,
        id: nanoid(),
        name: `${layerToDup.name} Copy`,
        position: { x: srcPos.x + 10, y: srcPos.y + 10 }
      };
    }

    set({
      layers: insertNode(state.layers, newLayer),
      activeLayerId: newLayer.id,
    });

    state.recordHistory(isSelectionDuplicate ? 'Layer via Copy' : 'Duplicate Layer');
  },

  toggleLayerVisibility: (id) => set((state) => {
    const layer = findLayerById(state.layers, id);
    if (!layer) return state;
    return {
      layers: updateNode(state.layers, id, { visible: !layer.visible })
    };
  }),

  moveLayer: (id, direction) => set((state) => ({
    layers: moveNode(state.layers, id, direction)
  })),

  reorderLayers: (startIndex, endIndex) => set((state) => {
    // Keep backward compat for now, assumes flat list
    const next = [...state.layers];
    if (startIndex >= 0 && startIndex < next.length && endIndex >= 0 && endIndex <= next.length) {
      const [removed] = next.splice(startIndex, 1);
      next.splice(endIndex, 0, removed);
    }
    return { layers: next };
  }),

  reorderNodesAction: (draggedId, targetId, position) => set((state) => ({
    layers: reorderNodes(state.layers, draggedId, targetId, position)
  })),

  setLayers: (layers) => set({ layers }),

  mergeLayers: (ids) => set((state) => {
    let newLayers = state.layers;
    const layerToKeep = ids[0];
    for (let i = 1; i < ids.length; i++) {
        newLayers = removeNode(newLayers, ids[i]);
    }
    return { layers: newLayers, activeLayerId: layerToKeep };
  }),

  flattenImage: () => set((state) => {
    if (state.layers.length === 0) return state;
    const allLayers = flattenTree(state.layers);
    const bottomLayer = allLayers[allLayers.length - 1] || state.layers[0];
    const backgroundLayer: Layer = {
      ...bottomLayer,
      id: nanoid(),
      name: 'Background',
      locked: true,
      type: 'paint',
    };
    return { layers: [backgroundLayer], activeLayerId: backgroundLayer.id };
  }),

  rasterizeLayer: (id) => set((state) => ({
    layers: updateNode(state.layers, id, { type: 'paint' })
  })),

  addAdjustmentLayer: (type) => set((state) => {
    let name = 'Adjustment Layer';
    let defaultSettings: any = {};
    if (type === 'brightness_contrast') {
      name = 'Brightness/Contrast';
      defaultSettings = { brightness: 0, contrast: 0 };
    } else if (type === 'hue_saturation') {
      name = 'Hue/Saturation';
      defaultSettings = { hue: 0, saturation: 0, lightness: 0 };
    } else if (type === 'black_white') {
      name = 'Black & White';
      defaultSettings = { greyscale: true };
    } else if (type === 'photo_effects') {
      name = 'Photo Effects';
      defaultSettings = { effect: 'none' };
    } else if (type === 'exposure') {
      name = 'Exposure';
      defaultSettings = { exposure: { exposure: 0, offset: 0, gamma: 1.0 } };
    } else if (type === 'vibrance') {
      name = 'Vibrance';
      defaultSettings = { vibrance: 0 };
    } else if (type === 'color_balance') {
      name = 'Color Balance';
      defaultSettings = {
        colorBalance: {
          shadows: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          midtones: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          highlights: { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 },
          preserveLuminosity: true
        }
      };
    } else if (type === 'levels') {
      name = 'Levels';
      defaultSettings = {
        levels: {
          master: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          red: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          green: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
          blue: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 }
        }
      };
    } else if (type === 'curves') {
      name = 'Curves';
      defaultSettings = {
        curves: {
          master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
          blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
        }
      };
    } else if (type === 'channel_mixer') {
      name = 'Channel Mixer';
      defaultSettings = {
        channelMixer: {
          red: { red: 100, green: 0, blue: 0, constant: 0 },
          green: { red: 0, green: 100, blue: 0, constant: 0 },
          blue: { red: 0, green: 0, blue: 100, constant: 0 },
          monochrome: false
        }
      };
    } else if (type === 'color_lookup') {
      name = 'Color Lookup';
      defaultSettings = {
        colorLookup: {
          preset: 'identity'
        }
      };
    }

    const count = flattenTree(state.layers).filter(l => l.type === 'adjustment' && l.adjustmentData?.type === type).length + 1;

    const newLayer: Layer = {
      id: nanoid(),
      name: `${name} ${count}`,
      visible: true,
      locked: false,
      opacity: 1,
      type: 'adjustment',
      position: { x: 0, y: 0 },
      blendMode: 'source-over',
      isNew: true,
      adjustmentData: {
        type,
        settings: defaultSettings
      }
    } as Layer;

    let newLayers = [...state.layers];
    if (state.activeLayerId) {
      const parent = findParentNode(state.layers, state.activeLayerId);
      if (parent && parent.children) {
        const activeIdx = parent.children.findIndex(c => c.id === state.activeLayerId);
        const updatedChildren = [...parent.children];
        updatedChildren.splice(activeIdx, 0, newLayer);
        newLayers = updateNode(state.layers, parent.id, { children: updatedChildren });
      } else {
        const activeIdx = state.layers.findIndex(l => l.id === state.activeLayerId);
        if (activeIdx !== -1) {
          newLayers.splice(activeIdx, 0, newLayer);
        } else {
          newLayers = [newLayer, ...newLayers];
        }
      }
    } else {
      newLayers = [newLayer, ...newLayers];
    }

    return {
      layers: newLayers,
      activeLayerId: newLayer.id,
      activeAdjustmentModal: type,
      adjustmentSourceLayerId: state.activeLayerId
    };
  }),

  autoAlignLayers: async () => {
    const { layers, documentSize, updateLayer, recordHistory, addAlert, selectedLayerIds, activeLayerId } = get();
    const selectedIds = selectedLayerIds || [];
    const activeId = activeLayerId;
    
    const selectedPaintLayers = flattenTree(layers).filter(l => 
      (selectedIds.includes(l.id) || l.id === activeId) && l.visible && (l.type === 'paint' || l.type === 'image')
    );
    if (selectedPaintLayers.length < 2) {
      addAlert({ type: 'warning', message: 'Select at least two visible paint or image layers to align.' });
      return;
    }
    
    const refLayer = selectedPaintLayers[selectedPaintLayers.length - 1];
    const targetLayers = selectedPaintLayers.slice(0, selectedPaintLayers.length - 1);
    
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load layer image'));
        img.src = src;
      });
    };
    
    try {
      if (!refLayer.dataUrl) {
        addAlert({ type: 'error', message: 'Reference layer has no image data.' });
        return;
      }
      
      const docW = documentSize.w;
      const docH = documentSize.h;
      
      const refCanvas = document.createElement('canvas');
      refCanvas.width = 256;
      refCanvas.height = 256;
      const refCtx = refCanvas.getContext('2d')!;
      
      const refImg = await loadImage(refLayer.dataUrl);
      refCtx.drawImage(
        refImg,
        (refLayer.position?.x || 0) * 256 / docW,
        (refLayer.position?.y || 0) * 256 / docH,
        (refLayer.width || docW) * 256 / docW,
        (refLayer.height || docH) * 256 / docH
      );
      
      const getGrayscaleData = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const gray = new Float32Array(w * h);
        const alpha = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
          gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
          alpha[i] = data[i * 4 + 3];
        }
        return { gray, alpha };
      };
      
      const refData = getGrayscaleData(refCtx, 256, 256);
      
      for (const tgtLayer of targetLayers) {
        if (!tgtLayer.dataUrl) continue;
        
        const tgtCanvas = document.createElement('canvas');
        tgtCanvas.width = 256;
        tgtCanvas.height = 256;
        const tgtCtx = tgtCanvas.getContext('2d')!;
        
        const tgtImg = await loadImage(tgtLayer.dataUrl);
        tgtCtx.drawImage(
          tgtImg,
          (tgtLayer.position?.x || 0) * 256 / docW,
          (tgtLayer.position?.y || 0) * 256 / docH,
          (tgtLayer.width || docW) * 256 / docW,
          (tgtLayer.height || docH) * 256 / docH
        );
        
        const tgtData = getGrayscaleData(tgtCtx, 256, 256);
        
        let minSsd = Infinity;
        let bestDx = 0;
        let bestDy = 0;
        
        // Coarse search: step 4
        for (let dy = -64; dy <= 64; dy += 4) {
          for (let dx = -64; dx <= 64; dx += 4) {
            let ssd = 0;
            let count = 0;
            for (let y = 0; y < 256; y++) {
              const ty = y + dy;
              if (ty < 0 || ty >= 256) continue;
              for (let x = 0; x < 256; x++) {
                const tx = x + dx;
                if (tx < 0 || tx >= 256) continue;
                
                const refIdx = y * 256 + x;
                const tgtIdx = ty * 256 + tx;
                
                if (refData.alpha[refIdx] > 10 && tgtData.alpha[tgtIdx] > 10) {
                  const diff = refData.gray[refIdx] - tgtData.gray[tgtIdx];
                  ssd += diff * diff;
                  count++;
                }
              }
            }
            if (count > 200) {
              const avgSsd = ssd / count;
              if (avgSsd < minSsd) {
                minSsd = avgSsd;
                bestDx = dx;
                bestDy = dy;
              }
            }
          }
        }
        
        // Fine search: step 1 around bestDx, bestDy
        let fineMinSsd = minSsd;
        let fineBestDx = bestDx;
        let fineBestDy = bestDy;
        
        for (let dy = bestDy - 3; dy <= bestDy + 3; dy++) {
          for (let dx = bestDx - 3; dx <= bestDx + 3; dx++) {
            let ssd = 0;
            let count = 0;
            for (let y = 0; y < 256; y++) {
              const ty = y + dy;
              if (ty < 0 || ty >= 256) continue;
              for (let x = 0; x < 256; x++) {
                const tx = x + dx;
                if (tx < 0 || tx >= 256) continue;
                
                const refIdx = y * 256 + x;
                const tgtIdx = ty * 256 + tx;
                
                if (refData.alpha[refIdx] > 10 && tgtData.alpha[tgtIdx] > 10) {
                  const diff = refData.gray[refIdx] - tgtData.gray[tgtIdx];
                  ssd += diff * diff;
                  count++;
                }
              }
            }
            if (count > 200) {
              const avgSsd = ssd / count;
              if (avgSsd < fineMinSsd) {
                fineMinSsd = avgSsd;
                fineBestDx = dx;
                fineBestDy = dy;
              }
            }
          }
        }
        
        const shiftX = Math.round(fineBestDx * docW / 256);
        const shiftY = Math.round(fineBestDy * docH / 256);
        
        updateLayer(tgtLayer.id, {
          position: {
            x: (tgtLayer.position?.x || 0) - shiftX,
            y: (tgtLayer.position?.y || 0) - shiftY
          }
        });
      }
      
      recordHistory('Auto-Align Layers');
      addAlert({ type: 'success', message: 'Auto-aligned visible layers successfully.' });
    } catch (err: any) {
      console.error(err);
      addAlert({ type: 'error', message: 'Failed to auto-align layers: ' + err.message });
    }
  },

  autoBlendLayers: async () => {
    const { layers, documentSize, updateLayer, recordHistory, addAlert, selectedLayerIds, activeLayerId } = get();
    const selectedIds = selectedLayerIds || [];
    const activeId = activeLayerId;
    
    const selectedPaintLayers = flattenTree(layers).filter(l => 
      (selectedIds.includes(l.id) || l.id === activeId) && l.visible && (l.type === 'paint' || l.type === 'image')
    );
    
    if (selectedPaintLayers.length < 2) {
      addAlert({ type: 'warning', message: 'Select at least two visible paint or image layers to blend.' });
      return;
    }
    
    const sortedLayers = [...selectedPaintLayers].reverse();
    
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load layer image'));
        img.src = src;
      });
    };
    
    try {
      const docW = documentSize.w;
      const docH = documentSize.h;

      const refLayer = sortedLayers[0];
      if (!refLayer.dataUrl) {
        addAlert({ type: 'error', message: 'Reference layer has no image data.' });
        return;
      }
      
      const refImg = await loadImage(refLayer.dataUrl);
      const refX = refLayer.position?.x || 0;
      const refY = refLayer.position?.y || 0;
      const refW = refLayer.width || docW;
      const refH = refLayer.height || docH;
      
      const refCanvas = document.createElement('canvas');
      refCanvas.width = refW;
      refCanvas.height = refH;
      const refCtx = refCanvas.getContext('2d')!;
      refCtx.drawImage(refImg, 0, 0, refW, refH);

      for (let i = 1; i < sortedLayers.length; i++) {
        const tarLayer = sortedLayers[i];
        if (!tarLayer.dataUrl) continue;
        
        const tarImg = await loadImage(tarLayer.dataUrl);
        const tarX = tarLayer.position?.x || 0;
        const tarY = tarLayer.position?.y || 0;
        const tarW = tarLayer.width || docW;
        const tarH = tarLayer.height || docH;
        
        const refLeft = refX;
        const refRight = refX + refW;
        const refTop = refY;
        const refBottom = refY + refH;
        
        const tarLeft = tarX;
        const tarRight = tarX + tarW;
        const tarTop = tarY;
        const tarBottom = tarY + tarH;
        
        const overlapLeft = Math.max(refLeft, tarLeft);
        const overlapRight = Math.min(refRight, tarRight);
        const overlapTop = Math.max(refTop, tarTop);
        const overlapBottom = Math.min(refBottom, tarBottom);
        
        const overlapW = overlapRight - overlapLeft;
        const overlapH = overlapBottom - overlapTop;
        
        if (overlapW > 0 && overlapH > 0) {
          const tarCanvas = document.createElement('canvas');
          tarCanvas.width = tarW;
          tarCanvas.height = tarH;
          const tarCtx = tarCanvas.getContext('2d')!;
          tarCtx.drawImage(tarImg, 0, 0, tarW, tarH);
          
          const tarImageData = tarCtx.getImageData(0, 0, tarW, tarH);
          const tarPixels = tarImageData.data;
          
          const refOverlapX = overlapLeft - refLeft;
          const refOverlapY = overlapTop - refY;
          const refImageData = refCtx.getImageData(refOverlapX, refOverlapY, overlapW, overlapH);
          const refPixels = refImageData.data;
          
          const tarOverlapX = overlapLeft - tarLeft;
          const tarOverlapY = overlapTop - tarTop;
          const tarOverlapImageData = tarCtx.getImageData(tarOverlapX, tarOverlapY, overlapW, overlapH);
          const tarOverlapPixels = tarOverlapImageData.data;
          
          let sumR_ref = 0, sumG_ref = 0, sumB_ref = 0, count_ref = 0;
          let sumR_tar = 0, sumG_tar = 0, sumB_tar = 0, count_tar = 0;
          
          for (let py = 0; py < overlapH; py++) {
            for (let px = 0; px < overlapW; px++) {
              const idx = (py * overlapW + px) * 4;
              const a_ref = refPixels[idx + 3];
              const a_tar = tarOverlapPixels[idx + 3];
              
              if (a_ref > 50) {
                sumR_ref += refPixels[idx];
                sumG_ref += refPixels[idx + 1];
                sumB_ref += refPixels[idx + 2];
                count_ref++;
              }
              if (a_tar > 50) {
                sumR_tar += tarOverlapPixels[idx];
                sumG_tar += tarOverlapPixels[idx + 1];
                sumB_tar += tarOverlapPixels[idx + 2];
                count_tar++;
              }
            }
          }
          
          if (count_ref > 0 && count_tar > 0) {
            const avgR_ref = sumR_ref / count_ref;
            const avgG_ref = sumG_ref / count_ref;
            const avgB_ref = sumB_ref / count_ref;
            
            const avgR_tar = sumR_tar / count_tar;
            const avgG_tar = sumG_tar / count_tar;
            const avgB_tar = sumB_tar / count_tar;
            
            const scaleR = Math.max(0.5, Math.min(1.5, avgR_ref / (avgR_tar || 1)));
            const scaleG = Math.max(0.5, Math.min(1.5, avgG_ref / (avgG_tar || 1)));
            const scaleB = Math.max(0.5, Math.min(1.5, avgB_ref / (avgB_tar || 1)));
            
            for (let idx = 0; idx < tarPixels.length; idx += 4) {
              if (tarPixels[idx + 3] > 0) {
                tarPixels[idx] = Math.max(0, Math.min(255, tarPixels[idx] * scaleR));
                tarPixels[idx + 1] = Math.max(0, Math.min(255, tarPixels[idx + 1] * scaleG));
                tarPixels[idx + 2] = Math.max(0, Math.min(255, tarPixels[idx + 2] * scaleB));
              }
            }
          }
          
          const cx_ref = refLeft + refW / 2;
          const cy_ref = refTop + refH / 2;
          const cx_tar = tarLeft + tarW / 2;
          const cy_tar = tarTop + tarH / 2;
          
          const dx = cx_tar - cx_ref;
          const dy = cy_tar - cy_ref;
          const distSq = dx * dx + dy * dy || 1;
          
          let minProj = Infinity;
          let maxProj = -Infinity;
          
          const overlapCorners = [
            { x: overlapLeft, y: overlapTop },
            { x: overlapRight, y: overlapTop },
            { x: overlapLeft, y: overlapBottom },
            { x: overlapRight, y: overlapBottom }
          ];
          
          overlapCorners.forEach(pt => {
            const vx = pt.x - cx_ref;
            const vy = pt.y - cy_ref;
            const proj = (vx * dx + vy * dy) / Math.sqrt(distSq);
            if (proj < minProj) minProj = proj;
            if (proj > maxProj) maxProj = proj;
          });
          
          const projRange = maxProj - minProj || 1;
          
          for (let py = 0; py < overlapH; py++) {
            for (let px = 0; px < overlapW; px++) {
              const xDoc = overlapLeft + px;
              const yDoc = overlapTop + py;
              
              const vx = xDoc - cx_ref;
              const vy = yDoc - cy_ref;
              const proj = (vx * dx + vy * dy) / Math.sqrt(distSq);
              
              let t = (proj - minProj) / projRange;
              t = Math.max(0, Math.min(1, t));
              
              const smoothT = t * t * (3 - 2 * t);
              
              const tarX_px = xDoc - tarLeft;
              const tarY_px = yDoc - tarTop;
              const tarIdx = (tarY_px * tarW + tarX_px) * 4;
              
              tarPixels[tarIdx + 3] = Math.round(tarPixels[tarIdx + 3] * smoothT);
            }
          }
          
          tarCtx.putImageData(tarImageData, 0, 0);
          updateLayer(tarLayer.id, { dataUrl: tarCanvas.toDataURL() });
        }
      }
      
      recordHistory('Auto-Blend Layers');
      addAlert({ type: 'success', message: 'Layers blended successfully.' });
    } catch (err: any) {
      console.error('[autoBlendLayers] Error:', err);
      addAlert({ type: 'error', message: 'Failed to auto-blend layers: ' + err.message });
    }
  },

  autoTone: () => {
    const { layers, activeLayerId, updateLayer, recordHistory, selectionRect, lassoPaths, isInverseSelection } = get();
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.save();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const rHist = new Int32Array(256);
    const gHist = new Int32Array(256);
    const bHist = new Int32Array(256);
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        rHist[data[i]]++;
        gHist[data[i + 1]]++;
        bHist[data[i + 2]]++;
        count++;
      }
    }

    if (count > 0) {
      const clipCount = Math.floor(count * 0.002);
      
      let rMin = 0, rMax = 255;
      let rSum = 0;
      for (let v = 0; v < 256; v++) {
        rSum += rHist[v];
        if (rSum > clipCount) { rMin = v; break; }
      }
      rSum = 0;
      for (let v = 255; v >= 0; v--) {
        rSum += rHist[v];
        if (rSum > clipCount) { rMax = v; break; }
      }

      let gMin = 0, gMax = 255;
      let gSum = 0;
      for (let v = 0; v < 256; v++) {
        gSum += gHist[v];
        if (gSum > clipCount) { gMin = v; break; }
      }
      gSum = 0;
      for (let v = 255; v >= 0; v--) {
        gSum += gHist[v];
        if (gSum > clipCount) { gMax = v; break; }
      }

      let bMin = 0, bMax = 255;
      let bSum = 0;
      for (let v = 0; v < 256; v++) {
        bSum += bHist[v];
        if (bSum > clipCount) { bMin = v; break; }
      }
      bSum = 0;
      for (let v = 255; v >= 0; v--) {
        bSum += bHist[v];
        if (bSum > clipCount) { bMax = v; break; }
      }

      const rRange = rMax - rMin || 1;
      const gRange = gMax - gMin || 1;
      const bRange = bMax - bMin || 1;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = Math.min(255, Math.max(0, ((data[i] - rMin) / rRange) * 255));
          data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - gMin) / gRange) * 255));
          data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - bMin) / bRange) * 255));
        }
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    if (selectionRect) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
      ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    } else if (lassoPaths && lassoPaths.length > 0) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x - offX, path[0].y - offY);
        path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
    }

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Auto Tone');
  },

  autoContrast: () => {
    const { layers, activeLayerId, updateLayer, recordHistory, selectionRect, lassoPaths, isInverseSelection } = get();
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.save();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const hist = new Int32Array(256);
    let count = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        hist[data[i]]++;
        hist[data[i + 1]]++;
        hist[data[i + 2]]++;
        count += 3;
      }
    }

    if (count > 0) {
      const clipCount = Math.floor(count * 0.002);
      
      let minVal = 0, maxVal = 255;
      let sum = 0;
      for (let v = 0; v < 256; v++) {
        sum += hist[v];
        if (sum > clipCount) { minVal = v; break; }
      }
      sum = 0;
      for (let v = 255; v >= 0; v--) {
        sum += hist[v];
        if (sum > clipCount) { maxVal = v; break; }
      }

      const range = maxVal - minVal || 1;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = Math.min(255, Math.max(0, ((data[i] - minVal) / range) * 255));
          data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - minVal) / range) * 255));
          data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - minVal) / range) * 255));
        }
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    if (selectionRect) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
      ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    } else if (lassoPaths && lassoPaths.length > 0) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x - offX, path[0].y - offY);
        path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
    }

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Auto Contrast');
  },

  autoColor: () => {
    const { layers, activeLayerId, updateLayer, recordHistory, selectionRect, lassoPaths, isInverseSelection } = get();
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.save();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let count = 0;
    const rHist = new Int32Array(256);
    const gHist = new Int32Array(256);
    const bHist = new Int32Array(256);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 0) {
        rHist[data[i]]++;
        gHist[data[i + 1]]++;
        bHist[data[i + 2]]++;
        count++;
      }
    }

    if (count > 0) {
      const clipCount = Math.floor(count * 0.002);
      
      let rMin = 0, rMax = 255;
      let rSum = 0;
      for (let v = 0; v < 256; v++) { rSum += rHist[v]; if (rSum > clipCount) { rMin = v; break; } }
      rSum = 0;
      for (let v = 255; v >= 0; v--) { rSum += rHist[v]; if (rSum > clipCount) { rMax = v; break; } }

      let gMin = 0, gMax = 255;
      let gSum = 0;
      for (let v = 0; v < 256; v++) { gSum += gHist[v]; if (gSum > clipCount) { gMin = v; break; } }
      gSum = 0;
      for (let v = 255; v >= 0; v--) { gSum += gHist[v]; if (gSum > clipCount) { gMax = v; break; } }

      let bMin = 0, bMax = 255;
      let bSum = 0;
      for (let v = 0; v < 256; v++) { bSum += bHist[v]; if (bSum > clipCount) { bMin = v; break; } }
      bSum = 0;
      for (let v = 255; v >= 0; v--) { bSum += bHist[v]; if (bSum > clipCount) { bMax = v; break; } }

      const rRange = rMax - rMin || 1;
      const gRange = gMax - gMin || 1;
      const bRange = bMax - bMin || 1;

      let rTotal = 0, gTotal = 0, bTotal = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = Math.min(255, Math.max(0, ((data[i] - rMin) / rRange) * 255));
          data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - gMin) / gRange) * 255));
          data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - bMin) / bRange) * 255));

          rTotal += data[i];
          gTotal += data[i + 1];
          bTotal += data[i + 2];
        }
      }

      const rMean = rTotal / count;
      const gMean = gTotal / count;
      const bMean = bTotal / count;

      const targetMean = (rMean + gMean + bMean) / 3;

      const clampMean = (m: number) => Math.min(0.999, Math.max(0.001, m / 255));
      const targetNormalized = clampMean(targetMean);
      const rNormalized = clampMean(rMean);
      const gNormalized = clampMean(gMean);
      const bNormalized = clampMean(bMean);

      const rGamma = Math.log(targetNormalized) / Math.log(rNormalized);
      const gGamma = Math.log(targetNormalized) / Math.log(gNormalized);
      const bGamma = Math.log(targetNormalized) / Math.log(bNormalized);

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0) {
          data[i] = Math.min(255, Math.max(0, Math.pow(data[i] / 255, rGamma) * 255));
          data[i + 1] = Math.min(255, Math.max(0, Math.pow(data[i + 1] / 255, gGamma) * 255));
          data[i + 2] = Math.min(255, Math.max(0, Math.pow(data[i + 2] / 255, bGamma) * 255));
        }
      }
    }

    tempCtx.putImageData(imageData, 0, 0);

    if (selectionRect) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
      ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    } else if (lassoPaths && lassoPaths.length > 0) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
      lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x - offX, path[0].y - offY);
        path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
    }

    ctx.drawImage(tempCanvas, 0, 0);
    ctx.restore();

    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Auto Color');
  },

  applyFilterAction: (filterType) => {
    const { setIsFilterGalleryDialogOpen, setFilterGallerySelectedType } = get();
    setFilterGallerySelectedType(filterType);
    setIsFilterGalleryDialogOpen(true);
  },

  applyActualFilter: (filterType, options) => {
    const { layers, activeLayerId, updateLayer, recordHistory, selectionRect, lassoPaths, isInverseSelection, addAlert } = get();
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    ctx.save();

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let resultData: ImageData | null = null;

    try {
      switch (filterType.toLowerCase()) {
        case 'average':
          resultData = FilterService.average(imageData);
          break;
        case 'blur':
          resultData = FilterService.boxBlur(imageData, options.radius ?? 2);
          break;
        case 'gaussian_blur':
          resultData = FilterService.boxBlur(imageData, options.radius ?? 5);
          break;
        case 'motion_blur':
          resultData = FilterService.motionBlur(imageData, options.radius ?? 10, options.angle ?? 0);
          break;
        case 'displace':
          resultData = FilterService.ripple(imageData, 40, options.scale ?? 10);
          break;
        case 'pinch':
          resultData = FilterService.pinch(imageData, options.strength ?? 1.5);
          break;
        case 'ripple':
          resultData = FilterService.ripple(imageData, options.wavelength ?? 30, options.amplitude ?? 10);
          break;
        case 'wave':
          resultData = FilterService.wave(imageData, options.frequency ?? 20, options.amplitude ?? 10);
          break;
        case 'add_noise':
          resultData = FilterService.addNoise(imageData, options.amount ?? 10);
          break;
        case 'dust_scratches':
          resultData = FilterService.median(imageData, options.radius ?? 2);
          break;
        case 'median':
          resultData = FilterService.median(imageData, options.radius ?? 3);
          break;
        case 'sharpen':
          resultData = FilterService.convolve(imageData, [0, -1, 0, -1, 5, -1, 0, -1, 0]);
          break;
        case 'sharpen_more':
          resultData = FilterService.convolve(imageData, [-1, -1, -1, -1, 9, -1, -1, -1, -1]);
          break;
        case 'unsharp_mask':
          resultData = FilterService.unsharpMask(imageData, options.radius ?? 2, options.amount ?? 100);
          break;
        case 'emboss':
          resultData = FilterService.convolve(imageData, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 128);
          break;
        case 'find_edges':
          resultData = FilterService.convolve(imageData, [-1, -1, -1, -1, 8, -1, -1, -1, -1]);
          break;
        case 'oil_paint':
          resultData = FilterService.oilPaint(imageData, options.radius ?? 2, options.intensity ?? 10);
          break;
        case 'high_pass':
          resultData = FilterService.highPass(imageData, options.radius ?? 10);
          break;
        case 'maximum':
          resultData = FilterService.minMax(imageData, options.radius ?? 3, true);
          break;
        case 'minimum':
          resultData = FilterService.minMax(imageData, options.radius ?? 3, false);
          break;
        case 'camera_raw': {
          resultData = imageData;
          ctx.restore();
          setTimeout(() => {
            get().autoTone();
            get().autoColor();
          }, 0);
          return;
        }
        default:
          addAlert({ type: 'error', message: 'Unknown filter type: ' + filterType });
          ctx.restore();
          return;
      }
    } catch (err: any) {
      console.error('[applyActualFilter] Error:', err);
      addAlert({ type: 'error', message: 'Filter failed: ' + err.message });
      ctx.restore();
      return;
    }

    if (resultData) {
      tempCtx.putImageData(resultData, 0, 0);

      if (selectionRect) {
        const layer = layers.find(l => l.id === activeLayerId);
        const offX = layer?.position.x || 0;
        const offY = layer?.position.y || 0;
        ctx.beginPath();
        if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
        ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
        ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
      } else if (lassoPaths && lassoPaths.length > 0) {
        const layer = layers.find(l => l.id === activeLayerId);
        const offX = layer?.position.x || 0;
        const offY = layer?.position.y || 0;
        ctx.beginPath();
        if (isInverseSelection) ctx.rect(0, 0, canvas.width, canvas.height);
        lassoPaths.forEach(path => {
          if (path.length < 3) return;
          ctx.moveTo(path[0].x - offX, path[0].y - offY);
          path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
          ctx.closePath();
        });
        ctx.clip('evenodd');
      }

      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();

      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory(`Filter: ${filterType}`);
      addAlert({ type: 'success', message: `${filterType} filter applied.` });
    } else {
      ctx.restore();
    }
  },

  flipCanvas: async (direction) => {
    const state = get();
    const { layers, documentSize } = state;

    const flipImage = (dataUrl: string): Promise<string> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.save();
          if (direction === 'horizontal') {
            ctx.scale(-1, 1);
            ctx.drawImage(img, -img.width, 0);
          } else {
            ctx.scale(1, -1);
            ctx.drawImage(img, 0, -img.height);
          }
          ctx.restore();
          resolve(canvas.toDataURL());
        };
        img.src = dataUrl;
      });
    };

    const flipNode = async (node: Layer): Promise<Layer> => {
      let newPos = node.position;
      if (node.position) {
        if (direction === 'horizontal') {
          newPos = {
            x: documentSize.w - (node.position.x + (node.width || 0)),
            y: node.position.y
          };
        } else {
          newPos = {
            x: node.position.x,
            y: documentSize.h - (node.position.y + (node.height || 0))
          };
        }
      }

      let newDataUrl = node.dataUrl;
      if (node.dataUrl && node.type === 'paint') {
        newDataUrl = await flipImage(node.dataUrl);
      }

      let newChildren = node.children;
      if (node.children && node.children.length > 0) {
        newChildren = await Promise.all(node.children.map(child => flipNode(child)));
      }

      return {
        ...node,
        position: newPos,
        dataUrl: newDataUrl,
        children: newChildren
      };
    };

    try {
      const flippedLayers = await Promise.all(layers.map(layer => flipNode(layer)));
      set({ layers: flippedLayers });
      state.recordHistory(`Flip Canvas ${direction === 'horizontal' ? 'Horizontal' : 'Vertical'}`);
      state.addAlert?.({
        type: 'success',
        message: `Flipped canvas ${direction === 'horizontal' ? 'horizontally' : 'vertically'}.`
      });
    } catch (err: any) {
      console.error('[flipCanvas] Error:', err);
      state.addAlert?.({
        type: 'error',
        message: `Failed to flip canvas: ${err.message}`
      });
    }
  },

  trimCanvas: () => {
    const state = get();
    const { layers, documentSize } = state;

    const canvas = document.createElement('canvas');
    canvas.width = documentSize.w;
    canvas.height = documentSize.h;
    const ctx = canvas.getContext('2d')!;

    const drawNode = (node: Layer, parentX = 0, parentY = 0) => {
      if (!node.visible) return;
      const lx = parentX + (node.position?.x || 0);
      const ly = parentY + (node.position?.y || 0);

      if ((node.type === 'group' || node.type === 'artboard') && node.children) {
        [...node.children].reverse().forEach(child => drawNode(child, lx, ly));
        return;
      }

      const layerCanvas = document.querySelector(`canvas[data-layer-id="${node.id}"]`) as HTMLCanvasElement;
      if (layerCanvas) {
        ctx.save();
        ctx.globalAlpha = node.opacity ?? 1;
        ctx.drawImage(layerCanvas, lx, ly);
        ctx.restore();
      }
    };

    [...layers].reverse().forEach(layer => drawNode(layer));

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const w = canvas.width;
    const h = canvas.height;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    let foundVisible = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 0) {
          foundVisible = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!foundVisible) {
      state.addAlert?.({
        type: 'warning',
        message: 'No visible content found to trim.'
      });
      return;
    }

    const newW = maxX - minX + 1;
    const newH = maxY - minY + 1;

    const shiftNode = (node: Layer, isTopLevel = false): Layer => {
      let newPos = node.position;
      if (isTopLevel && node.position) {
        newPos = {
          x: node.position.x - minX,
          y: node.position.y - minY
        };
      }
      return {
        ...node,
        position: newPos,
        children: node.children ? node.children.map(child => shiftNode(child, false)) : undefined
      };
    };

    const trimmedLayers = layers.map(layer => shiftNode(layer, true));

    set({
      documentSize: { w: newW, h: newH },
      layers: trimmedLayers
    });

    state.recordHistory('Trim Canvas');
    state.addAlert?.({
      type: 'success',
      message: `Trimmed canvas to ${newW} x ${newH} px.`
    });
  },
});

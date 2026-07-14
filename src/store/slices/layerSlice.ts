
import type { StateCreator } from 'zustand';
import { nanoid } from 'nanoid';
import type { EditorState, Layer } from '../types';
import { findLayerById, findParentNode, removeNode, insertNode, updateNode, flattenTree, moveNode, reorderNodes } from '../../utils/layerUtils';

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
  addAdjustmentLayer: (type: 'brightness_contrast' | 'hue_saturation' | 'black_white' | 'photo_effects' | 'levels' | 'curves' | 'exposure' | 'vibrance' | 'color_balance') => void;
  autoAlignLayers: () => Promise<void>;
  autoBlendLayers: () => Promise<void>;
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

  duplicateLayer: (id) => set((state) => {
    const layerToDup = findLayerById(state.layers, id);
    if (!layerToDup) return state;
    const newLayer: Layer = {
      ...layerToDup,
      id: nanoid(),
      name: `${layerToDup.name} Copy`,
      position: layerToDup.position ? { x: layerToDup.position.x + 20, y: layerToDup.position.y + 20 } : {x:0, y:0}
    };
    return {
      layers: insertNode(state.layers, newLayer), // Insert at top level for now
      activeLayerId: newLayer.id,
    };
  }),

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
});

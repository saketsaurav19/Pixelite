import type { EditorState } from '../store/types';

export const copySelectionToClipboard = async (
  state: EditorState,
  merged: boolean = false
) => {
  const { documentSize, layers, activeLayerId, selectionRect, setClipboardDataUrl, setClipboardDataRect } = state;
  const canvas = document.createElement('canvas');
  canvas.width = documentSize.w;
  canvas.height = documentSize.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const targetLayers = merged ? layers.filter(l => l.visible) : layers.filter(l => l.id === activeLayerId && l.visible);

  if (targetLayers.length === 0) return;

  for (const layer of targetLayers) {
    if (layer.dataUrl) {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject();
        img.src = layer.dataUrl!;
      });

      ctx.globalCompositeOperation = layer.blendMode || 'source-over';
      ctx.globalAlpha = layer.opacity;

      if (layer.type === 'paint' || layer.type === 'image') {
        ctx.drawImage(img, layer.position.x, layer.position.y);
      }
    }
  }

  let finalDataUrl = '';
  let copyRect = selectionRect || { x: 0, y: 0, w: documentSize.w, h: documentSize.h };

  if (selectionRect) {
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = selectionRect.w;
    croppedCanvas.height = selectionRect.h;
    const croppedCtx = croppedCanvas.getContext('2d');
    if (croppedCtx) {
      croppedCtx.drawImage(
        canvas,
        selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h,
        0, 0, selectionRect.w, selectionRect.h
      );
      finalDataUrl = croppedCanvas.toDataURL('image/png');
    }
  } else {
    finalDataUrl = canvas.toDataURL('image/png');
  }

  setClipboardDataUrl(finalDataUrl);
  setClipboardDataRect(copyRect);
};

export const cutSelection = async (state: EditorState) => {
  const { activeLayerId, layers, updateLayer, recordHistory } = state;
  const layer = layers.find(l => l.id === activeLayerId);
  if (!layer || layer.locked || !layer.dataUrl) return;

  await copySelectionToClipboard(state, false);

  const { selectionRect, documentSize } = state;
  if (!selectionRect) return;

  const canvas = document.createElement('canvas');
  canvas.width = documentSize.w;
  canvas.height = documentSize.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = layer.dataUrl!;
  });

  ctx.drawImage(img, layer.position.x, layer.position.y);

  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);

  updateLayer(layer.id, {
    dataUrl: canvas.toDataURL('image/png'),
    position: { x: 0, y: 0 }
  });

  recordHistory('Cut');
};

export const pasteFromClipboard = async (
  state: EditorState,
  mode: 'center' | 'in_place' | 'into' | 'outside'
) => {
  const { clipboardDataUrl, clipboardDataRect, documentSize, selectionRect, addLayer, recordHistory } = state;

  if (!clipboardDataUrl) return;

  let x = 0;
  let y = 0;

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
    img.src = clipboardDataUrl;
  });

  if (mode === 'in_place' && clipboardDataRect) {
    x = clipboardDataRect.x;
    y = clipboardDataRect.y;
  } else {
    x = documentSize.w / 2 - img.width / 2;
    y = documentSize.h / 2 - img.height / 2;
  }

  if (mode === 'into' || mode === 'outside') {
    if (!selectionRect) return; // Need a selection to paste into/outside

    const canvas = document.createElement('canvas');
    canvas.width = documentSize.w;
    canvas.height = documentSize.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(img, x, y);

    ctx.globalCompositeOperation = mode === 'into' ? 'destination-in' : 'destination-out';
    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);

    addLayer({
      dataUrl: canvas.toDataURL('image/png'),
      position: { x: 0, y: 0 },
      type: 'paint',
      name: `Pasted ${mode === 'into' ? 'Into' : 'Outside'}`,
    });

  } else {
    addLayer({
      dataUrl: clipboardDataUrl,
      position: { x, y },
      type: 'paint',
      name: 'Pasted Layer',
    });
  }

  recordHistory(`Paste ${mode}`);
};

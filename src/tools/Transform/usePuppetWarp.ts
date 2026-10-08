import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { createPuppetMesh, deformMeshWithPins, type PuppetWarpMode } from '../../utils/puppetWarpUtils';
import { toolState } from '../toolState';

export interface PuppetWarpState {
  activePin: number | null;
  isDragging: boolean;
  triangles: number[];
  meshVersion: number;
}

export function usePuppetWarp(options: {
  activeLayerId: string;
  layer: any;
  transformMode: string;
  activeTool: string;
  updateLayer: (id: string, data: any) => void;
  getCoordinates: (cx: number, cy: number) => any;
  zoom: number;
}): PuppetWarpState & {
  beginPinDrag: (e: any, index?: number) => void;
  removePin: (_idx: number) => (e?: any) => void;
  addPinAtCanvasCoords: (canvasX: number, canvasY: number) => void;
  setActivePin: (idx: number | null) => void;
} {
  const {
    activeLayerId,
    layer,
    transformMode,
    activeTool,
    updateLayer,
    getCoordinates,
  } = options;

  const isPuppet = transformMode === 'puppet' && activeTool === 'transform';

  const [activePin, setActivePin] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [, setCanvasReady] = useState(0); // incremented to force re-render after canvas capture

  const puppetMode: PuppetWarpMode = useStore((state) => state.puppetMode) || 'normal';
  const puppetDensity: number = useStore((state) => state.puppetDensity) || 5;

  const dragPinRef = useRef<number | null>(null);
  const layerRef = useRef<any>(layer);
  layerRef.current = layer;

  // 1. Initialize mesh if missing when in puppet mode
  useEffect(() => {
    if (!isPuppet || !layer || !activeLayerId) return;

    const documentSize = useStore.getState().documentSize;
    const w = layer.width || documentSize.w || 800;
    const h = layer.height || documentSize.h || 600;

    if (!layer.puppetRestPoints || layer.puppetRestPoints.length === 0 || !layer.warpGrid) {
      const mesh = createPuppetMesh(w, h, puppetDensity);
      updateLayer(activeLayerId, {
        puppetRestPoints: mesh.restPoints,
        puppetTriangles: mesh.triangles,
        puppetMeshVersion: (layer.puppetMeshVersion || 0) + 1,
        warpGrid: mesh.restPoints.map((p) => ({ ...p })),
        puppetPins: layer.puppetPins || [],
        puppetRestPins: layer.puppetRestPins || [],
      });
    }
  }, [isPuppet, activeLayerId, layer?.width, layer?.height, puppetDensity]);

  // 1b. Capture the original canvas image for rendering deformation.
  //     This runs when puppet mode becomes active so the rendering pipeline always
  //     has a clean source image regardless of whether the user clicked the canvas.
  useEffect(() => {
    if (!isPuppet || !layer || !activeLayerId) return;
    if (toolState.transformOriginalCanvas) return; // already captured

    const dataUrl = layer.dataUrl;
    if (!dataUrl) return;

    const layerW = layer.width || 800;
    const layerH = layer.height || 600;

    const img = new Image();
    img.onload = () => {
      const copy = document.createElement('canvas');
      copy.width = layerW;
      copy.height = layerH;
      const ctx = copy.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, layerW, layerH);
        toolState.transformOriginalCanvas = copy;
        toolState.transformOriginalImage = img;
        // Trigger a re-render so the layer rendering picks up the new origCanvas
        setCanvasReady(v => v + 1);
      }
    };
    img.src = dataUrl;
  }, [isPuppet, activeLayerId, layer?.dataUrl]);

  // 2. Re-deform mesh when puppetMode or density changes
  useEffect(() => {
    if (!isPuppet || !layer || !activeLayerId) return;
    if (!layer.puppetRestPoints || layer.puppetRestPoints.length === 0) return;

    const pins = layer.puppetPins || [];
    const restPins = layer.puppetRestPins || [];

    const newWarpGrid = deformMeshWithPins(layer.puppetRestPoints, pins, restPins, puppetMode);
    updateLayer(activeLayerId, { warpGrid: newWarpGrid });
  }, [puppetMode, isPuppet]);

  const addPinAtCanvasCoords = useCallback(
    (canvasX: number, canvasY: number) => {
      if (!isPuppet || !layer || !activeLayerId) return;

      const layerX = layer.position?.x || 0;
      const layerY = layer.position?.y || 0;

      const localX = canvasX - layerX;
      const localY = canvasY - layerY;

      const pins = [...(layer.puppetPins || [])];
      const restPins = [...(layer.puppetRestPins || [])];

      // Check if clicking close to an existing pin
      const hitIdx = pins.findIndex(
        (p) => Math.hypot(p.x - localX, p.y - localY) < 14
      );

      if (hitIdx !== -1) {
        setActivePin(hitIdx);
        return;
      }

      // Add new pin
      pins.push({ x: localX, y: localY });
      restPins.push({ x: localX, y: localY });

      const newPinIdx = pins.length - 1;
      const newWarpGrid = deformMeshWithPins(layer.puppetRestPoints || [], pins, restPins, puppetMode);

      updateLayer(activeLayerId, {
        puppetPins: pins,
        puppetRestPins: restPins,
        warpGrid: newWarpGrid,
      });

      setActivePin(newPinIdx);
    },
    [isPuppet, layer, activeLayerId, puppetMode, updateLayer]
  );

  const removePin = useCallback(
    (idx: number) => (e?: any) => {
      e?.stopPropagation?.();
      e?.preventDefault?.();
      if (!layer || !activeLayerId) return;

      const pins = (layer.puppetPins || []).filter((_: any, i: number) => i !== idx);
      const restPins = (layer.puppetRestPins || []).filter((_: any, i: number) => i !== idx);

      const newWarpGrid = deformMeshWithPins(layer.puppetRestPoints || [], pins, restPins, puppetMode);

      updateLayer(activeLayerId, {
        puppetPins: pins,
        puppetRestPins: restPins,
        warpGrid: newWarpGrid,
      });

      setActivePin(null);
    },
    [layer, activeLayerId, puppetMode, updateLayer]
  );

  const beginPinDrag = useCallback(
    (e: any, index?: number) => {
      e?.stopPropagation?.();
      if (!isPuppet || !layer || !activeLayerId) return;

      const currentPins = layer.puppetPins || [];

      let pinIdx = index;
      if (pinIdx === undefined) {
        const coords = getCoordinates(e.clientX, e.clientY);
        const layerX = layer.position?.x || 0;
        const layerY = layer.position?.y || 0;
        const lx = coords.x - layerX;
        const ly = coords.y - layerY;

        pinIdx = currentPins.findIndex((p: any) => Math.hypot(p.x - lx, p.y - ly) < 14);
        if (pinIdx === -1) {
          addPinAtCanvasCoords(coords.x, coords.y);
          return;
        }
      }

      setActivePin(pinIdx);
      setIsDragging(true);
      dragPinRef.current = pinIdx;

      const handleMove = (moveEvt: MouseEvent | TouchEvent) => {
        if (dragPinRef.current === null) return;
        const curLayer = layerRef.current;
        if (!curLayer || !activeLayerId) return;

        const clientX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : moveEvt.clientX;
        const clientY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : moveEvt.clientY;

        const coords = getCoordinates(clientX, clientY);
        const lx = coords.x - (curLayer.position?.x || 0);
        const ly = coords.y - (curLayer.position?.y || 0);

        const pins = [...(curLayer.puppetPins || [])];
        const restPins = curLayer.puppetRestPins || [];

        if (pins[dragPinRef.current]) {
          pins[dragPinRef.current] = { x: lx, y: ly };

          const newWarpGrid = deformMeshWithPins(curLayer.puppetRestPoints || [], pins, restPins, puppetMode);

          updateLayer(activeLayerId, {
            puppetPins: pins,
            warpGrid: newWarpGrid,
          });
        }
      };

      const handleUp = () => {
        setIsDragging(false);
        dragPinRef.current = null;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('mouseup', handleUp);
        window.removeEventListener('touchend', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    },
    [isPuppet, layer, activeLayerId, getCoordinates, addPinAtCanvasCoords, puppetMode, updateLayer]
  );

  // Keydown handler for Delete / Backspace to remove active pin
  useEffect(() => {
    if (!isPuppet || activePin === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const isTyping =
          document.activeElement?.tagName === 'INPUT' ||
          document.activeElement?.tagName === 'TEXTAREA' ||
          (document.activeElement as HTMLElement)?.contentEditable === 'true';

        if (!isTyping && activePin !== null) {
          e.preventDefault();
          removePin(activePin)();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPuppet, activePin, removePin]);

  if (!isPuppet) {
    return {
      activePin: null,
      isDragging: false,
      triangles: [],
      meshVersion: 0,
      beginPinDrag: () => {},
      removePin: () => () => {},
      addPinAtCanvasCoords: () => {},
      setActivePin: () => {},
    };
  }

  const triangles = layer?.puppetTriangles || [];
  const meshVersion = layer?.puppetMeshVersion || 0;

  return {
    activePin,
    isDragging,
    triangles,
    meshVersion,
    beginPinDrag,
    removePin,
    addPinAtCanvasCoords,
    setActivePin,
  };
}

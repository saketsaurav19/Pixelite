import { flushSync } from 'react-dom';
import type { CanvasContext, Point, Rect, CanvasRefs } from '../types';
import { getToolModule } from '../../../tools';
import { useStore } from '../../../store/useStore';

export const startAction = (
  clientX: number,
  clientY: number,
  e: React.MouseEvent | React.TouchEvent,
  context: CanvasContext,
  handlers: {
    setIsInteracting: (val: boolean) => void;
    setZoom: (val: number) => void;
    setTextEditor: (val: any) => void;
    setCropRect: (val: Rect | null) => void;
    setDraftShape: (val: Rect | null) => void;
    setVectorPaths: (val: any) => void;
    setActivePathIndex: (val: number | null) => void;
    setSelectedPoint: (val: any) => void;
    recordHistory: (label: string) => void;
    handleEyedropper: (x: number, y: number) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    startMouseRef: React.MutableRefObject<Point | null>;
    startOffsetRef: React.MutableRefObject<Point | null>;
    hiddenTextInputRef: React.RefObject<HTMLTextAreaElement | null>;
  }
) => {
  const { coords, activeTool, canvasOffset, lassoPaths, primaryOpacity } = context;

  const isAltPressedLocal = (e as any).altKey || context.isAlt;
  const isCtrlPressedLocal = (e as any).ctrlKey || (e as any).metaKey || context.isCtrl;
  let currentTool = activeTool;

  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrlPressedLocal) currentTool = 'direct_select' as any;
    else if (isAltPressedLocal) currentTool = 'convert_point' as any;
  }

  // Perspective Crop special handling (if inside quad)
  if (activeTool === 'perspective_crop' && lassoPaths.length > 0 && lassoPaths[0].length === 4) {
    const quad = lassoPaths[0];
    let isInsideQuad = false;
    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      if (((quad[i].y > coords.y) !== (quad[j].y > coords.y)) &&
          (coords.x < (quad[j].x - quad[i].x) * (coords.y - quad[i].y) / (quad[j].y - quad[i].y) + quad[i].x)) {
        isInsideQuad = !isInsideQuad;
      }
    }
    if (isInsideQuad) {
      (window as any)._pcPoints = quad.map(point => ({ ...point }));
      (window as any)._pcDragIdx = 8;
      (window as any)._pcStartPoint = { ...coords };
      (window as any)._pcOrigPoints = quad.map(point => ({ ...point }));
      handlers.setIsInteracting(true);
      refs.lastPointRef.current = coords;
      refs.startMouseRef.current = { x: clientX, y: clientY };
      refs.startOffsetRef.current = { ...canvasOffset };
      return;
    }
  }

  (window as any)._primaryOpacity = primaryOpacity;

  const activeToolModule = getToolModule(currentTool);
  // Allow start without ctx for tools that don't need it (crop, hand, etc)
  if (activeToolModule?.start) {
    activeToolModule.start(context as any);
    refs.lastPointRef.current = coords;
    refs.startMouseRef.current = { x: clientX, y: clientY };
    refs.startOffsetRef.current = { ...canvasOffset };
    return;
  }

  // Fallback for legacy hardcoded tools
  handlers.setIsInteracting(true);
  refs.lastPointRef.current = coords;
  refs.startMouseRef.current = { x: clientX, y: clientY };
  refs.startOffsetRef.current = { ...canvasOffset };

  if (activeTool === 'text' || activeTool === 'vertical_text') {
    if (context.setIsTyping) context.setIsTyping(true);
    flushSync(() => {
      handlers.setTextEditor({ ...coords, value: '' });
    });
    (window as any)._lastTextTool = activeTool;
    const input = refs.hiddenTextInputRef.current;
    if (input) {
      input.focus();
      input.setSelectionRange(0, 0);
    }
  }
};

export const moveAction = (
  clientX: number,
  clientY: number,
  context: CanvasContext,
  handlers: {
    setCurrentMousePos: (p: Point) => void;
    setCanvasOffset: (p: Point) => void;
    setCanvasRotation: (val: number) => void;
    setCropRect: (val: any) => void;
    setDraftShape: (val: any) => void;
    setSelectionRect: (val: any) => void;
    setVectorPaths: (val: any) => void;
    setIsInteracting: (val: boolean) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    startMouseRef: React.MutableRefObject<Point | null>;
    startOffsetRef: React.MutableRefObject<Point | null>;
    getCoordinates: (x: number, y: number) => Point | null;
    getSnappedCoords: (p: Point, exclude?: any) => Point;
  },
  state: {
    isInteracting: boolean;
    activeCropHandle: string | null;
    selectedPoint: any;
    activePathIndex: number | null;
  }
) => {
  const { coords, activeTool, zoom, isAlt, isCtrl } = context;
  handlers.setCurrentMousePos(coords);

  if (!state.isInteracting) return;

  let currentTool = activeTool;
  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrl) currentTool = 'direct_select' as any;
    else if (isAlt) currentTool = 'convert_point' as any;
  }

  const toolModule = getToolModule(currentTool);
  // Removed context.ctx check to allow crop/hand/etc to work without a layer
  if (toolModule?.move) {
    toolModule.move(context as any);
    refs.lastPointRef.current = coords;
    return;
  }

  // Fallback for tools not yet in modules
  if (currentTool === 'hand' && refs.startMouseRef.current && refs.startOffsetRef.current) {
    const dx = clientX - refs.startMouseRef.current.x;
    const dy = clientY - refs.startMouseRef.current.y;
    handlers.setCanvasOffset({
      x: refs.startOffsetRef.current.x + (dx * 2) / zoom,
      y: refs.startOffsetRef.current.y + (dy * 2) / zoom
    });
    return;
  }

  if (activeTool === 'rotate_view' && refs.lastPointRef.current) {
    const dx = coords.x - refs.lastPointRef.current.x;
    handlers.setCanvasRotation(useStore.getState().canvasRotation + dx * 0.5);
    refs.lastPointRef.current = coords;
    return;
  }

  refs.lastPointRef.current = coords;
};

export const endAction = (
  context: CanvasContext,
  handlers: {
    setIsInteracting: (val: boolean) => void;
    updateLayer: (id: string, updates: any) => void;
    recordHistory: (label: string) => void;
    addLayer: (layer: any) => void;
    setDraftShape: (val: any) => void;
    setGradientStart: (val: any) => void;
    applyGradient: (start: Point, end: Point) => void;
  },
  refs: {
    lastPointRef: React.MutableRefObject<Point | null>;
    canvasRefs: CanvasRefs;
  },
  state: {
    isInteracting: boolean;
    draftShape: Rect | null;
    gradientStart: Point | null;
  }
) => {
  if (!state.isInteracting) return;

  const { activeTool, activeLayerId, layers, brushColor, secondaryColor, strokeWidth } = context;

  const toolModule = getToolModule(activeTool);
  if (toolModule?.end) {
    toolModule.end(context as any);
  }

  // Paint tools commitment
  if (['brush', 'pencil', 'eraser', 'blur', 'sharpen', 'dodge', 'burn', 'healing', 'healing_brush', 'patch', 'smudge', 'clone', 'pattern_stamp', 'mixer_brush', 'color_replacement', 'background_eraser', 'magic_eraser', 'history_brush', 'art_history_brush'].includes(activeTool)) {
    const id = activeLayerId || layers[0]?.id;
    const canvas = refs.canvasRefs.current[id];
    if (canvas) {
      handlers.updateLayer(id, { dataUrl: canvas.toDataURL() });
      const historyLabel = activeTool.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      handlers.recordHistory(historyLabel);
    }
  }

  // Shape tools legacy handling
  if (['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) && state.draftShape) {
    const w = Math.abs(state.draftShape.w);
    const h = Math.abs(state.draftShape.h);
    if (w > 1 || h > 1) {
      let shapeType: any = activeTool === 'ellipse_shape' ? 'ellipse' : (activeTool === 'line_shape' ? 'path' : (activeTool === 'shape' ? 'rect' : 'path'));
      let points: any[] = [];
      let name = 'Shape';

      if (activeTool === 'line_shape') {
        points = [{ x: state.draftShape.w < 0 ? w : 0, y: state.draftShape.h < 0 ? h : 0 }, { x: state.draftShape.w < 0 ? 0 : w, y: state.draftShape.h < 0 ? 0 : h }];
        name = 'Line';
      } else if (activeTool === 'triangle_shape') {
        points = [
          { x: w / 2, y: state.draftShape.h < 0 ? h : 0 },
          { x: state.draftShape.w < 0 ? w : 0, y: state.draftShape.h < 0 ? 0 : h },
          { x: state.draftShape.w < 0 ? 0 : w, y: state.draftShape.h < 0 ? 0 : h }
        ];
        name = 'Triangle';
      } else if (activeTool === 'polygon_shape') {
        const sides = useStore.getState().polygonSides;
        const cx = w / 2;
        const cy = h / 2;
        const rx = w / 2;
        const ry = h / 2;
        for (let i = 0; i < sides; i++) {
          const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
          points.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
        }
        name = 'Polygon';
      } else if (activeTool === 'custom_shape') {
        const points_count = useStore.getState().starPoints;
        const cx = w / 2;
        const cy = h / 2;
        const outerRadius = Math.min(w, h) / 2;
        const innerRadius = outerRadius * (useStore.getState().starInnerRadius / 100);
        for (let i = 0; i < points_count * 2; i++) {
          const angle = (i * Math.PI) / points_count - Math.PI / 2;
          const radius = i % 2 === 0 ? outerRadius : innerRadius;
          points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
        }
        name = 'Star Shape';
      } else if (activeTool === 'shape') {
        name = 'Rectangle';
      } else if (activeTool === 'ellipse_shape') {
        name = 'Ellipse';
      }

      handlers.addLayer({
        name: name,
        type: 'shape',
        position: {
          x: state.draftShape.w >= 0 ? state.draftShape.x : state.draftShape.x + state.draftShape.w,
          y: state.draftShape.h >= 0 ? state.draftShape.y : state.draftShape.y + state.draftShape.h
        },
        shapeData: {
          type: shapeType,
          w, h,
          fill: activeTool === 'line_shape' ? '' : brushColor,
          stroke: activeTool === 'line_shape' ? brushColor : secondaryColor,
          strokeWidth: strokeWidth,
          points: points,
          closed: activeTool !== 'line_shape',
          cornerRadius: activeTool === 'shape' ? useStore.getState().cornerRadius : undefined
        }
      });
      handlers.recordHistory(`Add ${name}`);
    }
    handlers.setDraftShape(null);
  }

  if (activeTool === 'rotate_view') {
    handlers.recordHistory('Rotate View');
  }

  if (activeTool === 'move') {
    handlers.recordHistory('Move Layer');
  }

  if (activeTool !== 'polygonal_lasso') {
    handlers.setIsInteracting(false);
  }
  refs.lastPointRef.current = null;
};

export const handleDoubleClick = (context: CanvasContext) => {
  const toolModule = getToolModule(context.activeTool);
  if (toolModule?.doubleClick) {
    toolModule.doubleClick(context as any);
  }
};

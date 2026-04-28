import type { StateCreator } from 'zustand';
import type { EditorState, Tool } from '../types';

export interface ToolSlice {
  activeTool: Tool;
  activeToolVariants: Record<string, Tool>;
  brushSize: number;
  strokeWidth: number;
  brushColor: string;
  secondaryColor: string;
  primaryOpacity: number;
  secondaryOpacity: number;
  toolStrength: number;
  toolHardness: number;
  toningRange: 'shadows' | 'midtones' | 'highlights';
  spongeMode: 'desaturate' | 'saturate';
  redEyePupilSize: number;
  redEyeDarkenAmount: number;
  isTyping: boolean;
  cornerRadius: number;
  polygonSides: number;
  starPoints: number;
  starInnerRadius: number;
  gradientType: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond';
  healingSourceMode: 'sampled' | 'pattern';
  patchMode: 'source' | 'destination';
  contentAwareMoveMode: 'move' | 'extend';
  moveAutoSelect: boolean;
  moveShowTransform: boolean;
  textFontFamily: string;
  textAlign: 'left' | 'center' | 'right';
  textEditor: { x: number; y: number; value: string } | null;
  
  setActiveTool: (tool: Tool) => void;
  setToolVariant: (groupId: string, tool: Tool) => void;
  setBrushSize: (size: number) => void;
  setStrokeWidth: (width: number) => void;
  setBrushColor: (color: string) => void;
  setSecondaryColor: (color: string) => void;
  setPrimaryOpacity: (opacity: number) => void;
  setSecondaryOpacity: (opacity: number) => void;
  setToolStrength: (strength: number) => void;
  setToolHardness: (hardness: number) => void;
  setToningRange: (range: 'shadows' | 'midtones' | 'highlights') => void;
  setSpongeMode: (mode: 'desaturate' | 'saturate') => void;
  setRedEyePupilSize: (val: number) => void;
  setRedEyeDarkenAmount: (val: number) => void;
  setIsTyping: (val: boolean) => void;
  setCornerRadius: (radius: number) => void;
  setPolygonSides: (sides: number) => void;
  setStarPoints: (points: number) => void;
  setStarInnerRadius: (radius: number) => void;
  setGradientType: (type: 'linear' | 'radial' | 'angle' | 'reflected' | 'diamond') => void;
  setHealingSourceMode: (mode: 'sampled' | 'pattern') => void;
  setPatchMode: (mode: 'source' | 'destination') => void;
  setContentAwareMoveMode: (mode: 'move' | 'extend') => void;
  setMoveAutoSelect: (val: boolean) => void;
  setMoveShowTransform: (val: boolean) => void;
  setTextFontFamily: (val: string) => void;
  setTextAlign: (val: 'left' | 'center' | 'right') => void;
  setTextEditor: (editor: any) => void;
}

export const createToolSlice: StateCreator<EditorState, [], [], ToolSlice> = (set) => ({
  activeTool: 'move',
  activeToolVariants: {
    move: 'move',
    marquee: 'marquee',
    lasso: 'lasso',
    selection: 'quick_selection',
    crop: 'crop',
    eyedropper: 'eyedropper',
    healing: 'healing',
    brush: 'brush',
    history: 'history_brush',
    clone: 'clone',
    eraser: 'eraser',
    gradient: 'gradient',
    blur: 'blur',
    dodge: 'dodge',
    text: 'text',
    pen: 'pen',
    path: 'path_select',
    shape: 'shape',
    hand: 'hand',
    zoom: 'zoom_tool'
  },
  brushSize: 40,
  strokeWidth: 2,
  brushColor: '#000000',
  secondaryColor: '#555555',
  primaryOpacity: 1,
  secondaryOpacity: 1,
  toolStrength: 50,
  toolHardness: 50,
  toningRange: 'midtones',
  spongeMode: 'desaturate',
  redEyePupilSize: 50,
  redEyeDarkenAmount: 50,
  isTyping: false,
  cornerRadius: 0,
  polygonSides: 5,
  starPoints: 5,
  starInnerRadius: 40,
  gradientType: 'linear',
  healingSourceMode: 'sampled',
  patchMode: 'source',
  contentAwareMoveMode: 'move',
  moveAutoSelect: true,
  moveShowTransform: true,
  textFontFamily: 'Inter, system-ui, sans-serif',
  textAlign: 'left',
  textEditor: null,

  setActiveTool: (tool) => set({ activeTool: tool }),
  setToolVariant: (groupId, tool) => set((state) => ({
    activeToolVariants: { ...state.activeToolVariants, [groupId]: tool },
    activeTool: tool
  })),
  setBrushSize: (size) => set({ brushSize: size }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setBrushColor: (color) => set({ brushColor: color }),
  setSecondaryColor: (color) => set({ secondaryColor: color }),
  setPrimaryOpacity: (opacity) => set({ primaryOpacity: opacity }),
  setSecondaryOpacity: (opacity) => set({ secondaryOpacity: opacity }),
  setToolStrength: (strength) => set({ toolStrength: strength }),
  setToolHardness: (hardness) => set({ toolHardness: hardness }),
  setToningRange: (range) => set({ toningRange: range }),
  setSpongeMode: (mode) => set({ spongeMode: mode }),
  setRedEyePupilSize: (val) => set({ redEyePupilSize: val }),
  setRedEyeDarkenAmount: (val) => set({ redEyeDarkenAmount: val }),
  setIsTyping: (val) => set({ isTyping: val }),
  setCornerRadius: (radius) => set({ cornerRadius: radius }),
  setPolygonSides: (sides) => set({ polygonSides: sides }),
  setStarPoints: (points) => set({ starPoints: points }),
  setStarInnerRadius: (radius) => set({ starInnerRadius: radius }),
  setGradientType: (type) => set({ gradientType: type }),
  setHealingSourceMode: (mode) => set({ healingSourceMode: mode }),
  setPatchMode: (mode) => set({ patchMode: mode }),
  setContentAwareMoveMode: (mode) => set({ contentAwareMoveMode: mode }),
  setMoveAutoSelect: (val) => set({ moveAutoSelect: val }),
  setMoveShowTransform: (val) => set({ moveShowTransform: val }),
  setTextFontFamily: (val) => set({ textFontFamily: val }),
  setTextAlign: (val) => set({ textAlign: val }),
  setTextEditor: (updater) => set((state: any) => ({
    textEditor: typeof updater === 'function' ? updater(state.textEditor) : updater
  })),
});

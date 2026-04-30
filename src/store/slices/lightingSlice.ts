import type { StateCreator } from 'zustand';
import type { EditorState, Light } from '../types';
import { nanoid } from 'nanoid';

export interface LightingSlice {
  lights: Light[];
  isLightingEnabled: boolean;
  lightingQuality: 'low' | 'medium' | 'high';
  activeLightId: string | null;
  workflow: EditorState['workflow'];
  addLight: (light: Omit<Light, 'id'>) => void;
  updateLight: (id: string, updates: Partial<Light>) => void;
  removeLight: (id: string) => void;
  ambientIntensity: number;
  ambientColor: string;
  setLightingEnabled: (enabled: boolean) => void;
  setLightingQuality: (quality: 'low' | 'medium' | 'high') => void;
  setAmbientIntensity: (intensity: number) => void;
  setAmbientColor: (color: string) => void;
  setLayerDepthMap: (layerId: string, depthMap: string) => void;
  setLayerNormalMap: (layerId: string, normalMap: string) => void;
  setWorkflowStep: (step: EditorState['workflow']['step']) => void;
  setWorkflowStatus: (step: keyof EditorState['workflow']['status'], status: EditorState['workflow']['status'][keyof EditorState['workflow']['status']]) => void;
  setActiveLightId: (id: string | null) => void;
  lightingDepthScale: number;
  setLightingDepthScale: (scale: number) => void;
}

export const createLightingSlice: StateCreator<EditorState, [], [], LightingSlice> = (set) => ({
  lights: [],
  activeLightId: null,
  isLightingEnabled: false,
  lightingQuality: 'medium',
  ambientIntensity: 0.1,
  ambientColor: '#ffffff',
  lightingDepthScale: 200,
  workflow: {
    step: 'image' as const,
    status: {
      image: 'pending' as const,
      depth: 'pending' as const,
      simulation: 'pending' as const,
      refinement: 'pending' as const,
      output: 'pending' as const,
    },
  },
  setActiveLightId: (id) => set({ activeLightId: id }),
  setAmbientIntensity: (ambientIntensity) => set({ ambientIntensity }),
  setAmbientColor: (ambientColor) => set({ ambientColor }),
  addLight: (light) => set((state) => {
    const newId = nanoid();
    const lightCount = state.lights.length + 1;
    const name = light.name || `${light.type.charAt(0).toUpperCase() + light.type.slice(1)} Light ${lightCount}`;
    return {
      lights: [...state.lights, { ...light, id: newId, name }],
      activeLightId: newId
    };
  }),
  updateLight: (id, updates) => set((state) => ({
    lights: state.lights.map((l) => (l.id === id ? { ...l, ...updates } : l))
  })),
  removeLight: (id) => set((state) => ({
    lights: state.lights.filter((l) => l.id !== id)
  })),
  setLightingEnabled: (enabled) => set((state) => {
    // If enabling for the first time and no lights exist, add a default one
    if (enabled && state.lights.length === 0) {
      return { 
        isLightingEnabled: enabled,
        lights: [
          {
            id: nanoid(),
            name: 'Key Light',
            type: 'point',
            position: { x: state.documentSize.w * 0.25, y: state.documentSize.h * 0.2, z: 400 },
            intensity: 1.2,
            color: '#f5e1d2', // Peach/White
            radius: state.documentSize.w * 0.6,
            falloff: 'linear',
            visible: true
          },
          {
            id: nanoid(),
            name: 'Rim Light',
            type: 'point',
            position: { x: state.documentSize.w * 0.85, y: state.documentSize.h * 0.15, z: 350 },
            intensity: 1.0,
            color: '#ff5ec1', // Pink
            radius: state.documentSize.w * 0.5,
            falloff: 'linear',
            visible: true
          },
          {
            id: nanoid(),
            name: 'Fill Light',
            type: 'point',
            position: { x: state.documentSize.w * 0.75, y: state.documentSize.h * 0.8, z: 300 },
            intensity: 0.9,
            color: '#4da6ff', // Blue
            radius: state.documentSize.w * 0.5,
            falloff: 'linear',
            visible: true
          }
        ]
      };
    }
    return { isLightingEnabled: enabled };
  }),
  setLightingQuality: (quality) => set({ lightingQuality: quality }),
  setLayerDepthMap: (layerId, depthMap) => set((state) => ({
    layers: state.layers.map((l) => (l.id === layerId ? { ...l, depthMap } : l))
  })),
  setLayerNormalMap: (layerId, normalMap) => set((state) => ({
    layers: state.layers.map((l) => (l.id === layerId ? { ...l, normalMap } : l))
  })),
  setWorkflowStep: (step) => set((state) => ({
    workflow: { ...state.workflow, step }
  })),
  setWorkflowStatus: (step, status) => set((state) => ({
    workflow: {
      ...state.workflow,
      status: { ...state.workflow.status, [step]: status }
    }
  })),
  setLightingDepthScale: (scale) => set({ lightingDepthScale: scale }),
});

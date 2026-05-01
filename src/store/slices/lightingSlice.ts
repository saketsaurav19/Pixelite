import type { StateCreator } from 'zustand';
import type { EditorState, Light } from '../types';
import { nanoid } from 'nanoid';

// Helper for cinematic light positioning along an orbital arc
function computeInitialCinematicPosition(distance: number, center: { x: number; y: number }) {
  const maxDistance = 1000;
  const t = Math.max(0, Math.min(1, distance / maxDistance));

  // Straight line in Z: -600 (behind) to +1400 (far front)
  const z = (t * 2000) - 600;

  // Fixed cinematic offset: 300px right, 150px up from center
  return {
    x: center.x + 300,
    y: center.y - 150,
    z: z
  };
}

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
  showLightSource: boolean;
  updateLighting: (updates: Partial<Pick<LightingSlice, 'lightingDepthScale' | 'isLightingEnabled' | 'lightingQuality' | 'ambientIntensity' | 'ambientColor' | 'showLightSource'>>) => void;
}

export const createLightingSlice: StateCreator<EditorState, [], [], LightingSlice> = (set) => ({
  lights: [],
  activeLightId: null,
  isLightingEnabled: false,
  lightingQuality: 'medium',
  ambientIntensity: 0.1,
  ambientColor: '#ffffff',
  lightingDepthScale: 200,
  showLightSource: true,
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
  updateLight: (id, updates) => set((state) => {
    return {
      lights: state.lights.map((l) => {
        if (l.id !== id) return l;

        // If distance changed, recompute ONLY the Z position along the line
        if (updates.distance !== undefined) {
          const maxDistance = 1000;
          const t = Math.max(0, Math.min(1, updates.distance / maxDistance));

          // Straight line in Z: -600 (behind) to +1400 (far front)
          const z = (t * 2000) - 600;

          return {
            ...l,
            ...updates,
            position: {
              ...l.position,
              z: z
            }
          };
        }

        return { ...l, ...updates };
      })
    };
  }),
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
            name: 'Point Light',
            type: 'point',
            position: computeInitialCinematicPosition(500, { x: state.documentSize.w * 0.5, y: state.documentSize.h * 0.5 }),
            distance: 500,
            intensity: 1.0,
            color: '#ffffff',
            radius: state.documentSize.w * 0.4,
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
  updateLighting: (updates) => set((state) => ({ ...state, ...updates })),
});

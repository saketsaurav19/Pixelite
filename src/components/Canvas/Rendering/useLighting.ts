import { useEffect, useRef, useCallback } from 'react';
import { lightManager } from '../../../utils/webgpu/LightManager';
import { useStore } from '../../../store/useStore';

export const useLighting = (
  canvasRefs: React.MutableRefObject<{ [key: string]: HTMLCanvasElement | null }>,
  activeLayerId: string | null,
  layers: any[],
  isLightingEnabled: boolean,
  lights: any[],
  lightingQuality: 'low' | 'medium' | 'high',
  ambientIntensity: number
) => {
  const addLayer = useStore((state) => state.addLayer);
  const updateLayer = useStore((state) => state.updateLayer);
  const setLayerDepthMap = useStore((state) => state.setLayerDepthMap);
  const setActiveLayer = useStore((state) => state.setActiveLayer);
  const setWorkflowStep = useStore((state) => state.setWorkflowStep);
  const setWorkflowStatus = useStore((state) => state.setWorkflowStatus);
  const didLogListenerRef = useRef(false);

  const resolveTargetLayerId = useCallback(() => {
    if (activeLayerId) return activeLayerId;
    const fallbackLayer = layers.find((layer) => layer.visible !== false && canvasRefs.current[layer.id]);
    if (fallbackLayer) {
      console.log(`[Depth] No active layer selected, falling back to layer=${fallbackLayer.id} (${fallbackLayer.name})`);
      setActiveLayer(fallbackLayer.id);
      return fallbackLayer.id;
    }
    return null;
  }, [activeLayerId, layers, canvasRefs, setActiveLayer]);

  const upsertDepthLayer = (layerId: string, depthDataUrl: string) => {
    const state = useStore.getState();
    const sourceLayer = state.layers.find((layer) => layer.id === layerId);
    if (!sourceLayer) {
      console.warn(`[Depth] Could not save depth layer, source layer missing: ${layerId}`);
      return;
    }

    const depthLayerName = `${sourceLayer.name} Depth Map`;
    const existingDepthLayer = state.layers.find((layer) => layer.name === depthLayerName);
    if (existingDepthLayer) {
      console.log(`[Depth] Updating existing depth layer for ${sourceLayer.name}`);
      updateLayer(existingDepthLayer.id, {
        dataUrl: depthDataUrl,
        position: { ...sourceLayer.position },
        visible: true,
        opacity: 1
      });
      setActiveLayer(existingDepthLayer.id);
      return;
    }

    console.log(`[Depth] Creating new depth layer for ${sourceLayer.name}`);
    addLayer({
      name: depthLayerName,
      type: 'image',
      visible: true,
      locked: false,
      opacity: 1,
      position: { ...sourceLayer.position },
      blendMode: 'source-over',
      dataUrl: depthDataUrl
    });
  };

  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleRenderLighting = useCallback(async (immediate: boolean = false) => {
    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);

    const performRender = async () => {
      const targetLayerId = resolveTargetLayerId();
      if (!targetLayerId) return;

      const canvas = canvasRefs.current[targetLayerId];
      if (!canvas) return;

      console.log('[Lighting] Starting full relighting pipeline');
      setWorkflowStep('depth');
      setWorkflowStatus('image', 'completed');
      setWorkflowStatus('depth', 'loading');
      setWorkflowStatus('simulation', 'pending');
      setWorkflowStatus('refinement', 'pending');
      setWorkflowStatus('output', 'pending');
      
      window.dispatchEvent(new CustomEvent('lighting-start'));

      try {
        const layer = layers.find(l => l.id === targetLayerId);
        const layerPosition = layer?.position || { x: 0, y: 0 };

        // Transform lights to layer-relative coordinates
        const relativeLights = lights.map(light => ({
          ...light,
          position: {
            x: light.position.x - layerPosition.x,
            y: light.position.y - layerPosition.y,
            z: light.position.z
          }
        }));

        const litDataUrl = await lightManager.render(
          targetLayerId,
          canvas,
          relativeLights,
          { x: 0, y: 0 }, // Position is now 0 because lights are relative
          ambientIntensity,
          useStore.getState().ambientColor || '#ffffff',
          useStore.getState().lightingDepthScale || 200,
          lightingQuality,
          false,
          (step, status) => {
            setWorkflowStep(step);
            setWorkflowStatus(step, status);
          }
        );

        // Final output step
        setWorkflowStep('output');
        setWorkflowStatus('output', 'completed');

        // Dispatch the result to Canvas.tsx for rendering the overlay
        window.dispatchEvent(new CustomEvent('lighting-result', { 
          detail: { layerId: targetLayerId, dataUrl: litDataUrl } 
        }));
        
        console.log('[Lighting] Relighting pipeline complete');
      } catch (error) {
        console.error('[Lighting] Pipeline failed', error);
        setWorkflowStatus(useStore.getState().workflow.step, 'error');
      } finally {
        window.dispatchEvent(new CustomEvent('lighting-end'));
      }
    };

    if (immediate) {
      performRender();
    } else {
      renderTimeoutRef.current = setTimeout(performRender, 50); // Small debounce for smoothness
    }
  }, [resolveTargetLayerId, canvasRefs, lights, lightingQuality, ambientIntensity, setWorkflowStep, setWorkflowStatus]);

  useEffect(() => {
    const generateDepthMap = async () => {
      const targetLayerId = resolveTargetLayerId();
      if (!targetLayerId) {
        console.warn('[Depth] Generate depth ignored because there is no active or fallback layer');
        return;
      }

      const canvas = canvasRefs.current[targetLayerId];
      if (!canvas) {
        console.warn(`[Depth] Generate depth ignored because no canvas ref exists for layer=${targetLayerId}`);
        return;
      }

      window.dispatchEvent(new CustomEvent('lighting-start'));
      setWorkflowStep('depth');
      setWorkflowStatus('depth', 'loading');
      console.log(`[Depth] Generating depth map for layer=${targetLayerId}`);

      try {
        const depthDataUrl = await lightManager.getDepthPreviewDataUrl(targetLayerId, canvas);
        console.log('[Depth] Depth preview output ready');
        setLayerDepthMap(targetLayerId, depthDataUrl);
        upsertDepthLayer(targetLayerId, depthDataUrl);
        setWorkflowStatus('depth', 'completed');
        console.log('[Depth] Depth map saved as layer');
      } catch (error) {
        console.error('[Depth] Failed to generate depth map', error);
        setWorkflowStatus('depth', 'error');
      } finally {
        window.dispatchEvent(new CustomEvent('lighting-end'));
      }
    };

    if (!didLogListenerRef.current) {
      console.log('[Lighting] Hooks initialized and listening for events');
      didLogListenerRef.current = true;
    }

    const onRenderLighting = () => handleRenderLighting(true);

    window.addEventListener('generate-depth-map', generateDepthMap);
    window.addEventListener('render-lighting', onRenderLighting);
    
    return () => {
      window.removeEventListener('generate-depth-map', generateDepthMap);
      window.removeEventListener('render-lighting', onRenderLighting);
    };
  }, [resolveTargetLayerId, canvasRefs, addLayer, updateLayer, setActiveLayer, setLayerDepthMap, handleRenderLighting, setWorkflowStep, setWorkflowStatus]);

  // Auto-render when lights change and lighting is enabled
  useEffect(() => {
    if (isLightingEnabled && lights.length > 0) {
      handleRenderLighting();
    }
  }, [lights, isLightingEnabled, lightingQuality, ambientIntensity, handleRenderLighting]);
};


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
  const ambientColor = useStore((state) => state.ambientColor);
  const lightingDepthScale = useStore((state) => state.lightingDepthScale);
  const showLightSource = useStore((state) => state.showLightSource);
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

    const depthLayerId = `depth-${layerId}`;
    const existingDepthLayer = state.layers.find((layer) => layer.id === depthLayerId);

    if (existingDepthLayer) {
      updateLayer(depthLayerId, { dataUrl: depthDataUrl, visible: true });
    } else {
      addLayer({
        id: depthLayerId,
        name: `Depth Map - ${sourceLayer.name}`,
        type: 'image',
        visible: true,
        dataUrl: depthDataUrl,
        position: { ...sourceLayer.position },
        opacity: 1,
        blendMode: 'normal',
        locked: true,
      });
    }
    setLayerDepthMap(layerId, depthDataUrl);
  };

  const renderTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLightingEnabled) {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
      return;
    }

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

        const litDataUrl = await lightManager.render(
          targetLayerId,
          canvas,
          lights,
          layerPosition,
          ambientIntensity,
          ambientColor || '#ffffff',
          lightingDepthScale || 200,
          showLightSource ?? true,
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

        // Also save to store for the 'Apply' button
        useStore.getState().updateLighting({ lastResultUrl: litDataUrl });

        console.log('[Lighting] Relighting pipeline complete');
      } catch (error) {
        console.error('[Lighting] Pipeline failed', error);
        setWorkflowStatus(useStore.getState().workflow.step, 'error');
      } finally {
        window.dispatchEvent(new CustomEvent('lighting-end'));
      }
    };

    if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    renderTimeoutRef.current = setTimeout(performRender, 50); // Small debounce for smoothness

    return () => {
      if (renderTimeoutRef.current) clearTimeout(renderTimeoutRef.current);
    };
  }, [
    isLightingEnabled,
    resolveTargetLayerId,
    canvasRefs,
    lights,
    layers,
    lightingQuality,
    ambientIntensity,
    ambientColor,
    lightingDepthScale,
    showLightSource,
    setWorkflowStep,
    setWorkflowStatus
  ]);

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



    window.addEventListener('generate-depth-map', generateDepthMap);

    return () => {
      window.removeEventListener('generate-depth-map', generateDepthMap);
    };
  }, [resolveTargetLayerId, canvasRefs, setLayerDepthMap, setWorkflowStep, setWorkflowStatus]);

};


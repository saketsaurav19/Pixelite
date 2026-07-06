import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import { loadImage, applyPixiAdjustments, computeCurvesLut } from '../../utils/pixiUtils';
import type { Point } from '../../utils/pixiUtils';
import { flattenTree } from '../../utils/layerUtils';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import './Dialogs.css';

// Helper functions for mapping midtone slider position to gamma
function tToGamma(t: number): number {
  t = Math.max(0, Math.min(1, t));
  const invT = 1.0 - t;
  if (invT >= 0.5) {
    return Math.round((1.0 + 8.9 * ((invT - 0.5) / 0.5)) * 100) / 100;
  } else {
    return Math.round((0.01 + 0.99 * (invT / 0.5)) * 100) / 100;
  }
}

function gammaToT(gamma: number): number {
  if (gamma >= 1.0) {
    const invT = 0.5 + 0.5 * ((gamma - 1.0) / 8.9);
    return Math.max(0, Math.min(1, 1.0 - invT));
  } else {
    const invT = 0.5 * ((gamma - 0.01) / 0.99);
    return Math.max(0, Math.min(1, 1.0 - invT));
  }
}

// ----------------------------------------------------
// Histogram calculation and drawing helper functions
// ----------------------------------------------------

function getHistogramData(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const maxDim = 256;
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (w > maxDim || h > maxDim) {
    if (w > h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;
  const len = data.length;
  
  const rHist = new Uint32Array(256);
  const gHist = new Uint32Array(256);
  const bHist = new Uint32Array(256);
  const mHist = new Uint32Array(256); // Master RGB
  
  for (let i = 0; i < len; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    rHist[r]++;
    gHist[g]++;
    bHist[b]++;
    const m = Math.round((r + g + b) / 3);
    mHist[m]++;
  }
  
  return { rHist, gHist, bHist, mHist };
}

function drawHistogram(canvas: HTMLCanvasElement, data: Uint32Array, color: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  
  let maxVal = 0;
  // Ignore index 0 and 255 for scaling to avoid clipping histograms from black/white spikes
  for (let i = 1; i < 255; i++) {
    if (data[i] > maxVal) maxVal = data[i];
  }
  if (maxVal === 0) {
    for (let i = 0; i < 256; i++) {
      if (data[i] > maxVal) maxVal = data[i];
    }
  }
  if (maxVal === 0) maxVal = 1;
  
  ctx.beginPath();
  ctx.moveTo(0, h);
  
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * w;
    const val = data[i];
    const barHeight = (val / maxVal) * (h * 0.95);
    const y = h - barHeight;
    ctx.lineTo(x, y);
  }
  
  ctx.lineTo(w, h);
  ctx.closePath();
  
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0.05)');
  ctx.fillStyle = grad;
  ctx.fill();
  
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.25;
  ctx.stroke();
}

export const AdjustmentDialog: React.FC = () => {
  const dragControls = useDragControls();
  const activeAdjustmentModal = useStore((state) => state.activeAdjustmentModal);
  const setActiveAdjustmentModal = useStore((state) => state.setActiveAdjustmentModal);
  const activeLayerId = useStore((state) => state.activeLayerId);
  const layers = useStore((state) => state.layers);
  const updateLayer = useStore((state) => state.updateLayer);
  const recordHistory = useStore((state) => state.recordHistory);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const activeLayer = layers.find((l) => l.id === activeLayerId);

  // Store the original layer state
  const originalDataUrlRef = useRef<string | null>(null);
  const activeLayerIdRef = useRef<string | null>(null);
  const originalImageRef = useRef<HTMLImageElement | null>(null);
  const originalSettingsRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Slider / selection states
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [lightness, setLightness] = useState(0);
  const [effect, setEffect] = useState<'sepia' | 'vintage' | 'polaroid' | 'technicolor' | 'lsd' | 'kodachrome' | 'brownie' | 'night' | 'negative' | 'predator' | 'none'>('none');

  // Exposure states
  const [exposure, setExposure] = useState(0);
  const [offsetVal, setOffsetVal] = useState(0);
  const [exposureGamma, setExposureGamma] = useState(1);

  // Vibrance states
  const [vibrance, setVibrance] = useState(0);

  // Color Balance states
  const [colorBalanceTone, setColorBalanceTone] = useState<'shadows' | 'midtones' | 'highlights'>('midtones');
  const [cbShadows, setCbShadows] = useState({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
  const [cbMidtones, setCbMidtones] = useState({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
  const [cbHighlights, setCbHighlights] = useState({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
  const [preserveLuminosity, setPreserveLuminosity] = useState(true);

  // Levels states
  const [levelsChannel, setLevelsChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [levelsState, setLevelsState] = useState({
    master: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
    red: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
    green: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
    blue: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 }
  });

  // Curves states
  const [curvesChannel, setCurvesChannel] = useState<'master' | 'red' | 'green' | 'blue'>('master');
  const [curvesState, setCurvesState] = useState<{
    master: Point[];
    red: Point[];
    green: Point[];
    blue: Point[];
  }>({
    master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
    blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
  });
  const [activePointIdx, setActivePointIdx] = useState<number | null>(null);

  // Histogram references
  const [histogramData, setHistogramData] = useState<{
    rHist: Uint32Array;
    gHist: Uint32Array;
    bHist: Uint32Array;
    mHist: Uint32Array;
  } | null>(null);
  const histogramCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const curvesSvgRef = useRef<SVGSVGElement | null>(null);
  const levelsTrackRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<'black' | 'gamma' | 'white' | null>(null);
  const [isDraggingCurves, setIsDraggingCurves] = useState(false);

  // Refs for debouncing and preventing concurrent calls
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRef = useRef(false);
  const pendingSettingsRef = useRef<Parameters<typeof applyPixiAdjustments>[1] | null>(null);
  const isClosingRef = useRef(false);

  // Use refs for slider values to avoid re-registering keyboard handlers
  const sliderValuesRef = useRef<any>({});

  // Keep sliderValuesRef in sync with state
  useEffect(() => {
    sliderValuesRef.current = {
      brightness,
      contrast,
      hue,
      saturation,
      lightness,
      effect,
      exposure,
      offset: offsetVal,
      gamma: exposureGamma,
      vibrance,
      cbShadows,
      cbMidtones,
      cbHighlights,
      preserveLuminosity,
      levelsState,
      curvesState
    };
  }, [
    brightness, contrast, hue, saturation, lightness, effect,
    exposure, offsetVal, exposureGamma, vibrance,
    cbShadows, cbMidtones, cbHighlights, preserveLuminosity,
    levelsState, curvesState
  ]);

  // Render levels histogram whenever data or selected channel shifts
  useEffect(() => {
    if (!histogramData || !histogramCanvasRef.current) return;
    let data: Uint32Array;
    let color: string;
    
    if (levelsChannel === 'red') {
      data = histogramData.rHist;
      color = '#ff4444';
    } else if (levelsChannel === 'green') {
      data = histogramData.gHist;
      color = '#44ff44';
    } else if (levelsChannel === 'blue') {
      data = histogramData.bHist;
      color = '#4444ff';
    } else {
      data = histogramData.mHist;
      color = '#aaaaaa';
    }
    
    drawHistogram(histogramCanvasRef.current, data, color);
  }, [histogramData, levelsChannel, activeAdjustmentModal]);

  // Load the layer's image once when modal opens
  useEffect(() => {
    if (activeAdjustmentModal) {
      const state = useStore.getState();
      const currentLayer = state.layers.find((l: any) => l.id === state.activeLayerId);
      if (!currentLayer) return;

      let dataUrl = currentLayer.dataUrl;

      if (currentLayer.type === 'adjustment') {
        // Construct composite of all visible layers below it
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = state.documentSize.w;
        tempCanvas.height = state.documentSize.h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          const flat = flattenTree(state.layers);
          const adjIdx = flat.findIndex(l => l.id === currentLayer.id);
          if (adjIdx !== -1) {
            for (let k = flat.length - 1; k > adjIdx; k--) {
              const l = flat[k];
              if (!l.visible || l.type === 'group' || l.type === 'artboard') continue;
              const lCanvas = document.querySelector(`canvas[data-layer-id="${l.id}"]`) as HTMLCanvasElement;
              if (lCanvas) {
                tempCtx.save();
                tempCtx.globalAlpha = l.opacity ?? 1;
                const lx = l.position?.x || 0;
                const ly = l.position?.y || 0;
                tempCtx.drawImage(lCanvas, lx, ly);
                tempCtx.restore();
              }
            }
          }
        }
        dataUrl = tempCanvas.toDataURL();
      }

      // If it's a paint layer and doesn't have a dataUrl, initialize it
      if (!dataUrl && currentLayer.type === 'paint') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = currentLayer.width || state.documentSize.w;
        tempCanvas.height = currentLayer.height || state.documentSize.h;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          if (currentLayer.name === 'Background') {
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
          } else {
            tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);
          }
          dataUrl = tempCanvas.toDataURL();
          updateLayer(currentLayer.id, { dataUrl });
        }
      }

      if (dataUrl) {
        if (currentLayer.type === 'adjustment' && !currentLayer.dataUrl) {
          updateLayer(currentLayer.id, { dataUrl });
        }
        originalDataUrlRef.current = currentLayer.dataUrl || null;
        activeLayerIdRef.current = currentLayer.id;
        isClosingRef.current = false;
        setIsLoaded(false);

        // Load settings if adjustment layer, otherwise reset
        if (currentLayer.type === 'adjustment' && currentLayer.adjustmentData) {
          const settings = currentLayer.adjustmentData.settings;
          setBrightness(settings.brightness ?? 0);
          setContrast(settings.contrast ?? 0);
          setHue(settings.hue ?? 0);
          setSaturation(settings.saturation ?? 0);
          setLightness(settings.lightness ?? 0);
          setEffect(settings.effect ?? 'none');

          setExposure(settings.exposure?.exposure ?? 0);
          setOffsetVal(settings.exposure?.offset ?? 0);
          setExposureGamma(settings.exposure?.gamma ?? 1.0);

          setVibrance(settings.vibrance ?? 0);

          setCbShadows(settings.colorBalance?.shadows ?? { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setCbMidtones(settings.colorBalance?.midtones ?? { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setCbHighlights(settings.colorBalance?.highlights ?? { cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setPreserveLuminosity(settings.colorBalance?.preserveLuminosity ?? true);

          if (settings.levels) {
            setLevelsState(settings.levels);
          } else {
            setLevelsState({
              master: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
              red: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
              green: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
              blue: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 }
            });
          }

          if (settings.curves) {
            setCurvesState(settings.curves);
          } else {
            setCurvesState({
              master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
              red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
              green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
              blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
            });
          }

          sliderValuesRef.current = { ...settings };
          originalSettingsRef.current = { ...settings };
        } else {
          setBrightness(0);
          setContrast(0);
          setHue(0);
          setSaturation(0);
          setLightness(0);
          setEffect('none');
          setExposure(0);
          setOffsetVal(0);
          setExposureGamma(1.0);
          setVibrance(0);
          setCbShadows({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setCbMidtones({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setCbHighlights({ cyanRed: 0, magentaGreen: 0, yellowBlue: 0 });
          setPreserveLuminosity(true);
          setLevelsState({
            master: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
            red: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
            green: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 },
            blue: { inBlack: 0, inGamma: 1.0, inWhite: 255, outBlack: 0, outWhite: 255 }
          });
          setCurvesState({
            master: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
            red: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
            green: [{ x: 0, y: 0 }, { x: 255, y: 255 }],
            blue: [{ x: 0, y: 0 }, { x: 255, y: 255 }]
          });
          sliderValuesRef.current = {};
          originalSettingsRef.current = null;
        }

        setLevelsChannel('master');
        setCurvesChannel('master');
        setActivePointIdx(null);

        loadImage(dataUrl)
          .then((img) => {
            originalImageRef.current = img;
            setIsLoaded(true);

            // Compute histogram
            const hist = getHistogramData(img);
            setHistogramData(hist);

            // For Black & White, apply immediately on load
            if (activeAdjustmentModal === 'black_white' && currentLayer.type !== 'adjustment') {
              applyPreview({ greyscale: true });
            }
          })
          .catch((err) => {
            console.error('Failed to pre-load image:', err);
          });
      }
    }

    return () => {
      // Clear any pending debounce
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      originalImageRef.current = null;
    };
  }, [activeAdjustmentModal]);

  // Handle keyboard listener for Escape/Enter keys
  useEffect(() => {
    if (!activeAdjustmentModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeAdjustmentModal) return;
      if (e.key === 'Escape') {
        handleCancelRef.current();
      } else if (e.key === 'Enter') {
        handleOKRef.current();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeAdjustmentModal]);

  // Use refs for handlers to avoid stale closures in keyboard listener
  const handleCancelRef = useRef(() => {});
  const handleOKRef = useRef(() => {});

  handleCancelRef.current = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }

    const state = useStore.getState();
    const currentLayer = state.layers.find((l: any) => l.id === state.activeLayerId);

    if (currentLayer && currentLayer.type === 'adjustment') {
      if (currentLayer.isNew) {
        const sourceLayerId = state.adjustmentSourceLayerId;
        state.removeLayer(currentLayer.id);
        if (sourceLayerId) {
          const sourceExists = flattenTree(useStore.getState().layers).some((l: any) => l.id === sourceLayerId);
          if (sourceExists) {
            useStore.getState().setActiveLayer(sourceLayerId);
          }
        }
      } else if (originalSettingsRef.current) {
        updateLayer(currentLayer.id, {
          adjustmentData: {
            type: currentLayer.adjustmentData.type,
            settings: originalSettingsRef.current
          },
          dataUrl: originalDataUrlRef.current || undefined
        });
      }
    } else {
      if (originalDataUrlRef.current && activeLayerIdRef.current) {
        updateLayer(activeLayerIdRef.current, { dataUrl: originalDataUrlRef.current });
      }
    }
    setActiveAdjustmentModal(null);
  };

  handleOKRef.current = () => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    // Clear any pending debounce and flush immediately
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    // Apply any pending settings immediately before closing
    if (pendingSettingsRef.current) {
      flushPendingPreview();
    }

    const state = useStore.getState();
    const currentLayer = state.layers.find((l: any) => l.id === state.activeLayerId);

    if (currentLayer && currentLayer.type === 'adjustment') {
      let finalSettings: any = {};
      if (activeAdjustmentModal === 'brightness_contrast') {
        finalSettings = {
          brightness: sliderValuesRef.current.brightness,
          contrast: sliderValuesRef.current.contrast
        };
      } else if (activeAdjustmentModal === 'hue_saturation') {
        finalSettings = {
          hue: sliderValuesRef.current.hue,
          saturation: sliderValuesRef.current.saturation,
          lightness: sliderValuesRef.current.lightness
        };
      } else if (activeAdjustmentModal === 'black_white') {
        finalSettings = { greyscale: true };
      } else if (activeAdjustmentModal === 'photo_effects') {
        finalSettings = { effect: sliderValuesRef.current.effect };
      } else if (activeAdjustmentModal === 'exposure') {
        finalSettings = {
          exposure: {
            exposure: sliderValuesRef.current.exposure,
            offset: sliderValuesRef.current.offset,
            gamma: sliderValuesRef.current.gamma
          }
        };
      } else if (activeAdjustmentModal === 'vibrance') {
        finalSettings = { vibrance: sliderValuesRef.current.vibrance };
      } else if (activeAdjustmentModal === 'color_balance') {
        finalSettings = {
          colorBalance: {
            shadows: sliderValuesRef.current.cbShadows,
            midtones: sliderValuesRef.current.cbMidtones,
            highlights: sliderValuesRef.current.cbHighlights,
            preserveLuminosity: sliderValuesRef.current.preserveLuminosity
          }
        };
      } else if (activeAdjustmentModal === 'levels') {
        finalSettings = { levels: sliderValuesRef.current.levelsState };
      } else if (activeAdjustmentModal === 'curves') {
        finalSettings = { curves: sliderValuesRef.current.curvesState };
      }

      updateLayer(currentLayer.id, {
        isNew: false,
        dataUrl: undefined,
        adjustmentData: {
          type: currentLayer.adjustmentData.type,
          settings: finalSettings
        }
      });
    }

    let actionName = 'Adjustment';
    if (activeAdjustmentModal === 'brightness_contrast') actionName = 'Brightness/Contrast';
    else if (activeAdjustmentModal === 'hue_saturation') actionName = 'Hue/Saturation';
    else if (activeAdjustmentModal === 'black_white') actionName = 'Black & White';
    else if (activeAdjustmentModal === 'photo_effects') actionName = `Photo Effect: ${sliderValuesRef.current.effect}`;
    else if (activeAdjustmentModal === 'exposure') actionName = 'Exposure';
    else if (activeAdjustmentModal === 'vibrance') actionName = 'Vibrance';
    else if (activeAdjustmentModal === 'color_balance') actionName = 'Color Balance';
    else if (activeAdjustmentModal === 'levels') actionName = 'Levels';
    else if (activeAdjustmentModal === 'curves') actionName = 'Curves';

    recordHistory(actionName);
    setActiveAdjustmentModal(null);
  };

  const handleCancel = () => handleCancelRef.current();
  const handleOK = () => handleOKRef.current();

  // Debounced preview application
  const applyPreviewDebounced = useCallback((settings: Parameters<typeof applyPixiAdjustments>[1]) => {
    // Store the most recent settings
    pendingSettingsRef.current = settings;

    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Set new timeout - 80ms debounce for smooth but responsive UX
    debounceTimeoutRef.current = setTimeout(() => {
      flushPendingPreview();
    }, 80);
  }, []);

  // Immediately flush any pending preview
  const flushPendingPreview = useCallback(async () => {
    if (isApplyingRef.current) {
      // If currently applying, retry after a short delay
      setTimeout(() => flushPendingPreview(), 50);
      return;
    }

    const settings = pendingSettingsRef.current;
    if (!settings) return;
    pendingSettingsRef.current = null;

    const originalImage = originalImageRef.current;
    const layerId = activeLayerIdRef.current;
    if (!originalImage || !layerId) return;

    isApplyingRef.current = true;
    try {
      const resultDataUrl = await applyPixiAdjustments(originalImage, settings);
      // Only update if dialog hasn't been closed
      if (!isClosingRef.current && activeLayerIdRef.current === layerId) {
        updateLayer(layerId, { dataUrl: resultDataUrl });
      }
    } catch (err) {
      console.error('Failed to apply adjustment preview:', err);
    } finally {
      isApplyingRef.current = false;
    }
  }, [updateLayer]);

  // Non-debounced direct apply (for immediate effects like B&W on load)
  const applyPreview = useCallback(async (settings: Parameters<typeof applyPixiAdjustments>[1]) => {
    const originalImage = originalImageRef.current;
    const layerId = activeLayerIdRef.current;
    if (!originalImage || !layerId) return;

    try {
      const resultDataUrl = await applyPixiAdjustments(originalImage, settings);
      if (!isClosingRef.current) {
        updateLayer(layerId, { dataUrl: resultDataUrl });
      }
    } catch (err) {
      console.error('Failed to apply adjustment preview:', err);
    }
  }, [updateLayer]);

  // Slider handlers with debounced preview
  const handleBrightnessChange = (val: number) => {
    setBrightness(val);
    applyPreviewDebounced({ brightness: val, contrast });
  };

  const handleContrastChange = (val: number) => {
    setContrast(val);
    applyPreviewDebounced({ brightness, contrast: val });
  };

  const handleHueChange = (val: number) => {
    setHue(val);
    applyPreviewDebounced({ hue: val, saturation, lightness });
  };

  const handleSaturationChange = (val: number) => {
    setSaturation(val);
    applyPreviewDebounced({ hue, saturation: val, lightness });
  };

  const handleLightnessChange = (val: number) => {
    setLightness(val);
    applyPreviewDebounced({ hue, saturation, lightness: val });
  };

  const handleEffectChange = (eff: typeof effect) => {
    setEffect(eff);
    applyPreviewDebounced({ brightness, contrast, hue, saturation, lightness, effect: eff });
  };

  // 1. Exposure handlers
  const handleExposureChange = (exp: number) => {
    setExposure(exp);
    applyPreviewDebounced({ exposure: { exposure: exp, offset: offsetVal, gamma: exposureGamma } });
  };

  const handleOffsetChange = (off: number) => {
    setOffsetVal(off);
    applyPreviewDebounced({ exposure: { exposure, offset: off, gamma: exposureGamma } });
  };

  const handleExposureGammaChange = (gam: number) => {
    setExposureGamma(gam);
    applyPreviewDebounced({ exposure: { exposure, offset: offsetVal, gamma: gam } });
  };

  // 2. Vibrance handlers
  const handleVibranceChange = (vib: number) => {
    setVibrance(vib);
    applyPreviewDebounced({ vibrance: vib });
  };

  // 3. Color Balance handlers
  const updateColorBalance = (tone: typeof colorBalanceTone, key: 'cyanRed' | 'magentaGreen' | 'yellowBlue', val: number) => {
    let sh = { ...cbShadows };
    let mt = { ...cbMidtones };
    let hl = { ...cbHighlights };

    if (tone === 'shadows') {
      sh[key] = val;
      setCbShadows(sh);
    } else if (tone === 'midtones') {
      mt[key] = val;
      setCbMidtones(mt);
    } else {
      hl[key] = val;
      setCbHighlights(hl);
    }

    applyPreviewDebounced({
      colorBalance: {
        shadows: sh,
        midtones: mt,
        highlights: hl,
        preserveLuminosity
      }
    });
  };

  const handlePreserveLuminosityChange = (preserve: boolean) => {
    setPreserveLuminosity(preserve);
    applyPreviewDebounced({
      colorBalance: {
        shadows: cbShadows,
        midtones: cbMidtones,
        highlights: cbHighlights,
        preserveLuminosity: preserve
      }
    });
  };

  // 4. Levels handlers
  const updateLevelsValue = (chan: typeof levelsChannel, key: 'inBlack' | 'inGamma' | 'inWhite' | 'outBlack' | 'outWhite', val: number) => {
    const newState = { ...levelsState };
    const chanData = { ...newState[chan] };
    
    // Ensure limits (e.g. input black < input white)
    if (key === 'inBlack') {
      val = Math.min(val, chanData.inWhite - 2);
    } else if (key === 'inWhite') {
      val = Math.max(val, chanData.inBlack + 2);
    }
    
    chanData[key] = val as any;
    newState[chan] = chanData;
    setLevelsState(newState);

    applyPreviewDebounced({ levels: newState });
  };

  const startLevelsDrag = (e: React.PointerEvent<HTMLDivElement>, handle: 'black' | 'gamma' | 'white') => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingHandle(handle);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleLevelsDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingHandle || !levelsTrackRef.current) return;
    const rect = levelsTrackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percentage = x / rect.width;
    const val = Math.max(0, Math.min(255, Math.round(percentage * 255)));

    const currentLevelData = levelsState[levelsChannel];

    if (draggingHandle === 'black') {
      const newVal = Math.min(val, currentLevelData.inWhite - 2);
      updateLevelsValue(levelsChannel, 'inBlack', newVal);
    } else if (draggingHandle === 'white') {
      const newVal = Math.max(val, currentLevelData.inBlack + 2);
      updateLevelsValue(levelsChannel, 'inWhite', newVal);
    } else if (draggingHandle === 'gamma') {
      const minX = currentLevelData.inBlack;
      const maxX = currentLevelData.inWhite;
      const clampedVal = Math.max(minX + 1, Math.min(maxX - 1, val));
      const t = (clampedVal - minX) / (maxX - minX || 1);
      const newGamma = tToGamma(t);
      updateLevelsValue(levelsChannel, 'inGamma', newGamma);
    }
  };

  const endLevelsDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingHandle) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingHandle(null);
    }
  };

  // 5. Curves handlers
  const handleCurvesSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!curvesSvgRef.current) return;
    const rect = curvesSvgRef.current.getBoundingClientRect();
    // Correctly scale mouse coordinates relative to SVG viewBox size (256x256)
    const x = Math.max(0, Math.min(255, Math.round(((e.clientX - rect.left) / rect.width) * 255)));
    const y = Math.max(0, Math.min(255, Math.round((1.0 - (e.clientY - rect.top) / rect.height) * 255)));

    const points = curvesState[curvesChannel];

    // Check if clicking near an existing point (use threshold of 10 for easier grabbing)
    const existingIdx = points.findIndex(p => Math.abs(p.x - x) < 10 && Math.abs(p.y - y) < 10);
    if (existingIdx !== -1) {
      setActivePointIdx(existingIdx);
      setIsDraggingCurves(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      // Add a new point (endpoints at x=0 and x=255 are already locked and cannot be duplicated)
      if (x === 0 || x === 255) return;
      const newPoints = [...points, { x, y }].sort((a, b) => a.x - b.x);
      const newIdx = newPoints.findIndex(p => p.x === x && p.y === y);
      
      const newState = { ...curvesState, [curvesChannel]: newPoints };
      setCurvesState(newState);
      setActivePointIdx(newIdx);
      setIsDraggingCurves(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      applyPreviewDebounced({ curves: newState });
    }
  };

  const handleCurvesSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDraggingCurves || activePointIdx === null || !curvesSvgRef.current) return;
    const rect = curvesSvgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(255, Math.round(((e.clientX - rect.left) / rect.width) * 255)));
    const y = Math.max(0, Math.min(255, Math.round((1.0 - (e.clientY - rect.top) / rect.height) * 255)));

    const points = [...curvesState[curvesChannel]];
    const point = points[activePointIdx];

    // Restrain movement in X channel relative to neighbor points
    let minX = 0;
    let maxX = 255;
    if (activePointIdx > 0) {
      minX = points[activePointIdx - 1].x + 1;
    }
    if (activePointIdx < points.length - 1) {
      maxX = points[activePointIdx + 1].x - 1;
    }

    // Endpoints are locked in X coordinates (0 and 255)
    const newX = (activePointIdx === 0) ? 0 : (activePointIdx === points.length - 1) ? 255 : Math.max(minX, Math.min(maxX, x));
    const newY = Math.max(0, Math.min(255, y));

    point.x = newX;
    point.y = newY;
    points[activePointIdx] = point;

    const newState = { ...curvesState, [curvesChannel]: points };
    setCurvesState(newState);
    applyPreviewDebounced({ curves: newState });
  };

  const handleCurvesSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isDraggingCurves) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDraggingCurves(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeAdjustmentModal !== 'curves' || activePointIdx === null) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const points = curvesState[curvesChannel];
        // Do not allow deleting start/end points
        if (activePointIdx === 0 || activePointIdx === points.length - 1) return;
        
        const newPoints = points.filter((_, idx) => idx !== activePointIdx);
        const newState = { ...curvesState, [curvesChannel]: newPoints };
        setCurvesState(newState);
        setActivePointIdx(null);
        applyPreviewDebounced({ curves: newState });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [curvesState, curvesChannel, activePointIdx, activeAdjustmentModal]);

  if (!activeAdjustmentModal) return null;

  if (!activeLayer || (activeLayer.type !== 'adjustment' && !activeLayer.dataUrl)) {
    return (
      <div className="dialog-overlay" onClick={handleCancel}>
        <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '30rem' }}>
          <div className="dialog-header">
            <h2>Adjustment Error</h2>
            <button className="dialog-close" onClick={handleCancel}>
              <LucideIcons.X size={16} />
            </button>
          </div>
          <div className="dialog-body" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
            <LucideIcons.AlertTriangle size={48} style={{ color: '#ffcc00', marginBottom: '1rem' }} />
            <p>Please select an editable image or paint layer to apply WebGL adjustments.</p>
          </div>
          <div className="dialog-footer">
            <button className="btn-primary" onClick={handleCancel}>OK</button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    if (!isLoaded) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div className="loading-spinner" style={{ width: '2rem', height: '2rem', border: '3px solid #555', borderTopColor: '#0066cc', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
          <span>Loading WebGL context...</span>
        </div>
      );
    }

    switch (activeAdjustmentModal) {
      case 'brightness_contrast':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Brightness:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => handleBrightnessChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={brightness}
                  onChange={(e) => handleBrightnessChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Contrast:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => handleContrastChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={contrast}
                  onChange={(e) => handleContrastChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'hue_saturation':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Hue:</label>
                <input
                  type="number"
                  min="-180"
                  max="180"
                  value={hue}
                  onChange={(e) => handleHueChange(Math.max(-180, Math.min(180, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  value={hue}
                  onChange={(e) => handleHueChange(parseInt(e.target.value, 10))}
                  className="adjustment-range hue-range-slider"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Saturation:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => handleSaturationChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={saturation}
                  onChange={(e) => handleSaturationChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.5rem' }}>
              <div className="control-header">
                <label>Lightness:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={lightness}
                  onChange={(e) => handleLightnessChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={lightness}
                  onChange={(e) => handleLightnessChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'black_white':
        return (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            <LucideIcons.Eye size={40} style={{ color: '#0066cc', marginBottom: '0.75rem' }} />
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>
              The selected layer has been converted to Black & White using a WebGL-optimized color matrix filter.
            </p>
          </div>
        );

      case 'photo_effects':
        const presets: { name: string; value: typeof effect; desc: string }[] = [
          { name: 'None', value: 'none', desc: 'No filter' },
          { name: 'Sepia', value: 'sepia', desc: 'Warm sepia' },
          { name: 'Vintage', value: 'vintage', desc: 'Retro colors' },
          { name: 'Polaroid', value: 'polaroid', desc: 'Faded Polaroid' },
          { name: 'Technicolor', value: 'technicolor', desc: 'Bright cinema' },
          { name: 'LSD', value: 'lsd', desc: 'Trippy shift' },
          { name: 'Kodachrome', value: 'kodachrome', desc: 'Classic film' },
          { name: 'Brownie', value: 'brownie', desc: 'Old photo' },
          { name: 'Night', value: 'night', desc: 'Night vision' },
          { name: 'Negative', value: 'negative', desc: 'Inverted' },
          { name: 'Predator', value: 'predator', desc: 'Thermal' }
        ];

        return (
          <div className="effects-panel-container">
            <label style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: '0.75rem' }}>Select Photo Effect</label>
            <div className="effects-grid">
              {presets.map((preset) => (
                <button
                  key={preset.value}
                  className={`effect-card-btn ${effect === preset.value ? 'active' : ''}`}
                  onClick={() => handleEffectChange(preset.value)}
                >
                  <span className="effect-card-title">{preset.name}</span>
                  <span className="effect-card-desc">{preset.desc}</span>
                </button>
              ))}
            </div>
          </div>
        );

      case 'exposure':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Exposure:</label>
                <input
                  type="number"
                  min="-5"
                  max="5"
                  step="0.05"
                  value={exposure}
                  onChange={(e) => handleExposureChange(Math.max(-5, Math.min(5, parseFloat(e.target.value) || 0)))}
                  className="control-number-input"
                  style={{ width: '4.5rem' }}
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-5"
                  max="5"
                  step="0.05"
                  value={exposure}
                  onChange={(e) => handleExposureChange(parseFloat(e.target.value))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.25rem' }}>
              <div className="control-header">
                <label>Offset:</label>
                <input
                  type="number"
                  min="-1"
                  max="1"
                  step="0.005"
                  value={offsetVal}
                  onChange={(e) => handleOffsetChange(Math.max(-1, Math.min(1, parseFloat(e.target.value) || 0)))}
                  className="control-number-input"
                  style={{ width: '4.5rem' }}
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.005"
                  value={offsetVal}
                  onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1.25rem' }}>
              <div className="control-header">
                <label>Gamma Correction:</label>
                <input
                  type="number"
                  min="0.1"
                  max="9.9"
                  step="0.05"
                  value={exposureGamma}
                  onChange={(e) => handleExposureGammaChange(Math.max(0.1, Math.min(9.9, parseFloat(e.target.value) || 1.0)))}
                  className="control-number-input"
                  style={{ width: '4.5rem' }}
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0.1"
                  max="9.9"
                  step="0.05"
                  value={exposureGamma}
                  onChange={(e) => handleExposureGammaChange(parseFloat(e.target.value))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'vibrance':
        return (
          <div className="adjustment-sliders-container">
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Vibrance:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={vibrance}
                  onChange={(e) => handleVibranceChange(Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={vibrance}
                  onChange={(e) => handleVibranceChange(parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'color_balance':
        const currentToneData = colorBalanceTone === 'shadows' ? cbShadows : colorBalanceTone === 'midtones' ? cbMidtones : cbHighlights;

        return (
          <div className="adjustment-sliders-container">
            {/* Tone selector buttons */}
            <div className="cb-tone-selector">
              <button
                className={`cb-tone-btn ${colorBalanceTone === 'shadows' ? 'active' : ''}`}
                onClick={() => setColorBalanceTone('shadows')}
              >
                Shadows
              </button>
              <button
                className={`cb-tone-btn ${colorBalanceTone === 'midtones' ? 'active' : ''}`}
                onClick={() => setColorBalanceTone('midtones')}
              >
                Midtones
              </button>
              <button
                className={`cb-tone-btn ${colorBalanceTone === 'highlights' ? 'active' : ''}`}
                onClick={() => setColorBalanceTone('highlights')}
              >
                Highlights
              </button>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '0.75rem' }}>
              <div className="control-header">
                <label style={{ color: '#ff4444' }}>Cyan / Red:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={currentToneData.cyanRed}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'cyanRed', Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={currentToneData.cyanRed}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'cyanRed', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1rem' }}>
              <div className="control-header">
                <label style={{ color: '#44ff44' }}>Magenta / Green:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={currentToneData.magentaGreen}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'magentaGreen', Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={currentToneData.magentaGreen}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'magentaGreen', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '1rem' }}>
              <div className="control-header">
                <label style={{ color: '#4444ff' }}>Yellow / Blue:</label>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={currentToneData.yellowBlue}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'yellowBlue', Math.max(-100, Math.min(100, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="-100"
                  max="100"
                  value={currentToneData.yellowBlue}
                  onChange={(e) => updateColorBalance(colorBalanceTone, 'yellowBlue', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <label className="cb-preserve-lumi">
              <input
                type="checkbox"
                checked={preserveLuminosity}
                onChange={(e) => handlePreserveLuminosityChange(e.target.checked)}
              />
              Preserve Luminosity
            </label>
          </div>
        );

      case 'levels':
        const currentLevelData = levelsState[levelsChannel];

        return (
          <div className="levels-container">
            {/* Channel dropdown select */}
            <div className="adj-selector-row">
              <label>Channel:</label>
              <select
                value={levelsChannel}
                onChange={(e) => setLevelsChannel(e.target.value as any)}
                className="adj-select-dropdown"
              >
                <option value="master">RGB (Master)</option>
                <option value="red">Red</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
              </select>
            </div>

            {/* Histogram canvas representation */}
            <div className="levels-histogram-wrapper" style={{ marginBottom: '4px' }}>
              <canvas
                ref={histogramCanvasRef}
                width="350"
                height="90"
                className="levels-histogram-canvas"
              />
            </div>

            {/* Draggable sliders track directly below the histogram */}
            <div
              ref={levelsTrackRef}
              className="levels-slider-track"
              onPointerMove={handleLevelsDrag}
            >
              {/* Black Handle */}
              <div
                className={`levels-handle black ${draggingHandle === 'black' ? 'active' : ''}`}
                style={{ left: `${(currentLevelData.inBlack / 255) * 100}%` }}
                onPointerDown={(e) => startLevelsDrag(e, 'black')}
                onPointerMove={handleLevelsDrag}
                onPointerUp={endLevelsDrag}
              />
              
              {/* Gamma Handle */}
              <div
                className={`levels-handle gamma ${draggingHandle === 'gamma' ? 'active' : ''}`}
                style={{
                  left: `${((currentLevelData.inBlack + (currentLevelData.inWhite - currentLevelData.inBlack) * gammaToT(currentLevelData.inGamma)) / 255) * 100}%`
                }}
                onPointerDown={(e) => startLevelsDrag(e, 'gamma')}
                onPointerMove={handleLevelsDrag}
                onPointerUp={endLevelsDrag}
              />
              
              {/* White Handle */}
              <div
                className={`levels-handle white ${draggingHandle === 'white' ? 'active' : ''}`}
                style={{ left: `${(currentLevelData.inWhite / 255) * 100}%` }}
                onPointerDown={(e) => startLevelsDrag(e, 'white')}
                onPointerMove={handleLevelsDrag}
                onPointerUp={endLevelsDrag}
              />
            </div>

            {/* Input sliders & range values */}
            <div className="adjustment-control-row">
              <div className="control-header">
                <label>Input Black Point:</label>
                <input
                  type="number"
                  min="0"
                  max="253"
                  value={currentLevelData.inBlack}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inBlack', Math.max(0, Math.min(253, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="253"
                  value={currentLevelData.inBlack}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inBlack', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '0.75rem' }}>
              <div className="control-header">
                <label>Input Gamma (Midtones):</label>
                <input
                  type="number"
                  min="0.1"
                  max="9.9"
                  step="0.05"
                  value={currentLevelData.inGamma}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inGamma', Math.max(0.1, Math.min(9.9, parseFloat(e.target.value) || 1.0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0.1"
                  max="9.9"
                  step="0.05"
                  value={currentLevelData.inGamma}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inGamma', parseFloat(e.target.value))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '0.75rem' }}>
              <div className="control-header">
                <label>Input White Point:</label>
                <input
                  type="number"
                  min="2"
                  max="255"
                  value={currentLevelData.inWhite}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inWhite', Math.max(2, Math.min(255, parseInt(e.target.value, 10) || 255)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="2"
                  max="255"
                  value={currentLevelData.inWhite}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'inWhite', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            {/* Output limits sliders */}
            <div className="adjustment-control-row" style={{ marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #222' }}>
              <div className="control-header">
                <label>Output Black Limits:</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentLevelData.outBlack}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'outBlack', Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 0)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={currentLevelData.outBlack}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'outBlack', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>

            <div className="adjustment-control-row" style={{ marginTop: '0.75rem' }}>
              <div className="control-header">
                <label>Output White Limits:</label>
                <input
                  type="number"
                  min="0"
                  max="255"
                  value={currentLevelData.outWhite}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'outWhite', Math.max(0, Math.min(255, parseInt(e.target.value, 10) || 255)))}
                  className="control-number-input"
                />
              </div>
              <div className="slider-wrapper">
                <input
                  type="range"
                  min="0"
                  max="255"
                  value={currentLevelData.outWhite}
                  onChange={(e) => updateLevelsValue(levelsChannel, 'outWhite', parseInt(e.target.value, 10))}
                  className="adjustment-range"
                />
              </div>
            </div>
          </div>
        );

      case 'curves':
        const curvePoints = curvesState[curvesChannel];
        const lut = computeCurvesLut(curvePoints);
        
        // Generate SVG spline line path
        let pathD = `M 0 ${255 - lut[0]}`;
        for (let i = 1; i < 256; i++) {
          pathD += ` L ${i} ${255 - lut[i]}`;
        }

        const activePoint = activePointIdx !== null ? curvePoints[activePointIdx] : null;

        // Path stroke color based on channel selector
        const splineColor = curvesChannel === 'red' ? '#ff4444' : curvesChannel === 'green' ? '#44ff44' : curvesChannel === 'blue' ? '#4444ff' : '#ffffff';

        return (
          <div className="curves-editor-container">
            {/* Channel dropdown select */}
            <div className="adj-selector-row" style={{ width: '100%' }}>
              <label>Channel:</label>
              <select
                value={curvesChannel}
                onChange={(e) => {
                  setCurvesChannel(e.target.value as any);
                  setActivePointIdx(null);
                }}
                className="adj-select-dropdown"
              >
                <option value="master">RGB (Master)</option>
                <option value="red">Red</option>
                <option value="green">Green</option>
                <option value="blue">Blue</option>
              </select>
            </div>

            {/* Interactive SVG spline coordinate editor */}
            <div className="curves-svg-wrapper">
              <svg
                ref={curvesSvgRef}
                className="curves-svg"
                viewBox="0 0 256 256"
                onPointerDown={handleCurvesSvgPointerDown}
                onPointerMove={handleCurvesSvgPointerMove}
                onPointerUp={handleCurvesSvgPointerUp}
              >
                {/* Background Grid Lines every 64px */}
                <line x1="64" y1="0" x2="64" y2="256" className="curves-grid-line" />
                <line x1="128" y1="0" x2="128" y2="256" className="curves-grid-line" />
                <line x1="192" y1="0" x2="192" y2="256" className="curves-grid-line" />
                
                <line x1="0" y1="64" x2="256" y2="64" className="curves-grid-line" />
                <line x1="0" y1="128" x2="256" y2="128" className="curves-grid-line" />
                <line x1="0" y1="192" x2="256" y2="192" className="curves-grid-line" />

                {/* Diagonal baseline guide */}
                <line x1="0" y1="256" x2="256" y2="0" className="curves-grid-line-mid" />

                {/* Interpolated spline curve line path */}
                <path d={pathD} className="curves-line" stroke={splineColor} />

                {/* Render interactive coordinate control handle circles */}
                {curvePoints.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={255 - pt.y}
                    r={activePointIdx === idx ? 6 : 5}
                    className={`curves-point ${activePointIdx === idx ? 'active' : ''}`}
                  />
                ))}
              </svg>
            </div>

            <span className="curves-instructions">
              Click grid to add points, drag to adjust. Select a point and press Delete/Backspace to remove it.
            </span>

            {/* Active Point Output */}
            <div className="curves-inputs-row">
              <div className="curves-input-field">
                <span>Input:</span>
                <span>{activePoint ? activePoint.x : '--'}</span>
              </div>
              <div className="curves-input-field">
                <span>Output:</span>
                <span>{activePoint ? activePoint.y : '--'}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getModalTitle = () => {
    switch (activeAdjustmentModal) {
      case 'brightness_contrast':
        return 'Brightness / Contrast';
      case 'hue_saturation':
        return 'Hue / Saturation';
      case 'black_white':
        return 'Black & White';
      case 'photo_effects':
        return 'Photo Effects';
      case 'exposure':
        return 'Exposure';
      case 'vibrance':
        return 'Vibrance';
      case 'color_balance':
        return 'Color Balance';
      case 'levels':
        return 'Levels';
      case 'curves':
        return 'Curves';
      default:
        return 'Adjustments';
    }
  };

  return (
    <div className="dialog-overlay adjustment-overlay">
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content adjustment-dialog-content"
        style={isMobile ? {} : { maxWidth: '34rem' }}
      >
        <div
          className={`dialog-header ${isMobile ? '' : 'draggable-header'}`}
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
        >
          <h2>{getModalTitle()}</h2>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={16} />
          </button>
        </div>
        <div className="dialog-body">
          {isMobile && activeLayer?.dataUrl && (
            <div className="adjustment-mobile-preview-container">
              <img src={activeLayer.dataUrl} alt="Preview" className="adjustment-mobile-preview-image" />
            </div>
          )}
          {renderContent()}
        </div>
        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleCancel}>Cancel</button>
          <button className="btn-primary" onClick={handleOK} disabled={!isLoaded}>OK</button>
        </div>
      </motion.div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .dialog-overlay.adjustment-overlay {
            background: #1e1e1e !important;
            backdrop-filter: none !important;
            align-items: stretch !important;
            justify-content: stretch !important;
            padding: 0 !important;
          }
          .adjustment-dialog-content {
            width: 100vw !important;
            height: 100dvh !important;
            max-width: 100vw !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            display: flex !important;
            flex-direction: column !important;
            box-shadow: none !important;
            background: #1e1e1e !important;
          }
          .adjustment-dialog-content .dialog-body {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 1rem !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 1.25rem !important;
          }
          .adjustment-mobile-preview-container {
            width: 100% !important;
            height: 35vh !important;
            background: #0d0d0d !important;
            border-radius: 0.375rem !important;
            border: 1px solid #333 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            position: relative !important;
            margin-bottom: 0.25rem !important;
            flex-shrink: 0 !important;
          }
          .adjustment-mobile-preview-image {
            max-width: 100% !important;
            max-height: 100% !important;
            object-fit: contain !important;
          }
          .adjustment-dialog-content .dialog-footer {
            padding: 0.75rem 1rem !important;
            border-top: 1px solid #333 !important;
            background: #181818 !important;
            display: flex !important;
            justify-content: flex-end !important;
            gap: 0.75rem !important;
            flex-shrink: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};

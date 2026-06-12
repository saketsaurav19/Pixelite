import { findLayerById } from './utils/layerUtils';
import { Application } from "./scripting/Application";
import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from './store/useStore';
import { toolState } from './tools/toolState';
import { hexToRgba } from './utils/canvasUtils';
import Canvas from './components/Canvas/Canvas';
import { GlobalRulers } from './components/Canvas/UI/GlobalRulers';
import Toolbar from './components/Toolbar/Toolbar';
import OptionsBar from './components/OptionsBar/OptionsBar';
import ColorPicker from './components/shared/ColorPicker';
import { WelcomeOverlay } from './components/UI/WelcomeOverlay';

import MenuBar from './components/MenuBar/MenuBar';
import { removeBackground } from '@imgly/background-removal';
import TabBar from './components/TabBar/TabBar';
import { writePsd, readPsd } from 'ag-psd';
import { nanoid } from 'nanoid';
import { CloudStorageModal } from './components/Modals/CloudStorageModal';
import { PublicShareModal } from './components/Modals/PublicShareModal';
import { uploadToImgur, uploadToImageBB, saveToGoogleDrive } from './utils/cloudServices';
import { OpenFromCloudDialog } from './components/Dialogs/OpenFromCloudDialog';
import { NewDocumentDialog } from './components/Dialogs/NewDocumentDialog';
import { ExportAsDialog } from './components/Dialogs/ExportAsDialog';
import { FileInfoDialog } from './components/Dialogs/FileInfoDialog';
import { CameraDialog } from "./components/Dialogs/CameraDialog";
import { MobileCameraDialog } from "./components/Dialogs/MobileCameraDialog";
import { AlertContainer } from './components/UI/AlertContainer';
import './App.css';
import LayerContextMenu from './components/MenuSystem/LayerContextMenu';

const App: React.FC = () => {
  const [layerContextMenu, setLayerContextMenu] = React.useState<{ layerId: string; x: number; y: number } | null>(null);
  const [renamingLayerId, setRenamingLayerId] = React.useState<string | null>(null);
  const [newLayerName, setNewLayerName] = React.useState<string>('');
  const [longPressTimer, setLongPressTimer] = React.useState<NodeJS.Timeout | null>(null);
  const [longPressActiveLayerId, setLongPressActiveLayerId] = React.useState<string | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressActiveLayerId(null);
  };

  // RECURSIVE LAYER COMPONENT
  const renderLayerTree = (layerList: any[], depth = 0): React.ReactNode => {
    return layerList.map((layer) => (
      <div key={layer.id} style={{ marginLeft: depth * 12 + 'px' }}>
        <div
          className={`layer-node ${draggedIndex === layer.id ? 'dragging' : ''}`}
          draggable={true}
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggedIndex(layer.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (draggedIndex && draggedIndex !== layer.id) {
              // Very simple target logic for now: insert before
              useStore.getState().reorderNodesAction?.(draggedIndex, layer.id, 'before');
              recordHistory('Reorder Layers');
            }
            setDraggedIndex(null);
          }}
          onDragEnd={() => setDraggedIndex(null)}
        >
          <div
            className={`layer-row ${activeLayerId === layer.id ? 'active' : ''} ${longPressActiveLayerId === layer.id ? 'long-press-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveLayer(layer.id);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLayerContextMenu({ layerId: layer.id, x: e.clientX, y: e.clientY });
            }}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse') return;
              const timer = setTimeout(() => {
                setLayerContextMenu({ layerId: layer.id, x: e.clientX, y: e.clientY });
                setLongPressActiveLayerId(null);
              }, 300);
              setLongPressTimer(timer);
              setLongPressActiveLayerId(layer.id);
            }}
            onPointerUp={clearLongPressTimer}
            onPointerCancel={clearLongPressTimer}
            onPointerMove={clearLongPressTimer}
            onPointerLeave={clearLongPressTimer}
          >
            {(layer.type === 'group' || layer.type === 'artboard') && (
              <div className="layer-collapse" onClick={(e) => {
                e.stopPropagation();
                updateLayer(layer.id, { collapsed: !layer.collapsed });
              }}>
                {layer.collapsed ? <LucideIcons.ChevronRight size={12} /> : <LucideIcons.ChevronDown size={12} />}
              </div>
            )}
            <div className="layer-eye" onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}>
              {layer.visible ? <LucideIcons.Eye size={12} /> : <LucideIcons.EyeOff size={12} />}
            </div>
            <div className="layer-thumb">
              {layer.thumbnail ? (
                <img src={layer.thumbnail} alt="" />
              ) : layer.type === 'artboard' ? (
                <LucideIcons.Layout size={16} />
              ) : layer.type === 'group' ? (
                <LucideIcons.Folder size={16} />
              ) : null}
            </div>
            {renamingLayerId === layer.id ? (
              <input
                type="text"
                autoFocus
                className="layer-rename-input"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateLayer(layer.id, { name: newLayerName });
                    setRenamingLayerId(null);
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setRenamingLayerId(null);
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  updateLayer(layer.id, { name: newLayerName });
                  setRenamingLayerId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="layer-title">
                {layer.name}
                {layer.type === 'artboard' && layer.width && layer.height && (
                  <span style={{ opacity: 0.5, fontSize: '10px', marginLeft: '6px' }}>
                    ({layer.width} × {layer.height})
                  </span>
                )}
              </span>
            )}
            <div className="layer-order-btns">
              <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); recordHistory('Move Layer Up'); }} title="Move Up"><LucideIcons.ChevronUp size={12} /></button>
              <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); recordHistory('Move Layer Down'); }} title="Move Down"><LucideIcons.ChevronDown size={12} /></button>
            </div>
          </div>
        </div>
        {(layer.type === 'group' || layer.type === 'artboard') && !layer.collapsed && layer.children && (
          <div className="layer-children">
            {renderLayerTree(layer.children, depth + 1)}
          </div>
        )}
      </div>
    ));
  };

  React.useEffect(() => {
    (window as any).app = new Application();
  }, []);

  const addAlert = useStore(state => state.addAlert);
  const {
    layers,
    activeLayerId,
    setActiveLayer,
    toggleLayerVisibility,
    addLayer,
    removeLayer,
    updateLayer,
    zoom,
    history,
    historyIndex,
    undo,
    redo,
    recordHistory,
    inverseSelection,
    duplicateLayer,
    setZoom,
    setSelectionRect,
    setIsInverseSelection,
    setCropRect,
    setLassoPaths,
    moveLayer,
    documentSize,
    setIsTyping,
    setShowRulers,
    setShowGrid,
    setShowGuides,
    addDocument,
    activeDocumentName,
    setLayers,
    showRulers,
    showGrid,
    showGuides,
    lights,
    removeLight,
    activeLightId,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setDocumentSize,
    setActiveTool,
    setToolVariant
  } = useStore();

  const getMergedImageData = (format: string = 'image/png') => {
    const { w, h } = documentSize;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    layers.forEach(layer => {
      if (!layer.visible) return;
      const el = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
      if (el) {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.globalCompositeOperation = layer.blendMode === 'pass through' ? 'source-over' : (layer.blendMode || 'source-over');
        ctx.drawImage(el, layer.position.x, layer.position.y);
        ctx.restore();
      }
    });

    return exportCanvas.toDataURL(format);
  };

  const handleSave = async (asNew: boolean = false) => {
    // For standard "Save", we default to our high-fidelity editable format (PSD or JSON)
    const suggestedBase = activeDocumentName || 'pixelite_project';
    const fileName = asNew ? `${suggestedBase}_copy.psd` : `${suggestedBase}.psd`;

    // Helper to ensure we have a real canvas for ag-psd
    const getLayerCanvas = async (layer: any): Promise<HTMLCanvasElement | undefined> => {
      const el = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
      if (el) return el;
      if (!layer.dataUrl) return undefined;

      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          canvas.getContext('2d')?.drawImage(img, 0, 0);
          resolve(canvas);
        };
        img.src = layer.dataUrl;
      });
    };

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Photoshop Document',
            accept: { 'application/x-photoshop': ['.psd'] },
          }],
        });

        const writable = await handle.createWritable();

        const metadata = {
          lights: useStore.getState().lights,
          ambientIntensity: useStore.getState().ambientIntensity,
          ambientColor: useStore.getState().ambientColor,
          lightingDepthScale: useStore.getState().lightingDepthScale
        };

        const children = [];
        // Add metadata as a hidden layer for persistence
        children.push({
          name: '__pixelite_metadata__',
          canvas: document.createElement('canvas'), // Dummy canvas
          visible: false,
          annotations: [{ type: 'text', data: JSON.stringify(metadata) }] // Custom metadata storage
        } as any);

        for (const layer of [...layers].reverse()) {
          const canvas = await getLayerCanvas(layer);
          if (canvas) {
            children.push({
              name: layer.name,
              canvas: canvas,
              left: layer.position.x,
              top: layer.position.y,
              opacity: layer.opacity,
              visible: layer.visible,
              blendMode: (layer.blendMode || 'normal') as any
            });
          }
        }

        const buffer = writePsd({
          width: documentSize.w,
          height: documentSize.h,
          children
        });

        await writable.write(buffer);
        await writable.close();
        return;
      } catch (err) {
        if ((err as any).name === 'AbortError') return;
        console.error('Advanced save failed', err);
      }
    }

    // Fallback if API not available
    const metadata = {
      lights: useStore.getState().lights,
      ambientIntensity: useStore.getState().ambientIntensity,
      ambientColor: useStore.getState().ambientColor,
      lightingDepthScale: useStore.getState().lightingDepthScale
    };

    const children = [];
    children.push({
      name: '__pixelite_metadata__',
      canvas: document.createElement('canvas'),
      visible: false,
      annotations: [{ type: 'text', data: JSON.stringify(metadata) }]
    } as any);

    for (const layer of [...layers].reverse()) {
      const canvas = await getLayerCanvas(layer);
      if (canvas) {
        children.push({
          name: layer.name,
          canvas: canvas,
          left: layer.position.x,
          top: layer.position.y,
          opacity: layer.opacity,
          visible: layer.visible,
          blendMode: (layer.blendMode || 'normal') as any
        });
      }
    }

    const buffer = writePsd({
      width: documentSize.w,
      height: documentSize.h,
      children
    });

    const blob = new Blob([buffer], { type: 'application/x-photoshop' });
    const link = document.createElement('a');
    link.download = fileName;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingText, setProcessingText] = React.useState('');

  // Mobile UI state

  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [isPanelsOpen, setIsPanelsOpen] = React.useState(false);
  const [isFillPickerOpen, setIsFillPickerOpen] = React.useState(false);


  const [fillColor, setFillColor] = React.useState('#ffffff');
  const [fillOpacity, setFillOpacity] = React.useState(1);
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [isEditingOpacity, setIsEditingOpacity] = React.useState(false);
  const [tempOpacityValue, setTempOpacityValue] = React.useState('');

  const [saveModal, setSaveModal] = React.useState<{ type: 'cloud' | 'public' | null; provider?: string }>({ type: null });
  const [isLightingProcessing, setIsLightingProcessing] = React.useState(false);

  const handleFade = () => { alert("Fade action triggered (Placeholder)"); };
  const handleCopyMerged = () => { alert("Copy Merged action triggered (Placeholder)"); };
  const handleFreeTransform = () => { alert("Free Transform action triggered (Placeholder)"); };
  const handlePreferences = () => { alert("Preferences action triggered (Placeholder)"); };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input or textarea or custom text editor
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || useStore.getState().isTyping) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // File operations
      // New Document
      if (isCtrl && e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        useStore.getState().setIsNewDocumentDialogOpen(true);
      }
      if (isCtrl && e.key === 'o') {
        e.preventDefault();
        document.getElementById('global-file-input')?.click();
      }
      if (isCtrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        console.log('Save handled via menu');
      }

      // Undo/Redo
      if (isCtrl && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((isCtrl && e.key === 'y') || (isCtrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
      }

      // Edit operations
      if (isCtrl && e.shiftKey && e.key === 'f') {
        e.preventDefault();
        setIsFillPickerOpen(true);
      }
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFade();
      }
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopyMerged();
      }
      if (isCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleFreeTransform();
      }
      if (isCtrl && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handlePreferences();
      }

      // Layer operations
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        addLayer({ name: `Layer ${useStore.getState().layers.length + 1}` });
      }
      if (isCtrl && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        if (useStore.getState().activeLayerId) {
          duplicateLayer(useStore.getState().activeLayerId!);
        }
      }

      // Selection operations
      if (isCtrl && e.key === 'a') {
        e.preventDefault();
        setSelectionRect({ x: 0, y: 0, w: useStore.getState().documentSize.w, h: useStore.getState().documentSize.h });
      }
      if (isCtrl && e.key === 'd') {
        e.preventDefault();
        setSelectionRect(null);
        setLassoPaths([]);
        setCropRect(null);
      }
      if (isCtrl && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setIsInverseSelection(!useStore.getState().isInverseSelection);
      }

      // Tools (single key press)
      const keyMap: Record<string, [string, string]> = {
        'v': ['move', 'move'],
        'm': ['marquee', 'rectangle_marquee'],
        'l': ['lasso', 'lasso'],
        'w': ['selection', 'quick_selection'],
        'c': ['crop', 'crop'],
        'i': ['eyedropper', 'eyedropper'],
        'j': ['healing', 'healing'],
        'b': ['brush', 'brush'],
        's': ['clone', 'clone'],
        'y': ['history', 'history_brush'],
        'e': ['eraser', 'eraser'],
        'g': ['gradient', 'gradient'],
        'o': ['dodge', 'dodge'],
        'p': ['pen', 'pen'],
        't': ['text', 'text'],
        'a': ['path', 'path_select'],
        'u': ['shape', 'shape'],
        'h': ['hand', 'hand'],
        'z': ['zoom', 'zoom_tool'],
      };

      if (!isCtrl && !e.altKey && !e.shiftKey && keyMap[e.key.toLowerCase()]) {
        e.preventDefault();
        const [groupId, defaultVariantId] = keyMap[e.key.toLowerCase()];
        setActiveTool(defaultVariantId);
        setToolVariant(groupId, defaultVariantId);
        toolState.currentTool = defaultVariantId;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeLayerId, layers]);

  React.useEffect(() => {
    const handleStart = () => setIsLightingProcessing(true);
    const handleEnd = () => setIsLightingProcessing(false);
    window.addEventListener('lighting-start', handleStart);
    window.addEventListener('lighting-end', handleEnd);
    return () => {
      window.removeEventListener('lighting-start', handleStart);
      window.removeEventListener('lighting-end', handleEnd);
    };
  }, []);


  const handleFile = (file: File | Blob, name?: string, skipResize: boolean = false) => {
    const isOpening = !skipResize;

    // 1. Handle Native Project File (.psd)
    if ((file as File).name?.toLowerCase().endsWith('.psd')) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const result = e.target?.result;
        if (!result) return;

        try {
          // Try loading as a real PSD first
          const psd = readPsd(result as ArrayBuffer);
          if (psd && psd.children) {
            // Extract lighting metadata if it exists
            const metadataLayer = psd.children.find((c: any) => c.name === '__pixelite_metadata__');
            let lightingMetadata: any = {};

            if (metadataLayer) {
              const meta = metadataLayer as any;
              if (meta.annotations && meta.annotations[0]) {
                try {
                  lightingMetadata = JSON.parse(meta.annotations[0].data);
                  console.log('[Lighting] Restored metadata from PSD:', lightingMetadata);
                } catch (e) {
                  console.warn('[Lighting] Failed to parse PSD metadata', e);
                }
              }
            }

            const loadedLayers = psd.children
              .filter((child: any) => child.name !== '__pixelite_metadata__')
              .map((child: any) => ({
                id: nanoid(),
                name: child.name || 'Layer',
                visible: child.visible !== false,
                opacity: child.opacity !== undefined ? child.opacity : 1,
                blendMode: child.blendMode || 'normal',
                locked: false,
                type: 'image' as const,
                position: { x: child.left || 0, y: child.top || 0 },
                dataUrl: child.canvas ? child.canvas.toDataURL() : null
              })).reverse();

            const projectState = {
              layers: loadedLayers,
              documentSize: { w: psd.width, h: psd.height },
              ...lightingMetadata, // Restore lights, ambient settings, etc.
              isLightingEnabled: !!lightingMetadata?.lights?.length
            };

            if (isOpening) {
              addDocument((file as File).name, { w: psd.width, h: psd.height }, {
                ...projectState,
                zoom: 1,
                canvasOffset: { x: 0, y: 0 },
                history: [{ name: 'Open PSD', state: projectState }],
                historyIndex: 0
              });
            } else {
              setDocumentSize({ w: psd.width, h: psd.height });
              setLayers(loadedLayers);
              if (lightingMetadata.lights) {
                useStore.getState().updateLighting(lightingMetadata);
              }
              recordHistory(`Import PSD: ${(file as File).name}`);
            }
            return;
          }
        } catch (err) {
          // If real PSD parsing fails, check if it's our custom JSON
          try {
            const text = new TextDecoder().decode(result as ArrayBuffer);
            const project = JSON.parse(text);
            if (project && project.layers && project.documentSize) {
              if (isOpening) {
                addDocument((file as File).name, project.documentSize, project);
              } else {
                setDocumentSize(project.documentSize);
                setLayers(project.layers);
                if (project.activeLayerId) setActiveLayer(project.activeLayerId);
                recordHistory(`Open Project: ${project.name || 'Untitled'}`);
              }
              return;
            }
          } catch (jsonErr) {
            loadAsImage(file, name, skipResize);
          }
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    loadAsImage(file, name, skipResize);
  };

  const loadAsImage = (file: File | Blob, name?: string, skipResize: boolean = false) => {
    if (!file.type.startsWith('image/') && !(file as File).name?.toLowerCase().endsWith('.psd')) return;
    const isOpening = !skipResize;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        if (isOpening) {
          const newLayers = [{
            id: nanoid(),
            name: name || (file as File).name || 'Pasted Image',
            type: 'image' as const,
            dataUrl,
            visible: true,
            opacity: 1,
            position: { x: 0, y: 0 },
            locked: false
          }];

          // Calculate initial zoom to fit
          const viewportW = window.innerWidth - 240 - 44 - 60; // 60px padding
          const viewportH = window.innerHeight - 38 - 32 - 24 - 40; // 40px padding
          const zoomW = viewportW / img.width;
          const zoomH = viewportH / img.height;
          const initialZoom = Math.min(1, Math.min(zoomW, zoomH));

          addDocument((file as File).name, { w: img.width, h: img.height }, {
            layers: newLayers,
            documentSize: { w: img.width, h: img.height },
            zoom: initialZoom,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open Image', state: { layers: newLayers, documentSize: { w: img.width, h: img.height } } }],
            historyIndex: 0
          });
        } else {
          const isDefaultBackground = layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
          if (layers.length === 0 || isDefaultBackground) {
            setDocumentSize({ w: img.width, h: img.height });
          }
          addLayer({
            name: name || (file as File).name || 'Pasted Image',
            type: 'image',
            dataUrl,
            position: (layers.length === 0 || isDefaultBackground || skipResize) ? { x: 0, y: 0 } : { x: (documentSize.w - img.width) / 2, y: (documentSize.h - img.height) / 2 }
          });
          recordHistory(`Import ${name || 'Image'}`);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handlePlaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file, undefined, true); // true = skipResize
  };

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) handleFile(blob, 'Pasted Image');
        }
      }
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
          handleFile(files[i]);
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('paste', handlePaste);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('dragover', handleDragOver);
    return () => {
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('dragover', handleDragOver);
    };
  }, [layers, documentSize, addLayer, recordHistory, setDocumentSize]);

  const handleInvert = () => {
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;

    const { selectionRect, lassoPaths, isInverseSelection } = useStore.getState();

    // Store the original state
    ctx.save();

    // Create a temporary canvas for the inverted result
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Apply clipping if selection exists
    if (selectionRect) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) {
        ctx.rect(0, 0, canvas.width, canvas.height);
      }
      ctx.rect(selectionRect.x - offX, selectionRect.y - offY, selectionRect.w, selectionRect.h);
      ctx.clip(isInverseSelection ? 'evenodd' : 'nonzero');
    } else if (lassoPaths.length > 0) {
      const layer = layers.find(l => l.id === activeLayerId);
      const offX = layer?.position.x || 0;
      const offY = layer?.position.y || 0;
      ctx.beginPath();
      if (isInverseSelection) {
        ctx.rect(0, 0, canvas.width, canvas.height);
      }
      lassoPaths.forEach(path => {
        if (path.length < 3) return;
        ctx.moveTo(path[0].x - offX, path[0].y - offY);
        path.forEach(p => ctx.lineTo(p.x - offX, p.y - offY));
        ctx.closePath();
      });
      ctx.clip('evenodd');
    }

    // Get image data, invert it, and put it back
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }

    // We need to only apply the inverted data to the clipped area
    // A simple way is to use putImageData on the whole thing while clipped
    // But putImageData ignores clipping! 
    // So we put it on the temp canvas and then draw that back to the original with the clip active.
    tempCtx.putImageData(imageData, 0, 0);

    // Clear the clipped area first (optional but safer for some blend modes)
    // Then draw the inverted version from the temp canvas
    ctx.drawImage(tempCanvas, 0, 0);

    ctx.restore();
    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory('Invert Colors');
  };

  const handleSelectSubject = () => {
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    // Fast scan
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 20) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (found) {
      // Add a small 2px padding
      setSelectionRect({
        x: Math.max(0, minX - 2),
        y: Math.max(0, minY - 2),
        w: Math.min(canvas.width - minX, maxX - minX + 4),
        h: Math.min(canvas.height - minY, maxY - minY + 4)
      });
      setIsInverseSelection(false);
      setLassoPaths([]); // Clear lasso paths if using rect
      recordHistory('Select Subject');
    } else {
      addAlert({ type: 'warning', message: 'No subject found on this layer.' });
    }
  };

  React.useEffect(() => {
    const onInvert = () => handleInvert();
    const onSelectSubject = () => handleSelectSubject();
    const onCropFitDoc = () => {
      setCropRect({ x: 0, y: 0, w: documentSize.w, h: documentSize.h });
    };
    const onCropFitLayer = () => {
      if (!activeLayerId) return;
      const layer = layers.find(l => l.id === activeLayerId);
      if (layer) {
        setCropRect({ x: layer.position.x, y: layer.position.y, w: documentSize.w, h: documentSize.h });
      }
    };

    window.addEventListener('invert-layer', onInvert);
    window.addEventListener('select-subject', onSelectSubject);
    window.addEventListener('crop-fit-doc', onCropFitDoc);
    window.addEventListener('crop-fit-layer', onCropFitLayer);
    return () => {
      window.removeEventListener('invert-layer', onInvert);
      window.removeEventListener('select-subject', onSelectSubject);
      window.removeEventListener('crop-fit-doc', onCropFitDoc);
      window.removeEventListener('crop-fit-layer', onCropFitLayer);
    };
  }, [activeLayerId, layers, updateLayer, recordHistory, documentSize]);

  const handleRemoveBackground = async () => {
    if (!activeLayerId) return;
    const layer = layers.find(l => l.id === activeLayerId);
    if (!layer || !layer.dataUrl) {
      addAlert({ type: 'warning', message: 'Please select an image layer first.' });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingText('Removing background...');
      const inputResponse = await fetch(layer.dataUrl);
      const inputBlob = await inputResponse.blob();

      let outputBlob: Blob;
      try {
        outputBlob = await removeBackground(inputBlob, {
          publicPath: '/models/',
          output: { format: 'image/png', quality: 0.92 },
          device: 'gpu'
        });
      } catch (localError) {
        console.warn('Failed to load local background removal models, falling back to remote source:', localError);
        outputBlob = await removeBackground(inputBlob, {
          output: { format: 'image/png', quality: 0.92 },
          device: 'gpu'
        });
      }

      // Helper to convert blob to data URL
      const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to convert blob to data URL.'));
        };
        reader.onerror = () => reject(reader.error || new Error('Failed to read blob.'));
        reader.readAsDataURL(blob);
      });

      const outputDataUrl = await blobToDataUrl(outputBlob);
      updateLayer(activeLayerId, { dataUrl: outputDataUrl, type: 'image' });
      recordHistory('Remove Background');
    } catch (error) {
      console.error('Background removal failed:', error);
      addAlert({ type: 'error', message: 'Background removal failed. Please try again.' });
    } finally {
      setIsProcessing(false);
      setProcessingText('');
    }
  };

  // ... (inside App component)

  const handleNewDocument = () => {
    addDocument();
  };

  const handleExport = async (format: string) => {
    if (format === 'psd') {
      try {
        const psdData = {
          width: documentSize.w,
          height: documentSize.h,
          children: layers.map(layer => {
            const canvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
            return {
              name: layer.name,
              canvas: canvas,
              left: layer.position.x,
              top: layer.position.y,
              opacity: layer.opacity,
              visible: layer.visible,
              blendMode: (layer.blendMode || 'normal') as any
            };
          }).reverse() // ag-psd expects bottom-up? Actually usually it's top-down in children. 
          // Photoshop layers are bottom-to-top in children array index (0 is bottom).
        };

        const buffer = writePsd(psdData);
        const blob = new Blob([buffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${activeDocumentName || 'project'}.psd`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Error saving real PSD:', err);
        // Fallback to our custom editable JSON if ag-psd fails for some reason
        const projectData = {
          name: activeDocumentName,
          documentSize,
          layers: layers.map(layer => {
            const canvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
            return {
              ...layer,
              dataUrl: canvas ? canvas.toDataURL() : layer.dataUrl
            };
          }),
          activeLayerId,
          historyIndex,
          zoom,
          showRulers,
          showGrid,
          showGuides
        };

        const blob = new Blob([JSON.stringify(projectData)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${activeDocumentName || 'project'}_editable.psd`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
      return;
    }

    const { w, h } = documentSize;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Helper to load image from data URL
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = url;
      });
    };

    // Draw layers from bottom to top
    const layerList = [...layers].reverse();
    for (const layer of layerList) {
      if (!layer.visible) continue;

      const isLit = useStore.getState().isLightingEnabled && layer.id === useStore.getState().activeLayerId;
      const lastResultUrl = useStore.getState().lastResultUrl;

      ctx.globalAlpha = layer.opacity || 1;
      ctx.globalCompositeOperation = (layer.blendMode || 'source-over') as any;

      if (isLit && lastResultUrl) {
        const litImg = await loadImage(lastResultUrl);
        ctx.drawImage(litImg, layer.position.x, layer.position.y);
      } else {
        const layerCanvas = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
        if (layerCanvas) {
          ctx.drawImage(layerCanvas, layer.position.x, layer.position.y);
        }
      }
    }

    let mimeType = 'image/png';
    let extension = format.toLowerCase();
    switch (format.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        mimeType = 'image/jpeg';
        extension = 'jpg';
        break;
      case 'webp': mimeType = 'image/webp'; break;
      case 'bmp': mimeType = 'image/bmp'; break;
      case 'gif': mimeType = 'image/gif'; break;
      default:
        mimeType = 'image/png';
        extension = 'png';
    }

    const baseName = activeDocumentName ? activeDocumentName.replace(/\.[^/.]+$/, "") : 'pixelite_export';
    const fileName = `${baseName}.${extension}`;

    // Try to use the modern File System Access API to force a "Save As" dialog
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: `${extension.toUpperCase()} Image`,
            accept: { [mimeType]: [`.${extension}`] },
          }],
        });

        const writable = await handle.createWritable();
        const blob = await (await fetch(exportCanvas.toDataURL(mimeType, 0.9))).blob();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (err) {
        // User cancelled or error, fallback to standard download
        if ((err as any).name === 'AbortError') return;
        console.warn('File System Access API failed, falling back to standard download', err);
      }
    }

    // Fallback: Standard <a> link download
    const link = document.createElement('a');
    link.download = fileName;
    link.href = exportCanvas.toDataURL(mimeType, 0.9);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenURL = () => {
    const url = prompt('Enter image URL:');
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        addLayer({
          name: 'Image from URL',
          type: 'image',
          dataUrl: canvas.toDataURL()
        });
        recordHistory('Open from URL');
      }
    };
    img.onerror = () => alert('Could not load image from URL.');
    img.src = url;
  };

  const handleTakeSnapshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        addLayer({
          name: 'Camera Snapshot',
          type: 'image',
          dataUrl: canvas.toDataURL()
        });
        recordHistory('Camera Snapshot');
      }

      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      alert('Could not access camera.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleScript = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.js';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re: any) => {
          try {
            // WARNING: eval is used here for demonstration of script execution
            // In a production app, this should be sandboxed.
            const scriptContent = re.target.result;
            const scriptFunc = new Function('useStore', 'addLayer', 'recordHistory', scriptContent);
            scriptFunc(useStore, addLayer, recordHistory);
          } catch (err) {
            alert('Error executing script: ' + err);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const [clipboard, setClipboard] = React.useState<any>(null);

  const handleCopy = () => {
    if (!activeLayerId) return;
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      setClipboard({ ...layer, id: undefined, name: `${layer.name} Copy` });
    }
  };

  const handleCut = () => {
    if (!activeLayerId) return;
    handleCopy();
    removeLayer(activeLayerId);
    recordHistory('Cut Layer');
  };

  const handlePaste = () => {
    if (clipboard) {
      addLayer({ ...clipboard, position: { x: (clipboard.position?.x || 0) + 20, y: (clipboard.position?.y || 0) + 20 } });
      recordHistory('Paste Layer');
    }
  };

  const handleTransformLayer = (type: string) => {
    if (!activeLayerId) return;
    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCtx.save();
    if (type === 'flipH') {
      tempCtx.translate(canvas.width, 0);
      tempCtx.scale(-1, 1);
    } else if (type === 'flipV') {
      tempCtx.translate(0, canvas.height);
      tempCtx.scale(1, -1);
    } else if (type === 'rotate180') {
      tempCtx.translate(canvas.width, canvas.height);
      tempCtx.rotate(Math.PI);
    } else if (type === 'rotate90CW') {
      // Note: This doesn't resize the canvas, just rotates content within current bounds
      tempCtx.translate(canvas.width, 0);
      tempCtx.rotate(Math.PI / 2);
    } else if (type === 'rotate90CCW') {
      tempCtx.translate(0, canvas.height);
      tempCtx.rotate(-Math.PI / 2);
    }
    tempCtx.drawImage(canvas, 0, 0);
    tempCtx.restore();

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tempCanvas, 0, 0);
    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
    recordHistory(`Transform Layer: ${type}`);
  };

  const handleSelectAll = () => {
    setSelectionRect({ x: 0, y: 0, w: documentSize.w, h: documentSize.h });
    recordHistory('Select All');
  };

  const handleDeselect = () => {
    setSelectionRect(null);
    setLassoPaths([]);
    recordHistory('Deselect');
  };

  return (
    <div className={`app-layout ${isMobileMenuOpen || isToolsOpen || isPanelsOpen ? 'mobile-panel-active' : ''}`}>
      <input type="file" id="global-file-input" accept="image/*,.psd" hidden onChange={handleImageUpload} />
      <input type="file" id="place-file-input" accept="image/*,.psd" hidden onChange={handlePlaceUpload} />

      {(isMobileMenuOpen || isToolsOpen || isPanelsOpen) && (
        <div
          className="mobile-backdrop"
          onClick={() => {
            setIsMobileMenuOpen(false);
            setIsToolsOpen(false);
            setIsPanelsOpen(false);

          }}
        />
      )}

      <header className="app-header">
        <div className="header-left">
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <LucideIcons.Menu size={20} />
          </button>
          <div className="app-logo">
            <img src="./icon1.png" width={24} height={24} alt="icon" />
            <span>Pixelite</span>
          </div>
        </div>

        <MenuBar
          onFileOpen={() => document.getElementById('global-file-input')?.click()}
          onPlaceFile={() => document.getElementById('place-file-input')?.click()}
          onSave={handleSave}
          undo={undo}
          redo={redo}
          historyIndex={historyIndex}
          historyLength={history.length}
          canUndo={historyIndex > 0}
          canRedo={historyIndex < history.length - 1}
          onInvert={handleInvert}
          onDuplicateLayer={() => activeLayerId && duplicateLayer(activeLayerId)}
          onDeleteLayer={() => activeLayerId && removeLayer(activeLayerId)}
          onFillLayer={() => setIsFillPickerOpen(true)}
          onSelectSubject={handleSelectSubject}
          onRemoveBackground={handleRemoveBackground}
          onInverseSelection={() => {
            inverseSelection();
            recordHistory('Inverse Selection');
          }}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onNewDocument={handleNewDocument}
          onExport={handleExport}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onTransformLayer={handleTransformLayer}
          onCanvasSize={() => {
            const w = prompt('New Canvas Width:', documentSize.w.toString());
            const h = prompt('New Canvas Height:', documentSize.h.toString());
            if (w && h) setDocumentSize({ w: parseInt(w), h: parseInt(h) });
          }}
          onImageSize={() => {
            const w = prompt('New Image Width:', documentSize.w.toString());
            const h = prompt('New Image Height:', documentSize.h.toString());
            if (w && h) setDocumentSize({ w: parseInt(w), h: parseInt(h) });
          }}
          onAddEmptyLayer={() => addLayer({ name: `Layer ${layers.length + 1}` })}
          onSelectAll={handleSelectAll}
          onDeselect={handleDeselect}
          onZoomIn={() => setZoom(Math.min(32, zoom + 0.1))}
          onZoomOut={() => setZoom(Math.max(0.01, zoom - 0.1))}
          onZoomFit={() => {
            const viewportW = window.innerWidth - 240 - 44 - 60;
            const viewportH = window.innerHeight - 38 - 32 - 24 - 40;
            const zoomW = viewportW / documentSize.w;
            const zoomH = viewportH / documentSize.h;
            setZoom(Math.min(zoomW, zoomH));
          }}
          onToggleRulers={() => setShowRulers(!useStore.getState().showRulers)}
          onToggleGrid={() => setShowGrid(!useStore.getState().showGrid)}
          onToggleGuides={() => setShowGuides(!useStore.getState().showGuides)}
          onOpenURL={handleOpenURL}
          onTakeSnapshot={handleTakeSnapshot}
          onPrint={handlePrint}
          onScript={handleScript}
          onSaveToStorage={(provider) => setSaveModal({ type: 'cloud', provider })}
          onSaveToPublic={(service) => setSaveModal({ type: 'public', provider: service })}
        />



        <div className="header-right">
          {/* Mobile toggle buttons */}
          <button
            className={`mobile-panel-toggle ${isToolsOpen ? 'active' : ''}`}
            onClick={() => { setIsToolsOpen(!isToolsOpen); setIsPanelsOpen(false); }}
          >
            <LucideIcons.Wrench size={18} />
          </button>
          <button
            className={`mobile-panel-toggle ${isPanelsOpen ? 'active' : ''}`}
            onClick={() => { setIsPanelsOpen(!isPanelsOpen); setIsToolsOpen(false); }}
          >
            <LucideIcons.PanelRight size={18} />
          </button>
        </div>
      </header>

      <OptionsBar />
      <TabBar />
      <div className="app-body">
        <div className={`toolbar-wrapper ${isToolsOpen ? 'mobile-open' : ''}`}>
          {isToolsOpen && (
            <div className="mobile-panel-header">
              <span>Tools</span>
              <button onClick={() => setIsToolsOpen(false)}><LucideIcons.ChevronDown size={20} /></button>
            </div>
          )}
          <Toolbar onAction={() => setIsToolsOpen(false)} />
        </div>

        <main className="workspace">
          <div className="canvas-viewport" style={{ position: "relative" }}>
            <GlobalRulers />
            <Canvas />
          </div>

          {isProcessing && (
            <div className="processing-overlay">
              <div className="processing-spinner" />
              <div className="processing-message">{processingText}</div>
            </div>
          )}

          <footer className="status-bar">
            <div className="status-item">Zoom: {(zoom * 100).toFixed(0)}%</div>
            <div className="status-item">GPU: {(navigator as any).gpu ? 'Active' : 'N/A'}</div>
            <div className="status-item">Doc: {documentSize.w} x {documentSize.h}px</div>
            {isLightingProcessing && (
              <div className="status-item status-lighting">
                <LucideIcons.Sun size={12} className="animate-spin" style={{ marginRight: '6px' }} />
                Lighting...
              </div>
            )}
            <div className={`status-item ${isProcessing ? 'status-processing' : 'status-ready'}`}>
              {isProcessing && <LucideIcons.Loader2 size={12} className="animate-spin" style={{ marginRight: '6px' }} />}
              {isProcessing ? processingText : 'Ready'}
            </div>
          </footer>
        </main>

        <aside className={`side-panels ${isPanelsOpen ? 'mobile-open' : ''}`}>
          {isPanelsOpen && (
            <div className="mobile-panel-header">
              <span>History & Layers</span>
              <button onClick={() => setIsPanelsOpen(false)}><LucideIcons.ChevronDown size={20} /></button>
            </div>
          )}
          <div className="side-panel history-panel">
            <div className="panel-tab">History</div>
            <div className="panel-content">
              {history.map((entry, idx) => (
                <div key={idx} className={`history-item ${idx === historyIndex ? 'active' : ''} ${idx > historyIndex ? 'undone' : ''}`}>
                  {entry.name}
                </div>
              ))}
            </div>
          </div>

          <div className="side-panel layers-panel">
            <div className="panel-tab">Layers</div>

            {/* Global Layer Properties - Only visible if a layer is active */}
            {activeLayerId && (() => {
              const activeLayer = findLayerById(layers, activeLayerId);
              if (!activeLayer) return null;
              return (
                <div className="layer-global-properties">
                  <select
                    className="blend-select"
                    value={activeLayer.blendMode || 'source-over'}
                    onChange={(e) => updateLayer(activeLayerId, { blendMode: e.target.value as any })}
                  >
                    <option value="source-over">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                    <option value="overlay">Overlay</option>
                  </select>
                  <div className="opacity-control">
                    <span>Op:</span>
                    <input
                      type="range"
                      min="0" max="1" step="0.01"
                      value={activeLayer.opacity || 1}
                      onChange={(e) => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
                    />
                    {isEditingOpacity ? (
                      <input
                        type="text"
                        className="opacity-input"
                        autoFocus
                        value={tempOpacityValue}
                        onChange={(e) => setTempOpacityValue(e.target.value)}
                        onFocus={(e) => {
                          e.target.select();
                          setIsTyping(true);
                        }}
                        onBlur={() => {
                          setIsEditingOpacity(false);
                          setIsTyping(false);
                          const val = parseInt(tempOpacityValue);
                          if (!isNaN(val)) {
                            updateLayer(activeLayerId, { opacity: Math.max(0, Math.min(1, val / 100)) });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                          if (e.key === 'Escape') {
                            setIsEditingOpacity(false);
                            setIsTyping(false);
                          }
                        }}
                      />
                    ) : (
                      <span
                        className="opacity-val"
                        onDoubleClick={() => {
                          setTempOpacityValue(Math.round((activeLayer.opacity || 1) * 100).toString());
                          setIsEditingOpacity(true);
                        }}
                        title="Double-click to type exact value"
                      >
                        {Math.round((activeLayer.opacity || 1) * 100)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="panel-content" onDrop={(e) => {
              e.preventDefault();
              if (draggedIndex && layers.length > 0) {
                // Drop on empty space in panel -> move to root bottom
                useStore.getState().reorderNodesAction?.(draggedIndex, layers[layers.length - 1].id, 'after');
                recordHistory('Reorder Layers');
              }
              setDraggedIndex(null);
            }} onDragOver={(e) => e.preventDefault()}>
              {renderLayerTree(layers)}
            </div>
            <div className="panel-footer">
              <button onClick={() => addLayer({ name: `Layer ${layers.length + 1}` })}><LucideIcons.Plus size={14} /></button>
              <button onClick={() => activeLayerId && removeLayer(activeLayerId)} disabled={layers.length <= 1}><LucideIcons.Trash2 size={14} /></button>
            </div>
          </div>

          <div className="side-panel lights-panel">
            <div className="panel-tab">Lights</div>
            <div className="panel-content">
              {lights.length === 0 ? (
                <div className="no-items">No lights added</div>
              ) : (
                lights.map((light, i) => (
                  <div key={light.id} className={`layer-row light-row ${activeLightId === light.id ? 'active' : ''}`} onClick={() => useStore.getState().setActiveLightId(light.id)}>
                    <LucideIcons.Sun size={12} style={{ marginRight: '8px', color: light.color, filter: `drop-shadow(0 0 2px ${light.color})` }} />
                    <span className="light-name" style={{ flex: 1 }}>{light.name || `Light ${i + 1}`}</span>
                    <button
                      className="layer-action-btn"
                      title="Delete Light"
                      onClick={() => {
                        removeLight(light.id);
                        recordHistory('Remove Light');
                      }}
                    >
                      <LucideIcons.Trash2 size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
      {/* Fill Color Picker Modal */}
      {isFillPickerOpen && (
        <div className="modal-overlay" onClick={() => setIsFillPickerOpen(false)}>
          <div className="modal-content color-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Fill Layer</h3>
              <button className="modal-close-btn" onClick={() => setIsFillPickerOpen(false)}>
                <LucideIcons.X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <ColorPicker
                label="Fill Color"
                color={fillColor}
                opacity={fillOpacity}
                onColorChange={setFillColor}
                onOpacityChange={setFillOpacity}
              />
            </div>
            <div className="modal-actions">
              <button className="premium-btn-sm secondary" onClick={() => setIsFillPickerOpen(false)}>Cancel</button>
              <button className="premium-btn-sm" onClick={() => {
                if (!activeLayerId) return;
                const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
                const ctx = canvas?.getContext('2d');
                if (ctx) {
                  const { lassoPaths, selectionRect } = useStore.getState();
                  ctx.save();
                  ctx.fillStyle = hexToRgba(fillColor, fillOpacity);

                  if (lassoPaths.length > 0) {
                    ctx.beginPath();
                    lassoPaths.forEach(path => {
                      if (path.length < 3) return;
                      ctx.moveTo(path[0].x, path[0].y);
                      path.forEach(p => ctx.lineTo(p.x, p.y));
                      ctx.closePath();
                    });
                    ctx.clip('evenodd');
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                  } else if (selectionRect) {
                    ctx.fillRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
                  } else {
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                  }

                  ctx.restore();
                  updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
                  recordHistory('Fill Layer');
                  setIsFillPickerOpen(false);
                }
              }}>Fill Layer</button>
            </div>
          </div>
        </div>
      )}
      {layers.length === 0 && (
        <WelcomeOverlay onOpenImage={() => document.getElementById('global-file-input')?.click()} />
      )}

      {saveModal.type === 'cloud' && (
        <CloudStorageModal
          isOpen={true}
          onClose={() => setSaveModal({ type: null })}
          provider={saveModal.provider}
          onSave={async (provider, filename) => {
            const dataUrl = getMergedImageData();
            if (!dataUrl) return;

            try {
              if (provider === 'google_drive') {
                // In a real app, you'd handle OAuth here. 
                // For now, we'll prompt for a token if not found, or use a mock flow if preferred.
                const token = localStorage.getItem('google_drive_token') || prompt('Please enter your Google Drive Access Token (for testing):');
                if (token) {
                  localStorage.setItem('google_drive_token', token);
                  await saveToGoogleDrive(dataUrl, filename, token);
                  alert('Saved to Google Drive!');
                }
              } else {
                // Mock other providers for now as they require different OAuth flows
                await new Promise(resolve => setTimeout(resolve, 2000));
                console.log(`Mock saved ${filename} to ${provider}`);
              }
            } catch (err: any) {
              alert(`Failed to save: ${err.message}`);
              throw err;
            }
          }}
          defaultFilename={`${activeDocumentName || 'pixelite_project'}.png`}
        />
      )}

      {saveModal.type === 'public' && (
        <PublicShareModal
          isOpen={true}
          onClose={() => setSaveModal({ type: null })}
          service={saveModal.provider}
          onUpload={async (service) => {
            const dataUrl = getMergedImageData();
            if (!dataUrl) throw new Error('No image data');

            if (service === 'imgur') {
              return await uploadToImgur(dataUrl);
            } else if (service === 'imagebb') {
              return await uploadToImageBB(dataUrl);
            } else {
              // Fallback for others
              await new Promise(resolve => setTimeout(resolve, 2000));
              return `https://${service}.com/share/a7b2c9d${Math.floor(Math.random() * 10000)}`;
            }
          }}
        />
      )}

      {layerContextMenu && (
        <LayerContextMenu
          position={{ x: layerContextMenu.x, y: layerContextMenu.y }}
          layerId={layerContextMenu.layerId}
          onClose={() => setLayerContextMenu(null)}
          onRename={(id) => {
            const layer = useStore.getState().layers.find(l => l.id === id);
            if (layer) {
              setNewLayerName(layer.name);
              setRenamingLayerId(id);
            }
            setLayerContextMenu(null);
          }}
          onDelete={(id) => {
            useStore.getState().removeLayer(id);
            useStore.getState().recordHistory('Delete Layer');
            setLayerContextMenu(null);
          }}
        />
      )}

      <OpenFromCloudDialog />
      <NewDocumentDialog />
      <ExportAsDialog />
      <FileInfoDialog />
      <CameraDialog />
      <MobileCameraDialog />
      <AlertContainer />
    </div>
  );
};

export default App;

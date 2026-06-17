import { findLayerById, isLayerOrDescendantsLocked } from './utils/layerUtils';
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
import { ImportEngine } from './services/import/ImportEngine';

import MenuBar from './components/MenuBar/MenuBar';
import { removeBackground } from '@imgly/background-removal';
import TabBar from './components/TabBar/TabBar';
import { writePsd } from 'ag-psd';
import { workerExportBridge } from './services/export/WorkerExportBridge';
import { nanoid } from 'nanoid';
import { CloudStorageModal } from './components/Modals/CloudStorageModal';
import { PublicShareModal } from './components/Modals/PublicShareModal';
import { uploadToImgur, uploadToImageBB, saveToGoogleDrive } from './utils/cloudServices';
import { OpenFromCloudDialog } from './components/Dialogs/OpenFromCloudDialog';
import { NewDocumentDialog } from './components/Dialogs/NewDocumentDialog';
import { ExportAsDialog } from './components/Dialogs/ExportAsDialog';
import { FileInfoDialog } from './components/Dialogs/FileInfoDialog';
import { SignatureDialog } from './components/Dialogs/SignatureDialog';
import { CameraDialog } from "./components/Dialogs/CameraDialog";
import { MobileCameraDialog } from "./components/Dialogs/MobileCameraDialog";
import { AdjustmentDialog } from './components/Dialogs/AdjustmentDialog';
import { AlertContainer } from './components/UI/AlertContainer';
import './App.css';
import LayerContextMenu from './components/MenuSystem/LayerContextMenu';


const CheckerboardIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <rect width="6" height="6" fill="currentColor" opacity="0.4" />
    <rect x="6" y="6" width="6" height="6" fill="currentColor" opacity="0.4" />
    <rect x="6" width="6" height="6" fill="currentColor" opacity="0.8" />
    <rect y="6" width="6" height="6" fill="currentColor" opacity="0.8" />
  </svg>
);


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

            const rect = e.currentTarget.getBoundingClientRect();
            const relativeY = e.clientY - rect.top;

            // Clear existing indicator classes
            e.currentTarget.classList.remove('drag-before', 'drag-after', 'drag-inside');

            if (layer.type === 'group' || layer.type === 'artboard') {
              const state = useStore.getState();
              const draggedNode = findLayerById(state.layers, draggedIndex || '');
              if (draggedNode?.type === 'artboard') {
                // Artboards cannot go inside other groups/artboards, only before/after
                if (relativeY < rect.height / 2) {
                  e.currentTarget.classList.add('drag-before');
                } else {
                  e.currentTarget.classList.add('drag-after');
                }
              } else {
                if (relativeY < rect.height * 0.25) {
                  e.currentTarget.classList.add('drag-before');
                } else if (relativeY > rect.height * 0.75) {
                  e.currentTarget.classList.add('drag-after');
                } else {
                  e.currentTarget.classList.add('drag-inside');
                }
              }
            } else {
              if (relativeY < rect.height / 2) {
                e.currentTarget.classList.add('drag-before');
              } else {
                e.currentTarget.classList.add('drag-after');
              }
            }
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('drag-before', 'drag-after', 'drag-inside');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.classList.remove('drag-before', 'drag-after', 'drag-inside');

            if (draggedIndex && draggedIndex !== layer.id) {
              const state = useStore.getState();
              const draggedNode = findLayerById(state.layers, draggedIndex);

              const rect = e.currentTarget.getBoundingClientRect();
              const relativeY = e.clientY - rect.top;

              let position: 'before' | 'after' | 'inside' = 'before';

              if (layer.type === 'group' || layer.type === 'artboard') {
                if (draggedNode?.type === 'artboard') {
                  position = relativeY < rect.height / 2 ? 'before' : 'after';
                } else {
                  if (relativeY < rect.height * 0.25) {
                    position = 'before';
                  } else if (relativeY > rect.height * 0.75) {
                    position = 'after';
                  } else {
                    position = 'inside';
                  }
                }
              } else {
                position = relativeY < rect.height / 2 ? 'before' : 'after';
              }

              state.reorderNodesAction?.(draggedIndex, layer.id, position);
              recordHistory('Reorder Layers');
            }
            setDraggedIndex(null);
          }}
          onDragEnd={() => {
            setDraggedIndex(null);
            document.querySelectorAll('.layer-node').forEach(el => {
              el.classList.remove('drag-before', 'drag-after', 'drag-inside');
            });
          }}
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
            <div className="layer-thumb ">
              {layer.thumbnail ? (
                <img src={layer.thumbnail} alt="" />
              ) : layer.type === 'artboard' ? (
                <LucideIcons.File size={16} />
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
            {(isLayerOrDescendantsLocked(layer) || layer.lockPixels || layer.lockPosition || layer.lockTransparent) && (
              <div className="layer-lock-indicator" title="Layer has active locks" style={{ display: 'flex', alignItems: 'center', marginRight: '6px' }}>
                <LucideIcons.Lock size={15} style={{ opacity: 1 }} />
              </div>
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

    const handleGlobalDragEnd = () => {
      document.querySelectorAll('.layer-node').forEach(el => {
        el.classList.remove('drag-before', 'drag-after', 'drag-inside');
      });
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    return () => window.removeEventListener('dragend', handleGlobalDragEnd);
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
    // lights,
    // removeLight,
    // activeLightId,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setDocumentSize,
    setActiveTool,
    setToolVariant,
    visiblePanels,
    // togglePanel
  } = useStore();

  const getMergedImageData = (format: string = 'image/png') => {
    const { w, h } = documentSize;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = w;
    exportCanvas.height = h;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return null;

    const drawLayerRecursive = (layer: any, currentOffsetX: number, currentOffsetY: number, parentOpacity: number = 1) => {
      if (!layer.visible) return;

      const lx = currentOffsetX + (layer.position?.x || 0);
      const ly = currentOffsetY + (layer.position?.y || 0);
      const currentOpacity = parentOpacity * layer.opacity * (layer.fill !== undefined ? layer.fill : 1);

      if (layer.children) {
        // Render children bottom-to-top (reverse of the array order)
        [...layer.children].reverse().forEach((child: any) => {
          drawLayerRecursive(child, lx, ly, currentOpacity);
        });
      } else {
        const el = document.querySelector(`canvas[data-layer-id="${layer.id}"]`) as HTMLCanvasElement;
        if (el) {
          ctx.save();
          ctx.globalAlpha = currentOpacity;
          ctx.globalCompositeOperation = layer.blendMode === 'pass through' ? 'source-over' : (layer.blendMode || 'source-over');
          ctx.drawImage(el, lx, ly);
          ctx.restore();
        }
      }
    };

    [...layers].reverse().forEach(layer => {
      drawLayerRecursive(layer, 0, 0);
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
  const [draggedIndex, setDraggedIndex] = React.useState<string | null>(null);
  const [isEditingOpacity, setIsEditingOpacity] = React.useState(false);
  const [tempOpacityValue, setTempOpacityValue] = React.useState('');
  const [isEditingFill, setIsEditingFill] = React.useState(false);
  const [tempFillValue, setTempFillValue] = React.useState('');

  const [saveModal, setSaveModal] = React.useState<{ type: 'cloud' | 'public' | null; provider?: string }>({ type: null });
  const [isLightingProcessing, setIsLightingProcessing] = React.useState(false);
  const [topDockTab, setTopDockTab] = React.useState<'history' | 'swatches'>('history');
  const [bottomDockTab, setBottomDockTab] = React.useState<'layers' | 'channels' | 'paths'>('layers');
  const [mobileActivePanel, setMobileActivePanel] = React.useState<'layers' | 'adjustments' | 'history'>('layers');


  const handleFade = () => { alert("Fade action triggered (Placeholder)"); };
  const handleCopyMerged = () => { alert("Copy Merged action triggered (Placeholder)"); };
  const handleFreeTransform = () => { alert("Free Transform action triggered (Placeholder)"); };
  const handlePreferences = () => { alert("Preferences action triggered (Placeholder)"); };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Zoom operations (Ctrl + / Ctrl -)
      if (isCtrl && (e.key === '=' || e.key === '+' || e.key === 'Add')) {
        e.preventDefault();
        const currentZoom = useStore.getState().zoom;
        useStore.getState().setZoom(Math.min(32, currentZoom + 0.1));
        return;
      }
      if (isCtrl && (e.key === '-' || e.key === 'Subtract')) {
        e.preventDefault();
        const currentZoom = useStore.getState().zoom;
        useStore.getState().setZoom(Math.max(0.01, currentZoom - 0.1));
        return;
      }

      // Don't trigger shortcuts if user is typing in an input or textarea or custom text editor
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || useStore.getState().isTyping) {
        return;
      }

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


  const handleFile = async (file: File | Blob, name?: string, skipResize: boolean = false) => {
    const isOpening = !skipResize;

    try {
      setIsProcessing(true);
      setProcessingText('Importing file...');

      // If it's a blob without a name property (e.g. pasted image), construct a File or use default name
      const fileToImport = file instanceof File ? file : new File([file], name || 'Pasted Image', { type: file.type });

      // Run it through the universal ImportEngine
      const result = await ImportEngine.importFile(fileToImport);

      // Now handle the result by type:
      if (result.type === 'psd') {
        const psdData = await workerExportBridge.parsePSD(result.psdData);
        // Extract lighting metadata if it exists
        const metadataLayer = psdData.children?.find((c: any) => c.name === '__pixelite_metadata__');
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

        const loadedLayers: any[] = [];
        const processPsdLayer = (child: any) => {
          if (child.children) {
            child.children.forEach(processPsdLayer);
          } else if (child.dataUrl) {
            loadedLayers.push({
              id: nanoid(),
              name: child.name || 'Layer',
              type: 'image' as const,
              dataUrl: child.dataUrl,
              position: { x: child.left || 0, y: child.top || 0 },
              visible: child.hidden !== true,
              locked: false,
              opacity: typeof child.opacity === 'number' ? child.opacity : 1,
              blendMode: child.blendMode === 'pass through' || !child.blendMode ? 'source-over' : child.blendMode
            });
          } else if (child.canvas) {
            loadedLayers.push({
              id: nanoid(),
              name: child.name || 'Layer',
              type: 'image' as const,
              dataUrl: child.canvas.toDataURL(),
              position: { x: child.left || 0, y: child.top || 0 },
              visible: child.visible !== false,
              locked: false,
              opacity: typeof child.opacity === 'number' ? child.opacity : 1,
              blendMode: child.blendMode || 'normal'
            });
          }
        };
        if (psdData.children) psdData.children.forEach(processPsdLayer);
        const layersToUse = loadedLayers.reverse();

        const projectState = {
          layers: layersToUse,
          documentSize: { w: psdData.width, h: psdData.height },
          ...lightingMetadata,
          isLightingEnabled: !!lightingMetadata?.lights?.length
        };

        if (isOpening) {
          addDocument(fileToImport.name, { w: psdData.width, h: psdData.height }, {
            ...projectState,
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open PSD', state: projectState }],
            historyIndex: 0
          });
        } else {
          setDocumentSize({ w: psdData.width, h: psdData.height });
          setLayers(layersToUse);
          if (layersToUse.length > 0) setActiveLayer(layersToUse[0].id);
          if (lightingMetadata.lights) {
            useStore.getState().updateLighting(lightingMetadata);
          }
          recordHistory(`Import PSD: ${fileToImport.name}`);
        }
      } else if (result.type === 'gif' && result.frames) {
        const newLayers: any[] = result.frames.map((frame, index) => ({
          id: nanoid(),
          name: frame.name || `Frame ${index + 1}`,
          type: 'image' as any,
          dataUrl: frame.dataUrl,
          position: !isOpening
            ? { x: (documentSize.w - result.width) / 2, y: (documentSize.h - result.height) / 2 }
            : { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        })).reverse();

        if (isOpening) {
          addDocument(fileToImport.name, { w: result.width, h: result.height }, {
            layers: newLayers,
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open GIF', state: { layers: newLayers, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          setLayers([...layers, ...newLayers]);
          if (newLayers.length > 0) setActiveLayer(newLayers[newLayers.length - 1].id);
          recordHistory(`Place GIF: ${fileToImport.name}`);
        }
      } else if (result.type === 'svg' && result.layers) {
        const layersToUse = result.layers.reverse();
        if (isOpening) {
          addDocument(fileToImport.name, { w: result.width, h: result.height }, {
            layers: layersToUse,
            documentSize: { w: result.width, h: result.height },
            zoom: 1,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open SVG', state: { layers: layersToUse, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          setLayers([...layers, ...layersToUse]);
          if (layersToUse.length > 0) setActiveLayer(layersToUse[layersToUse.length - 1].id);
          recordHistory(`Place SVG: ${fileToImport.name}`);
        }
      } else if (result.type === 'pdf' && result.layers) {
        const layersToUse = result.layers;
        if (isOpening) {
          const viewportW = window.innerWidth - 240 - 44 - 60;
          const viewportH = window.innerHeight - 38 - 32 - 24 - 40;
          const zoomW = viewportW / result.width;
          const zoomH = viewportH / result.height;
          const initialZoom = Math.min(1, Math.min(zoomW, zoomH));

          addDocument(fileToImport.name, { w: result.width, h: result.height }, {
            layers: layersToUse,
            documentSize: { w: result.width, h: result.height },
            zoom: initialZoom,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open PDF', state: { layers: layersToUse, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          // When placing, offset each page group to center it
          const offsetLayers = layersToUse.map((pg) => ({
            ...pg,
            position: {
              x: (pg.position?.x || 0) + (documentSize.w - result.width) / 2,
              y: (pg.position?.y || 0) + (documentSize.h - result.height) / 2,
            },
          }));
          setLayers([...offsetLayers, ...layers]);
          if (offsetLayers.length > 0) setActiveLayer(offsetLayers[0].id);
          recordHistory(`Place PDF: ${fileToImport.name}`);
        }
      } else if (result.type === 'image' && result.dataUrl) {
        const isDefaultBackground =
          layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';

        if (isOpening) {
          const newLayers = [{
            id: nanoid(),
            name: fileToImport.name || 'Pasted Image',
            type: 'image' as const,
            dataUrl: result.dataUrl,
            visible: true,
            opacity: 1,
            position: { x: 0, y: 0 },
            locked: false
          }];

          // Calculate initial zoom to fit
          const viewportW = window.innerWidth - 240 - 44 - 60; // 60px padding
          const viewportH = window.innerHeight - 38 - 32 - 24 - 40; // 40px padding
          const zoomW = viewportW / result.width;
          const zoomH = viewportH / result.height;
          const initialZoom = Math.min(1, Math.min(zoomW, zoomH));

          if (result.exifData) (useStore.getState() as any).setExifData(result.exifData);
          if (result.iccProfile) (useStore.getState() as any).setIccProfile(result.iccProfile);

          addDocument(fileToImport.name, { w: result.width, h: result.height }, {
            layers: newLayers,
            documentSize: { w: result.width, h: result.height },
            zoom: initialZoom,
            canvasOffset: { x: 0, y: 0 },
            history: [{ name: 'Open Image', state: { layers: newLayers, documentSize: { w: result.width, h: result.height } } }],
            historyIndex: 0
          });
        } else {
          if (layers.length === 0 || isDefaultBackground) {
            setDocumentSize({ w: result.width, h: result.height });
          }
          addLayer({
            name: fileToImport.name || 'Pasted Image',
            type: 'image',
            dataUrl: result.dataUrl,
            position: (layers.length === 0 || isDefaultBackground || skipResize) ? { x: 0, y: 0 } : { x: (documentSize.w - result.width) / 2, y: (documentSize.h - result.height) / 2 }
          });
          recordHistory(`Import ${fileToImport.name}`);
        }
      }
    } catch (err: any) {
      console.error('[handleFile] Full error:', err);
      console.error('[handleFile] Stack:', err?.stack);
      alert('Failed to open file: ' + (err?.message ?? String(err)));
    } finally {
      setIsProcessing(false);
      setProcessingText('');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
      e.target.value = '';
    }
  };

  const handlePlaceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file, undefined, true); // true = skipResize
      e.target.value = '';
    }
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

  const handleOpenURL = async () => {
    let url = prompt('Enter image/document URL or Local File Path:');
    if (!url) return;

    url = url.replace(/^['"]|['"]$/g, '').trim();

    // Check if it's a local file path
    const isLocalFilePath = url.startsWith('file:') || /^[a-zA-Z]:[\\/]/.test(url) || url.startsWith('\\\\');

    if (isLocalFilePath) {
      // Clean path
      let cleanPath = url;
      if (url.startsWith('file:///')) {
        cleanPath = url.substring(8);
      } else if (url.startsWith('file://')) {
        cleanPath = url.substring(7);
      }

      // Extract parts to show a nice prompt
      const lastSlash = Math.max(cleanPath.lastIndexOf('/'), cleanPath.lastIndexOf('\\'));
      const filename = lastSlash !== -1 ? cleanPath.substring(lastSlash + 1) : cleanPath;
      const parentDir = lastSlash !== -1 ? cleanPath.substring(0, lastSlash) : 'its parent folder';

      // 100% Client-side File System Access API check
      if (typeof (window as any).showDirectoryPicker !== 'function') {
        alert(
          `Local file paths cannot be opened directly in this browser.\n\n` +
          `Please select the file manually using File -> Open instead.`
        );
        document.getElementById('global-file-input')?.click();
        return;
      }

      try {
        setIsProcessing(true);
        setProcessingText('Locating file...');

        // Prompt the user to grant permission to the directory containing the file
        alert(
          `To open this local file, we need temporary browser permission to search its parent folder.\n\n` +
          `In the next window, please select and confirm permission for the folder:\n"${parentDir}"`
        );

        const dirHandle = await (window as any).showDirectoryPicker();

        // Try direct resolution first
        let fileHandle = null;
        try {
          const dirName = dirHandle.name;
          const normalizedPath = cleanPath.replace(/\//g, '\\');
          const marker = '\\' + dirName + '\\';
          const index = normalizedPath.indexOf(marker);
          let relativeParts: string[] = [];

          if (index !== -1) {
            relativeParts = normalizedPath.substring(index + marker.length).split('\\').filter(Boolean);
          } else if (normalizedPath.endsWith('\\' + dirName)) {
            relativeParts = [];
          } else {
            relativeParts = [filename];
          }

          let currentDir = dirHandle;
          for (let i = 0; i < relativeParts.length - 1; i++) {
            currentDir = await currentDir.getDirectoryHandle(relativeParts[i]);
          }
          const targetName = relativeParts.length > 0 ? relativeParts[relativeParts.length - 1] : filename;
          fileHandle = await currentDir.getFileHandle(targetName);
        } catch (e) {
          console.warn('Direct path resolution failed, trying recursive search...', e);
        }

        // Fallback: search recursively
        if (!fileHandle) {
          const findFileRecursively = async (
            directory: any,
            targetName: string
          ): Promise<any | null> => {
            for await (const entry of directory.values()) {
              if (entry.kind === 'file') {
                if (entry.name.toLowerCase() === targetName.toLowerCase()) {
                  return entry;
                }
              } else if (entry.kind === 'directory') {
                try {
                  const found = await findFileRecursively(entry, targetName);
                  if (found) return found;
                } catch (e) {
                  // Ignore directory read/permission errors
                }
              }
            }
            return null;
          };

          fileHandle = await findFileRecursively(dirHandle, filename);
        }

        if (!fileHandle) {
          throw new Error(`File "${filename}" not found in the selected folder tree.`);
        }

        const file = await fileHandle.getFile();
        await handleFile(file);
      } catch (err: any) {
        console.error(err);
        alert('Could not open local file:\n' + err.message);
      } finally {
        setIsProcessing(false);
        setProcessingText('');
      }
      return;
    }

    // Otherwise, handle it as a standard web URL
    try {
      setIsProcessing(true);
      setProcessingText('Downloading file...');

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      const blob = await response.blob();

      // Extract filename and extension from the URL
      let filename = 'file_from_url';
      try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (lastPart) {
          filename = decodeURIComponent(lastPart);
        } else {
          // If pathname has no filename, check content-type to append extension
          const mime = blob.type;
          if (mime === 'application/pdf') filename += '.pdf';
          else if (mime === 'image/svg+xml') filename += '.svg';
          else if (mime === 'image/gif') filename += '.gif';
          else if (mime === 'application/x-photoshop' || mime === 'image/vnd.adobe.photoshop') filename += '.psd';
          else if (mime.startsWith('image/')) {
            const ext = mime.split('/')[1];
            filename += `.${ext}`;
          }
        }
      } catch (e) {
        // Fallback using blob type if URL parsing fails
        const mime = blob.type;
        if (mime === 'application/pdf') filename += '.pdf';
        else if (mime === 'image/svg+xml') filename += '.svg';
        else if (mime === 'image/gif') filename += '.gif';
        else if (mime === 'application/x-photoshop' || mime === 'image/vnd.adobe.photoshop') filename += '.psd';
      }

      // Construct a proper File object
      const file = new File([blob], filename, { type: blob.type });

      // Run it through the app's existing file importer
      await handleFile(file);
    } catch (err: any) {
      console.error(err);

      // Fallback: If it's a standard image URL, try loading via <img> tags directly
      console.warn('Fetch failed, falling back to standard image loader...');
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
      img.onerror = () => {
        alert('Could not load document or image from URL.\nError: ' + err.message);
      };
      img.src = url;
    } finally {
      setIsProcessing(false);
      setProcessingText('');
    }
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
    <div className={`app-layout ${isMobileMenuOpen || isToolsOpen || isPanelsOpen ? 'mobile-panel-active' : ''} ${isMobileMenuOpen ? 'menu-active' : ''} ${isToolsOpen ? 'tools-active' : ''} ${isPanelsOpen ? 'panels-active' : ''}`}>
      <input type="file" id="global-file-input" accept="image/*,image/svg+xml,application/pdf,.psd" hidden onChange={handleImageUpload} />
      <input type="file" id="place-file-input" accept="image/*,image/svg+xml,application/pdf,.psd" hidden onChange={handlePlaceUpload} />

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
          <button className="mobile-menu-btn" onClick={() => {
            const nextState = !isMobileMenuOpen;
            setIsMobileMenuOpen(nextState);
            if (nextState) {
              setIsToolsOpen(false);
              setIsPanelsOpen(false);
            }
          }}>
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

        <aside className={`side-panels ${isPanelsOpen ? 'mobile-open' : ''} mobile-panel-${mobileActivePanel}`}>
          {isPanelsOpen && (
            <div className="mobile-panel-header">
              <span>Panels</span>
              <button onClick={() => setIsPanelsOpen(false)}><LucideIcons.ChevronDown size={20} /></button>
            </div>
          )}

          {isPanelsOpen && (
            <div className="mobile-panel-tabs">
              {visiblePanels.layers && (
                <button
                  className={`mobile-panel-tab ${mobileActivePanel === 'layers' ? 'active' : ''}`}
                  onClick={() => { setMobileActivePanel('layers'); setBottomDockTab('layers'); }}
                >Layers</button>
              )}
              {visiblePanels.adjustments && (
                <button
                  className={`mobile-panel-tab ${mobileActivePanel === 'adjustments' ? 'active' : ''}`}
                  onClick={() => setMobileActivePanel('adjustments')}
                >Adjustments</button>
              )}
              {visiblePanels.history && (
                <button
                  className={`mobile-panel-tab ${mobileActivePanel === 'history' ? 'active' : ''}`}
                  onClick={() => { setMobileActivePanel('history'); setTopDockTab('history'); }}
                >History</button>
              )}
            </div>
          )}

          {/* TOP DOCK: History / Swatches */}
          {(visiblePanels.history || visiblePanels.swatches) && (
            <div className="side-panel dock-panel top-dock">
              <div className="dock-tabs">
                {visiblePanels.history && (
                  <button
                    className={`dock-tab ${topDockTab === 'history' ? 'active' : ''}`}
                    onClick={() => setTopDockTab('history')}
                  >History</button>
                )}
                {visiblePanels.swatches && (
                  <button
                    className={`dock-tab ${topDockTab === 'swatches' ? 'active' : ''}`}
                    onClick={() => setTopDockTab('swatches')}
                  >Swatches</button>
                )}
              </div>

              {topDockTab === 'history' && visiblePanels.history && (
                <div className="panel-content">
                  {history.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`history-item ${idx === historyIndex ? 'active' : ''} ${idx > historyIndex ? 'undone' : ''}`}
                      onClick={() => {
                        const diff = idx - historyIndex;
                        if (diff > 0) { for (let i = 0; i < diff; i++) redo(); }
                        else if (diff < 0) { for (let i = 0; i < -diff; i++) undo(); }
                      }}
                    >
                      <LucideIcons.History size={10} style={{ marginRight: 6, opacity: 0.5 }} />
                      {entry.name}
                    </div>
                  ))}
                </div>
              )}

              {topDockTab === 'swatches' && visiblePanels.swatches && (
                <div className="panel-content swatches-panel-content">
                  <div className="swatches-grid">
                    {['#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
                      '#ff6600', '#9900ff', '#006600', '#003399', '#cc0066', '#669900', '#ff9999', '#99ccff',
                      '#663300', '#336699', '#ffcc00', '#cccccc', '#888888', '#444444', '#111111', '#ffeedd'].map(color => (
                        <button
                          key={color}
                          className="swatch-btn"
                          style={{ background: color }}
                          title={color}
                          onClick={() => useStore.getState().setBrushColor?.(color)}
                        />
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MIDDLE DOCK: Adjustments */}
          {visiblePanels.adjustments && (
            <div className="side-panel dock-panel adjustments-dock">
              <div className="dock-tabs">
                <button className="dock-tab active">Adjustments</button>
              </div>
              <div className="panel-content adjustments-panel-content">
                <div className="adj-grid">
                  {[
                    { icon: <LucideIcons.Sun size={16} />, label: 'Brightness', action: 'brightness_contrast' },
                    { icon: <LucideIcons.TrendingUp size={16} />, label: 'Levels' },
                    { icon: <LucideIcons.Activity size={16} />, label: 'Curves' },
                    { icon: <LucideIcons.Aperture size={16} />, label: 'Exposure' },
                    { icon: <LucideIcons.Droplet size={16} />, label: 'Vibrance' },
                    { icon: <LucideIcons.Palette size={16} />, label: 'Hue/Sat', action: 'hue_saturation' },
                    { icon: <LucideIcons.Scale size={16} />, label: 'Color Bal' },
                    { icon: <LucideIcons.Contrast size={16} />, label: 'B&W', action: 'black_white' },
                    { icon: <LucideIcons.Camera size={16} />, label: 'Photo Flt', action: 'photo_effects' },
                    { icon: <LucideIcons.Sliders size={16} />, label: 'Ch. Mixer' },
                    { icon: <LucideIcons.Layers size={16} />, label: 'Color Lkp' },
                    { icon: <LucideIcons.RefreshCw size={16} />, label: 'Invert' },
                    { icon: <LucideIcons.BarChart2 size={16} />, label: 'Posterize' },
                    { icon: <LucideIcons.Triangle size={16} />, label: 'Threshold' },
                    { icon: <LucideIcons.Map size={16} />, label: 'Grad Map' },
                    { icon: <LucideIcons.Filter size={16} />, label: 'Sel. Color' },
                  ].map(({ icon, label, action }) => (
                    <button
                      key={label}
                      className="adj-btn"
                      title={label}
                      onClick={() => {
                        if (action) {
                          useStore.getState().setActiveAdjustmentModal(action as any);
                        }
                      }}
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* BOTTOM DOCK: Layers / Channels / Paths */}
          {(visiblePanels.layers || visiblePanels.channels || visiblePanels.paths) && (
            <div className="side-panel dock-panel bottom-dock">
              <div className="dock-tabs">
                {visiblePanels.layers && (
                  <button
                    className={`dock-tab ${bottomDockTab === 'layers' ? 'active' : ''}`}
                    onClick={() => setBottomDockTab('layers')}
                  >Layers</button>
                )}
                {visiblePanels.channels && (
                  <button
                    className={`dock-tab ${bottomDockTab === 'channels' ? 'active' : ''}`}
                    onClick={() => setBottomDockTab('channels')}
                  >Channels</button>
                )}
                {visiblePanels.paths && (
                  <button
                    className={`dock-tab ${bottomDockTab === 'paths' ? 'active' : ''}`}
                    onClick={() => setBottomDockTab('paths')}
                  >Paths</button>
                )}
              </div>

              {bottomDockTab === 'layers' && visiblePanels.layers && (
                <>
                  {/* Layer blend + opacity controls */}
                  {activeLayerId && (() => {
                    const activeLayer = findLayerById(layers, activeLayerId);
                    if (!activeLayer) return null;
                    return (
                      <div className="layer-global-properties">
                        <div className="layer-properties-row">
                          <select
                            className="blend-select"
                            value={activeLayer.blendMode || 'source-over'}
                            onChange={(e) => updateLayer(activeLayerId, { blendMode: e.target.value as any })}
                          >
                            <option value="source-over">Normal</option>
                            <option value="multiply">Multiply</option>
                            <option value="screen">Screen</option>
                            <option value="overlay">Overlay</option>
                            <option value="darken">Darken</option>
                            <option value="lighten">Lighten</option>
                            <option value="color-dodge">Color Dodge</option>
                            <option value="color-burn">Color Burn</option>
                            <option value="hard-light">Hard Light</option>
                            <option value="soft-light">Soft Light</option>
                            <option value="difference">Difference</option>
                            <option value="exclusion">Exclusion</option>
                            <option value="hue">Hue</option>
                            <option value="saturation">Saturation</option>
                            <option value="color">Color</option>
                            <option value="luminosity">Luminosity</option>
                          </select>
                          <div className="opacity-control">
                            <span>Op:</span>
                            <input
                              type="range"
                              min="0" max="1" step="0.01"
                              value={activeLayer.opacity || 0}
                              onChange={(e) => updateLayer(activeLayerId, { opacity: parseFloat(e.target.value) })}
                            />
                            {isEditingOpacity ? (
                              <input
                                type="text"
                                className="opacity-input"
                                autoFocus
                                value={tempOpacityValue}
                                onChange={(e) => setTempOpacityValue(e.target.value)}
                                onFocus={(e) => { e.target.select(); setIsTyping(true); }}
                                onBlur={() => {
                                  setIsEditingOpacity(false);
                                  setIsTyping(false);
                                  const val = parseInt(tempOpacityValue);
                                  if (!isNaN(val)) {
                                    updateLayer(activeLayerId, { opacity: Math.max(0, Math.min(1, val / 100)) });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  if (e.key === 'Escape') { setIsEditingOpacity(false); setIsTyping(false); }
                                }}
                              />
                            ) : (
                              <span
                                className="opacity-val"
                                onDoubleClick={() => {
                                  setTempOpacityValue(Math.round((activeLayer.opacity || 0) * 100).toString());
                                  setIsEditingOpacity(true);
                                }}
                                title="Double-click to type exact value"
                              >
                                {Math.round((activeLayer.opacity || 0) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="layer-properties-row">
                          <div className="lock-control">
                            <span>Lock:</span>
                            <button
                              className={`lock-btn ${activeLayer.lockTransparent ? 'active' : ''}`}
                              disabled={isLayerOrDescendantsLocked(activeLayer)}
                              onClick={() => {
                                const newVal = !activeLayer.lockTransparent;
                                updateLayer(activeLayerId, { lockTransparent: newVal });
                                recordHistory(`Toggle Lock Transparency`);
                              }}
                              title="Lock transparent pixels"
                            >
                              <CheckerboardIcon />
                            </button>
                            <button
                              className={`lock-btn ${activeLayer.lockPixels ? 'active' : ''}`}
                              disabled={isLayerOrDescendantsLocked(activeLayer)}
                              onClick={() => {
                                const newVal = !activeLayer.lockPixels;
                                updateLayer(activeLayerId, { lockPixels: newVal });
                                recordHistory(`Toggle Lock Pixels`);
                              }}
                              title="Lock image pixels"
                            >
                              <LucideIcons.Paintbrush size={11} />
                            </button>
                            <button
                              className={`lock-btn ${activeLayer.lockPosition ? 'active' : ''}`}
                              disabled={isLayerOrDescendantsLocked(activeLayer)}
                              onClick={() => {
                                const newVal = !activeLayer.lockPosition;
                                updateLayer(activeLayerId, { lockPosition: newVal });
                                recordHistory(`Toggle Lock Position`);
                              }}
                              title="Lock position"
                            >
                              <LucideIcons.Move size={11} />
                            </button>
                            <button
                              className={`lock-btn ${isLayerOrDescendantsLocked(activeLayer) ? 'active' : ''}`}
                              onClick={() => {
                                const newVal = !isLayerOrDescendantsLocked(activeLayer);
                                updateLayer(activeLayerId, { locked: newVal });
                                recordHistory(newVal ? `Toggle Lock All` : `Toggle Unlock All`);
                              }}
                              title="Lock all"
                            >
                              <LucideIcons.Lock size={11} />
                            </button>
                          </div>

                          <div className="fill-control">
                            <span>Fill:</span>
                            <input
                              type="range"
                              min="0" max="1" step="0.01"
                              value={activeLayer.fill !== undefined ? activeLayer.fill : 1}
                              onChange={(e) => updateLayer(activeLayerId, { fill: parseFloat(e.target.value) })}
                            />
                            {isEditingFill ? (
                              <input
                                type="text"
                                className="opacity-input"
                                autoFocus
                                value={tempFillValue}
                                onChange={(e) => setTempFillValue(e.target.value)}
                                onFocus={(e) => { e.target.select(); setIsTyping(true); }}
                                onBlur={() => {
                                  setIsEditingFill(false);
                                  setIsTyping(false);
                                  const val = parseInt(tempFillValue);
                                  if (!isNaN(val)) {
                                    updateLayer(activeLayerId, { fill: Math.max(0, Math.min(1, val / 100)) });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  if (e.key === 'Escape') { setIsEditingFill(false); setIsTyping(false); }
                                }}
                              />
                            ) : (
                              <span
                                className="opacity-val"
                                onDoubleClick={() => {
                                  setTempFillValue(Math.round((activeLayer.fill !== undefined ? activeLayer.fill : 1) * 100).toString());
                                  setIsEditingFill(true);
                                }}
                                title="Double-click to type exact value"
                              >
                                {Math.round((activeLayer.fill !== undefined ? activeLayer.fill : 1) * 100)}%
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="panel-content" onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex && layers.length > 0) {
                      useStore.getState().reorderNodesAction?.(draggedIndex, layers[layers.length - 1].id, 'after');
                      recordHistory('Reorder Layers');
                    }
                    setDraggedIndex(null);
                  }} onDragOver={(e) => e.preventDefault()}>
                    {renderLayerTree(layers)}
                  </div>

                  {/* Photoshop-style layers panel footer */}
                  <div className="panel-footer layers-footer">
                    <button title="Link Layers" className="layers-footer-btn">
                      <LucideIcons.Link size={13} />
                    </button>
                    <button title="Layer Effects" className="layers-footer-btn">
                      <LucideIcons.Wand2 size={13} />
                    </button>
                    <button title="Add Layer Mask" className="layers-footer-btn">
                      <LucideIcons.Square size={13} />
                    </button>
                    <button title="New Adjustment Layer" className="layers-footer-btn">
                      <LucideIcons.SatelliteDish size={13} />
                    </button>
                    <button
                      title="New Group"
                      className="layers-footer-btn"
                      onClick={() => addLayer({ name: `Group ${layers.length + 1}`, type: 'group' } as any)}
                    >
                      <LucideIcons.Folder size={13} />
                    </button>
                    <button
                      title="New Layer"
                      className="layers-footer-btn"
                      onClick={() => addLayer({ name: `Layer ${layers.length + 1}` })}
                    >
                      <LucideIcons.Plus size={13} />
                    </button>
                    <button
                      title="Delete Layer"
                      className="layers-footer-btn layers-footer-delete"
                      onClick={() => activeLayerId && removeLayer(activeLayerId)}
                      disabled={layers.length <= 1}
                    >
                      <LucideIcons.Trash2 size={13} />
                    </button>
                  </div>
                </>
              )}

              {bottomDockTab === 'channels' && visiblePanels.channels && (
                <div className="panel-content channels-panel-content">
                  {(['RGB', 'Red', 'Green', 'Blue'] as const).map((ch, i) => (
                    <div key={ch} className="channel-row">
                      <div className="channel-eye"><LucideIcons.Eye size={11} /></div>
                      <div className="channel-swatch" style={{
                        background: i === 0 ? 'linear-gradient(90deg, #000, #fff)' :
                          i === 1 ? 'linear-gradient(90deg, #000, #f00)' :
                            i === 2 ? 'linear-gradient(90deg, #000, #0f0)' :
                              'linear-gradient(90deg, #000, #00f)'
                      }} />
                      <span className="channel-name">{ch}</span>
                      <span className="channel-shortcut">{i === 0 ? 'Ctrl+~' : `Ctrl+${i}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {bottomDockTab === 'paths' && visiblePanels.paths && (
                <div className="panel-content paths-panel-content">
                  <div className="no-items" style={{ paddingTop: 24 }}>
                    <LucideIcons.PenTool size={24} style={{ marginBottom: 8, opacity: 0.3 }} />
                    <div>No paths</div>
                    <div style={{ fontSize: 10, marginTop: 4, opacity: 0.6 }}>Use the Pen tool to create paths</div>
                  </div>
                </div>
              )}
            </div>
          )}
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
      <SignatureDialog />
      <CameraDialog />
      <MobileCameraDialog />
      <AdjustmentDialog />

      <AlertContainer />
    </div>
  );
};

export default App;

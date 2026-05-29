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
import { MenuBar } from './components/MenuSystem/MenuBar';
import { NewDocumentDialog } from './components/Dialogs/NewDocumentDialog';
import { ExportAsDialog } from './components/Dialogs/ExportAsDialog';
import { FileInfoDialog } from './components/Dialogs/FileInfoDialog';
import { ImportEngine } from './services/import/ImportEngine';
import { removeBackground } from '@imgly/background-removal';
import './App.css';

const App: React.FC = () => {
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
        duplicateLayer,
    setActiveTool,
    setToolVariant,
    setSelectionRect,
    setIsInverseSelection,
    setCropRect,
    setLassoPaths,
    moveLayer,
    reorderLayers,
    setIsTyping,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    setActiveMobileSubmenu
  } = useStore();



  const handleFade = () => { alert("Fade action triggered (Placeholder)"); };
  const handleCopyMerged = () => { alert("Copy Merged action triggered (Placeholder)"); };
          const handleFreeTransform = () => { alert("Free Transform action triggered (Placeholder)"); };
                const handlePreferences = () => { alert("Preferences action triggered (Placeholder)"); };

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



  const blobToDataUrl = React.useCallback((blob: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to convert blob to data URL.'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob.'));
    reader.readAsDataURL(blob);
  }), []);

  React.useEffect(() => {
    const handleRemoveBackground = async () => {
      const state = useStore.getState();
      const layerId = state.activeLayerId;
      if (!layerId) return;

      const activeLayer = state.layers.find((layer) => layer.id === layerId);
      if (!activeLayer?.dataUrl) {
        alert('Please select an image layer first.');
        return;
      }

      try {
        setIsProcessing(true);
        setProcessingText('Removing background...');

        const inputResponse = await fetch(activeLayer.dataUrl);
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

        const outputDataUrl = await blobToDataUrl(outputBlob);
        state.updateLayer(layerId, { dataUrl: outputDataUrl, type: 'image' });
        state.recordHistory('Remove Background');
      } catch (error) {
        console.error('Background removal failed:', error);
        alert('Background removal failed. Please try again.');
      } finally {
        setIsProcessing(false);
        setProcessingText('');
      }
    };

    window.addEventListener('remove-background', handleRemoveBackground);
    return () => window.removeEventListener('remove-background', handleRemoveBackground);
  }, [blobToDataUrl]);

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
  }, [undo, redo, addLayer, setSelectionRect, setLassoPaths, setCropRect, setIsInverseSelection, setActiveTool, setToolVariant, setIsFillPickerOpen, duplicateLayer]);


  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await ImportEngine.importFile(file);
      if (result.type !== 'image' || !result.dataUrl) return;

      const currentState = useStore.getState();
      const isDefaultBackground =
        currentState.layers.length === 1 &&
        currentState.layers[0].name === 'Background' &&
        currentState.layers[0].type === 'paint';

      if (currentState.layers.length === 0 || isDefaultBackground) {
        currentState.setDocumentSize({ w: result.width, h: result.height });
        currentState.setLayers([{
          id: Math.random().toString(36).substring(7),
          name: result.name,
          type: 'image',
          dataUrl: result.dataUrl,
          position: { x: 0, y: 0 },
          visible: true,
          locked: false,
          opacity: 1,
          blendMode: 'source-over'
        }]);
      } else {
        currentState.setLayers([...
          currentState.layers,
          {
            id: Math.random().toString(36).substring(7),
            name: result.name,
            type: 'image',
            dataUrl: result.dataUrl,
            position: {
              x: (currentState.documentSize.w - result.width) / 2,
              y: (currentState.documentSize.h - result.height) / 2
            },
            visible: true,
            locked: false,
            opacity: 1,
            blendMode: 'source-over'
          }
        ]);
      }

      currentState.recordHistory(`Open ${result.name}`);
    } catch (err) {
      console.error(err);
      alert('Failed to open image.');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className={`app-layout ${isMobileMenuOpen || isToolsOpen || isPanelsOpen ? 'mobile-panel-active' : ''}`}>
      <input type="file" id="global-file-input" accept="image/*" hidden onChange={handleImageUpload} />

      {(isMobileMenuOpen || isToolsOpen || isPanelsOpen) && (
        <div
          className="mobile-backdrop"
          onClick={() => {
            setIsMobileMenuOpen(false);
            setIsToolsOpen(false);
            setIsPanelsOpen(false);
            setActiveMobileSubmenu(null);
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

        <MenuBar />

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
            <div className="status-item">GPU: Active</div>
            <div className="status-item status-ready">Ready</div>
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
              const activeLayer = layers.find(l => l.id === activeLayerId);
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

            <div className="panel-content">
              {layers.map((layer, idx) => (
                <div
                  key={layer.id}
                  className={`layer-node ${draggedIndex === idx ? 'dragging' : ''}`}
                  draggable={true}
                  onDragStart={() => setDraggedIndex(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggedIndex !== null && draggedIndex !== idx) {
                      reorderLayers(draggedIndex, idx);
                      recordHistory('Reorder Layers');
                    }
                    setDraggedIndex(null);
                  }}
                  onDragEnd={() => setDraggedIndex(null)}
                >
                  <div className={`layer-row ${activeLayerId === layer.id ? 'active' : ''}`} onClick={() => setActiveLayer(layer.id)}>
                    <div className="layer-eye" onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}>
                      {layer.visible ? <LucideIcons.Eye size={12} /> : <LucideIcons.EyeOff size={12} />}
                    </div>
                    <div className="layer-thumb">
                      {layer.thumbnail && <img src={layer.thumbnail} alt="" />}
                    </div>
                    <span className="layer-title">{layer.name}</span>
                    <div className="layer-order-btns">
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); recordHistory('Move Layer Up'); }} title="Move Up"><LucideIcons.ChevronUp size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); recordHistory('Move Layer Down'); }} title="Move Down"><LucideIcons.ChevronDown size={12} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="panel-footer">
              <button onClick={() => addLayer({ name: `Layer ${layers.length + 1}` })}><LucideIcons.Plus size={14} /></button>
              <button onClick={() => activeLayerId && removeLayer(activeLayerId)} disabled={layers.length <= 1}><LucideIcons.Trash2 size={14} /></button>
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

      <NewDocumentDialog />
      <ExportAsDialog />
      <FileInfoDialog />
</div>
  );
};

export default App;

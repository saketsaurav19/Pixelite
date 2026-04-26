import React from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from './store/useStore';
import Canvas from './components/Canvas/Canvas';
import Toolbar from './components/Toolbar/Toolbar';
import OptionsBar from './components/OptionsBar/OptionsBar';
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
    history
  } = useStore();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        document.getElementById('global-file-input')?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      addLayer({
        name: file.name,
        type: 'image',
        dataUrl,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-layout">
      <input type="file" id="global-file-input" accept="image/*" hidden onChange={handleImageUpload} />
      
      <header className="app-header">
        <nav className="main-nav">
          <div className="menu-item-container">
            <span>File</span>
            <div className="menu-dropdown">
              <div className="menu-option" onClick={() => document.getElementById('global-file-input')?.click()}>
                <span>Open</span> <span className="shortcut">Ctrl+O</span>
              </div>
              <div className="menu-divider" />
              <div className="menu-option"><span>Save</span> <span className="shortcut">Ctrl+S</span></div>
              <div className="menu-option"><span>Export as PNG</span></div>
            </div>
          </div>
          <div className="menu-item-container"><span>Edit</span></div>
          <div className="menu-item-container"><span>Image</span></div>
          <div className="menu-item-container"><span>Layer</span></div>
          <div className="menu-item-container"><span>Select</span></div>
          <div className="menu-item-container"><span>Filter</span></div>
          <div className="menu-item-container"><span>View</span></div>
          <div className="menu-item-container"><span>Window</span></div>
        </nav>
      </header>
      <OptionsBar />
      <div className="app-body">
        <Toolbar />
        
        <main className="workspace">
          <div className="canvas-viewport">
            <Canvas />
          </div>
          
          <footer className="status-bar">
            <div className="status-item">Zoom: {(zoom * 100).toFixed(0)}%</div>
            <div className="status-item">GPU: Active</div>
            <div className="status-item status-ready">Ready</div>
          </footer>
        </main>

        <aside className="side-panels">
          <div className="side-panel history-panel">
            <div className="panel-tab">History</div>
            <div className="panel-content">
              {history.length === 0 ? <div className="history-item active">New Project</div> : 
                history.map((entry, idx) => (
                  <div key={idx} className={`history-item ${idx === history.length - 1 ? 'active' : ''}`}>
                    {entry.name}
                  </div>
                ))
              }
            </div>
          </div>

          <div className="side-panel layers-panel">
            <div className="panel-tab">Layers</div>
            <div className="panel-content">
              {layers.map((layer) => (
                <div key={layer.id} className="layer-node">
                  <div className={`layer-row ${activeLayerId === layer.id ? 'active' : ''}`} onClick={() => setActiveLayer(layer.id)}>
                    <div className="layer-eye" onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}>
                      {layer.visible ? <LucideIcons.Eye size={12} /> : <LucideIcons.EyeOff size={12} />}
                    </div>
                    <div className="layer-thumb" />
                    <span className="layer-title">{layer.name}</span>
                  </div>
                  {activeLayerId === layer.id && (
                    <div className="layer-settings">
                      <select className="blend-select" value={layer.blendMode || 'source-over'} onChange={(e) => updateLayer(layer.id, { blendMode: e.target.value as any })}>
                        <option value="source-over">Normal</option>
                        <option value="multiply">Multiply</option>
                        <option value="screen">Screen</option>
                        <option value="overlay">Overlay</option>
                      </select>
                      <div className="opacity-val">{Math.round(layer.opacity * 100)}%</div>
                    </div>
                  )}
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
    </div>
  );
};

export default App;

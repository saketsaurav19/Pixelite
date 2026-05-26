import React, { useState, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { ImportEngine } from '../../services/import/ImportEngine';
import { workerExportBridge } from '../../services/export/WorkerExportBridge';
import './MenuSystem.css';

interface MenuProps {
  onClose: () => void;
}

export const FileMenu: React.FC<MenuProps> = ({ onClose }) => {
  const {
    setIsNewDocumentDialogOpen,
    setIsExportDialogOpen,
    setIsFileInfoDialogOpen,
    layers,
    setLayers,
    documentSize,
    setDocumentSize,
    recordHistory
  } = useStore();

  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = async (e: React.ChangeEvent<HTMLInputElement>, isPlace: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await ImportEngine.importFile(file);

      if (result.type === 'psd') {
        const psdData = await workerExportBridge.parsePSD(result.psdData);
        // Scaffolding: In a real app, we map PSD layers back to our state.
        console.log("Parsed PSD in worker:", psdData);
        alert("PSD Parsing successful (see console). Rendering integration pending.");
      } else if (result.type === 'image' && result.dataUrl) {
         const isDefaultBackground = layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
         if (!isPlace && (layers.length === 0 || isDefaultBackground)) {
            setDocumentSize({ w: result.width, h: result.height });
            setLayers([{
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
             setLayers([...layers, {
                id: Math.random().toString(36).substring(7),
                name: result.name,
                type: 'image',
                dataUrl: result.dataUrl,
                position: { x: (documentSize.w - result.width) / 2, y: (documentSize.h - result.height) / 2 },
                visible: true,
                locked: false,
                opacity: 1,
                blendMode: 'source-over'
            }]);
         }
         recordHistory(isPlace ? `Place ${result.name}` : `Open ${result.name}`);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to open file.");
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = (isPlace: boolean) => {
      if (fileInputRef.current) {
          // hack to pass state to the change handler
          fileInputRef.current.dataset.isPlace = isPlace.toString();
          fileInputRef.current.click();
      }
      onClose();
  };

  const handleSavePSD = async () => {
      onClose();
      try {
        const buffer = await workerExportBridge.generatePSD(layers, documentSize.w, documentSize.h);
        const blob = new Blob([buffer.buffer], { type: 'application/x-photoshop' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.psd';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
          console.error(e);
          alert("Failed to generate PSD");
      }
  };

  return (
    <div className="menu-dropdown file-menu">
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*,.psd"
        onChange={(e) => handleOpen(e, fileInputRef.current?.dataset.isPlace === 'true')}
      />

      <div className="menu-item" onClick={() => { setIsNewDocumentDialogOpen(true); onClose(); }}>
        <span className="menu-label">New...</span>
        <span className="menu-shortcut">Alt+Ctrl+N</span>
      </div>

      <div className="menu-item" onClick={() => triggerFileInput(false)}>
        <span className="menu-label">Open...</span>
        <span className="menu-shortcut">Ctrl+O</span>
      </div>

      <div className="menu-item" onClick={() => triggerFileInput(true)}>
        <span className="menu-label">Open & Place...</span>
      </div>

      <div
        className="menu-item has-submenu"
        onMouseEnter={() => setActiveSubmenu('openMore')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <span className="menu-label">Open More</span>
        <LucideIcons.ChevronRight size={14} className="submenu-icon" />
        {activeSubmenu === 'openMore' && (
            <div className="submenu">
                <div className="menu-item disabled">Open Recent</div>
                <div className="menu-item disabled">Open from Cloud</div>
                <div className="menu-item disabled">Recover Autosave</div>
            </div>
        )}
      </div>

      <div className="menu-divider" />

      <div className="menu-item disabled">
        <span className="menu-label">Save</span>
        <span className="menu-shortcut">Ctrl+S</span>
      </div>

      <div className="menu-item" onClick={handleSavePSD}>
        <span className="menu-label">Save As PSD...</span>
      </div>

      <div className="menu-divider" />

      <div className="menu-item" onClick={() => { setIsExportDialogOpen(true); onClose(); }}>
        <span className="menu-label">Export As...</span>
      </div>

      <div className="menu-item disabled">
        <span className="menu-label">Export Layers...</span>
      </div>

      <div className="menu-divider" />

      <div className="menu-item" onClick={() => { setIsFileInfoDialogOpen(true); onClose(); }}>
        <span className="menu-label">File Info...</span>
      </div>

       <div className="menu-divider" />

       <div
        className="menu-item has-submenu"
        onMouseEnter={() => setActiveSubmenu('automate')}
        onMouseLeave={() => setActiveSubmenu(null)}
      >
        <span className="menu-label">Automate</span>
        <LucideIcons.ChevronRight size={14} className="submenu-icon" />
        {activeSubmenu === 'automate' && (
            <div className="submenu">
                <div className="menu-item disabled">Batch Processing</div>
                <div className="menu-item disabled">Watermarking</div>
            </div>
        )}
      </div>

      <div className="menu-item disabled">
        <span className="menu-label">Scripts...</span>
      </div>

    </div>
  );
};

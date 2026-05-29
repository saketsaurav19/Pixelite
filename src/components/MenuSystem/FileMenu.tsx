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
    addAlert,
    recordHistory,
    setIsMobileMenuOpen
  } = useStore();

  // Single active submenu key — null means all closed
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeMenus = () => {
    onClose();
    setIsMobileMenuOpen(false);
  };

  const handleOpen = async (e: React.ChangeEvent<HTMLInputElement>, isPlace: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) {
      closeMenus();
      return;
    }

    try {
      const result = await ImportEngine.importFile(file);

      if (result.type === 'psd') {
        const psdData = await workerExportBridge.parsePSD(result.psdData);
        console.log("Parsed PSD in worker:", psdData);
        addAlert({ type: 'success', message: 'PSD Parsing successful. Rendering integration pending.' });
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
      addAlert({ type: 'error', message: 'Failed to open file.' });
    } finally {
      closeMenus();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const triggerFileInput = (e: React.MouseEvent, isPlace: boolean) => {
      e.stopPropagation();
      if (fileInputRef.current) {
          fileInputRef.current.dataset.isPlace = isPlace.toString();
          fileInputRef.current.click();
      }
  };

  const handleSavePSD = async (e: React.MouseEvent) => {
      e.stopPropagation();
      closeMenus();
      try {
        const buffer = await workerExportBridge.generatePSD(layers, documentSize.w, documentSize.h);
        const blob = new Blob([buffer as unknown as BlobPart], { type: 'application/x-photoshop' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.psd';
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
          console.error(e);
          addAlert({ type: 'error', message: 'Failed to generate PSD.' });
      }
  };

  /**
   * Unified toggle: on mobile → accordion toggle; on desktop → hover is handled
   * purely by CSS (:hover on .has-submenu), so clicks just close the whole menu.
   */
  const handleSubmenuToggle = (e: React.MouseEvent, submenuName: string) => {
    e.stopPropagation();
    if (window.innerWidth <= 768) {
      setActiveSubmenu(prev => prev === submenuName ? null : submenuName);
    }
  };

  const handleMouseEnter = (submenuName: string) => {
    if (window.innerWidth > 768) {
      setActiveSubmenu(submenuName);
    }
  };

  const handleMouseLeave = () => {
    if (window.innerWidth > 768) {
      setActiveSubmenu(null);
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
        onClick={(e) => e.stopPropagation()}
      />

      <div className="menu-item" onClick={(e) => { e.stopPropagation(); setIsNewDocumentDialogOpen(true); closeMenus(); }}>
        <span className="menu-label">New...</span>
        <span className="menu-shortcut">Alt+Ctrl+N</span>
      </div>

      <div className="menu-item" onClick={(e) => triggerFileInput(e, false)}>
        <span className="menu-label">Open...</span>
        <span className="menu-shortcut">Ctrl+O</span>
      </div>

      <div className="menu-item" onClick={(e) => triggerFileInput(e, true)}>
        <span className="menu-label">Open & Place...</span>
      </div>

      <div
        className={`menu-item has-submenu ${activeSubmenu === 'openMore' ? 'submenu-active' : ''}`}
        onClick={(e) => handleSubmenuToggle(e, 'openMore')}
        onMouseEnter={() => handleMouseEnter('openMore')}
        onMouseLeave={handleMouseLeave}
      >
        <span className="menu-label">Open More</span>
        <LucideIcons.ChevronRight size={14} className={`submenu-icon ${activeSubmenu === 'openMore' ? 'rotated' : ''}`} />
        <div className={`submenu ${activeSubmenu === 'openMore' ? 'active' : ''}`}>
          <div className="menu-item disabled">Open Recent</div>
          <div className="menu-item disabled">Open from Cloud</div>
          <div className="menu-item disabled">Recover Autosave</div>
        </div>
      </div>

      <div className="menu-divider" />

      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Save</span>
        <span className="menu-shortcut">Ctrl+S</span>
      </div>

      <div className="menu-item" onClick={handleSavePSD}>
        <span className="menu-label">Save As PSD...</span>
      </div>

      <div className="menu-divider" />

      <div className="menu-item" onClick={(e) => { e.stopPropagation(); setIsExportDialogOpen(true); closeMenus(); }}>
        <span className="menu-label">Export As...</span>
      </div>

      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Export Layers...</span>
      </div>

      <div className="menu-divider" />

      <div className="menu-item" onClick={(e) => { e.stopPropagation(); setIsFileInfoDialogOpen(true); closeMenus(); }}>
        <span className="menu-label">File Info...</span>
      </div>

      <div className="menu-divider" />

      <div
        className={`menu-item has-submenu ${activeSubmenu === 'automate' ? 'submenu-active' : ''}`}
        onClick={(e) => handleSubmenuToggle(e, 'automate')}
        onMouseEnter={() => handleMouseEnter('automate')}
        onMouseLeave={handleMouseLeave}
      >
        <span className="menu-label">Automate</span>
        <LucideIcons.ChevronRight size={14} className={`submenu-icon ${activeSubmenu === 'automate' ? 'rotated' : ''}`} />
        <div className={`submenu ${activeSubmenu === 'automate' ? 'active' : ''}`}>
          <div className="menu-item disabled">Batch Processing</div>
          <div className="menu-item disabled">Watermarking</div>
        </div>
      </div>

      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Scripts...</span>
      </div>

    </div>
  );
};
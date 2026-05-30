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
    setIsOpenRecentDialogOpen,
    setIsOpenFromCloudDialogOpen,
    setIsExportDialogOpen,
    setExportFormat,
    setIsFileInfoDialogOpen,
    setIsCameraDialogOpen,
    layers,
    setLayers,
    documentSize,
    setDocumentSize,
    recordHistory,
    setIsMobileMenuOpen,
    setCurrentProjectId,
    setHistory
  } = useStore();

  // Track which submenu is open by name (null = all closed)
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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
        console.log('Parsed PSD in worker:', psdData);
        alert('PSD Parsing successful (see console). Rendering integration pending.');
      } else if (result.type === 'image' && result.dataUrl) {
        const isDefaultBackground =
          layers.length === 1 && layers[0].name === 'Background' && layers[0].type === 'paint';
        if (!isPlace) {
          setCurrentProjectId(null);
          setHistory([], 0);
        }

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
            position: {
              x: (documentSize.w - result.width) / 2,
              y: (documentSize.h - result.height) / 2
            },
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
      alert('Failed to open file.');
    } finally {
      closeMenus();
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleTakePicture = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Simple device detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // On mobile, trigger the hidden file input with capture="environment"
      if (cameraInputRef.current) {
        cameraInputRef.current.click();
      }
    } else {
      // On desktop, fallback to custom CameraDialog
      setIsCameraDialogOpen(true);
    }

    closeMenus();
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

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: 'project.psd',
            types: [{
              description: 'Photoshop Document',
              accept: { 'application/x-photoshop': ['.psd'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (err: any) {
          if (err.name !== 'AbortError') {
            console.error(err);
            alert('Failed to save PSD');
          }
        }
      } else {
        let fileName = prompt('Enter file name:', 'project.psd');
        if (fileName) {
          if (!fileName.toLowerCase().endsWith('.psd')) {
            fileName += '.psd';
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to generate PSD');
    }
  };

  /**
   * Toggle a named submenu.
   * On mobile  → accordion toggle (open/close).
   * On desktop → CSS :hover handles it; clicks just close the whole menu.
   */
  const toggleSubmenu = (e: React.MouseEvent, submenuName: string) => {
    e.stopPropagation();
    if (window.innerWidth > 768) return; // desktop uses CSS hover
    setActiveSubmenu((prev) => (prev === submenuName ? null : submenuName));
  };

  return (
    <div className="menu-dropdown file-menu">
      <input
        type="file"
        ref={cameraInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const dataUrl = event.target?.result as string;
              useStore.getState().setMobileCapturedImage(dataUrl);
            };
            reader.readAsDataURL(file);
          }
        }}
        onClick={(e) => e.stopPropagation()}
      />

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/*,.psd,.heic,.heif"
        onChange={(e) => handleOpen(e, fileInputRef.current?.dataset.isPlace === 'true')}
        onClick={(e) => e.stopPropagation()}
      />

      {/* ── New ── */}
      <div
        className="menu-item"
        onClick={(e) => {
          e.stopPropagation();
          setIsNewDocumentDialogOpen(true);
          closeMenus();
        }}
      >
        <span className="menu-label">New...</span>
        <span className="menu-shortcut">Alt+Ctrl+N</span>
      </div>

      {/* ── Open ── */}
      <div className="menu-item" onClick={(e) => triggerFileInput(e, false)}>
        <span className="menu-label">Open...</span>
        <span className="menu-shortcut">Ctrl+O</span>
      </div>

      {/* ── Open & Place ── */}
      <div className="menu-item" onClick={(e) => triggerFileInput(e, true)}>
        <span className="menu-label">Open &amp; Place...</span>
      </div>

      {/* ── Open More (submenu) ── */}
      <div
        className={`menu-item has-submenu ${activeSubmenu === 'openMore' ? 'submenu-active' : ''}`}
        onClick={(e) => toggleSubmenu(e, 'openMore')}
      >
        <span className="menu-label">Open More</span>
        <LucideIcons.ChevronRight
          size={14}
          className={`submenu-icon ${activeSubmenu === 'openMore' ? 'rotated' : ''}`}
        />
        <div className={`submenu ${activeSubmenu === 'openMore' ? 'active' : ''}`}>
          <div
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpenRecentDialogOpen(true);
              closeMenus();
            }}
          >
            Open Recent
          </div>
          <div className="menu-item" onClick={handleTakePicture}>Take Picture</div>
          <div
            className="menu-item"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpenFromCloudDialogOpen(true);
              closeMenus();
            }}
          >
            Open from Cloud
          </div>
        </div>
      </div>

      <div className="menu-divider" />

      {/* ── Save (disabled) ── */}
      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Save</span>
        <span className="menu-shortcut">Ctrl+S</span>
      </div>

      {/* ── Save As PSD ── */}
      <div className="menu-item" onClick={handleSavePSD}>
        <span className="menu-label">Save As PSD...</span>
      </div>

      <div className="menu-divider" />

      {/* ── Export As ── */}
      <div
        className={`menu-item has-submenu ${activeSubmenu === 'exportAs' ? 'submenu-active' : ''}`}
        onClick={(e) => toggleSubmenu(e, 'exportAs')}
      >
        <span className="menu-label">Export As...</span>
        <LucideIcons.ChevronRight
          size={14}
          className={`submenu-icon ${activeSubmenu === 'exportAs' ? 'rotated' : ''}`}
        />
        <div className={`submenu ${activeSubmenu === 'exportAs' ? 'active' : ''}`}>
          {[
            { label: 'PNG', format: 'image/png' },
            { label: 'JPG', format: 'image/jpeg' },
            { label: 'WEBP', format: 'image/webp' },
            { label: 'SVG', format: 'image/svg+xml' },
            { label: 'GIF', format: 'image/gif' },
            { label: 'PDF', format: 'application/pdf' },
          ].map((item) => (
            <div
              key={item.format}
              className="menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setExportFormat(item.format as any);
                setIsExportDialogOpen(true);
                closeMenus();
              }}
            >
              {item.label}
            </div>
          ))}
          <div className="menu-divider" />
          <div className="menu-item disabled">More...</div>
        </div>
      </div>

      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Export Layers...</span>
      </div>

      <div className="menu-divider" />

      {/* ── File Info ── */}
      <div
        className="menu-item"
        onClick={(e) => {
          e.stopPropagation();
          setIsFileInfoDialogOpen(true);
          closeMenus();
        }}
      >
        <span className="menu-label">File Info...</span>
      </div>

      <div className="menu-divider" />

      {/* ── Automate (submenu) ── */}
      <div
        className={`menu-item has-submenu ${activeSubmenu === 'automate' ? 'submenu-active' : ''}`}
        onClick={(e) => toggleSubmenu(e, 'automate')}
      >
        <span className="menu-label">Automate</span>
        <LucideIcons.ChevronRight
          size={14}
          className={`submenu-icon ${activeSubmenu === 'automate' ? 'rotated' : ''}`}
        />
        <div className={`submenu ${activeSubmenu === 'automate' ? 'active' : ''}`}>
          <div className="menu-item disabled">Batch Processing</div>
          <div className="menu-item disabled">Watermarking</div>
        </div>
      </div>

      {/* ── Scripts ── */}
      <div className="menu-item disabled" onClick={(e) => e.stopPropagation()}>
        <span className="menu-label">Scripts...</span>
      </div>
    </div>
  );
};

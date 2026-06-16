import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import './MenuBar.css';
import { useStore } from '../../store/useStore';

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  subItems?: MenuItem[];
  divider?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

interface MenuSection {
  label: string;
  items: MenuItem[];
}

interface MenuBarProps {
  onFileOpen?: () => void;
  onPlaceFile?: () => void;
  onSave?: (asNew: boolean) => void;
  undo?: () => void;
  redo?: () => void;
  historyIndex: number;
  historyLength: number;
  canUndo: boolean;
  canRedo: boolean;
  onInvert?: () => void;
  onDuplicateLayer?: () => void;
  onDeleteLayer?: () => void;
  onFillLayer?: () => void;
  onSelectSubject?: () => void;
  onRemoveBackground?: () => void;
  onInverseSelection?: () => void;
  onNewDocument?: () => void;
  onExport?: (format: string) => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onTransformLayer?: (type: string) => void;
  onCanvasSize?: () => void;
  onImageSize?: () => void;
  onAddEmptyLayer?: () => void;
  onSelectAll?: () => void;
  onDeselect?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomFit?: () => void;
  onToggleRulers?: () => void;
  onToggleGrid?: () => void;
  onToggleGuides?: () => void;
  onOpenURL?: () => void;
  onTakeSnapshot?: () => void;
  onPrint?: () => void;
  onScript?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSaveToStorage?: (provider: string) => void;
  onSaveToPublic?: (service: string) => void;
}

const MenuBar: React.FC<MenuBarProps> = ({
  onFileOpen,
  onPlaceFile,
  onSave,
  undo,
  redo,
  canUndo,
  canRedo,
  onInvert,
  onDuplicateLayer,
  onDeleteLayer,
  onFillLayer,
  onSelectSubject,
  onRemoveBackground,
  onInverseSelection,
  onNewDocument,
  onExport,
  onCut,
  onCopy,
  onPaste,
  onTransformLayer,
  onCanvasSize,
  onImageSize,
  onAddEmptyLayer,
  onSelectAll,
  onDeselect,
  onZoomIn,
  onZoomOut,
  onZoomFit,
  onToggleRulers,
  onToggleGrid,
  onToggleGuides,
  onOpenURL,
  onTakeSnapshot,
  onPrint,
  onScript,
  isMobileOpen,
  onCloseMobile,
  onSaveToStorage,
  onSaveToPublic
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const visiblePanels = useStore((s) => s.visiblePanels);
  const togglePanel = useStore((s) => s.togglePanel);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menuData: MenuSection[] = [
    {
      label: 'File',
      items: [
        { label: 'New...', shortcut: 'Ctrl+N', action: onNewDocument },
        { label: 'Open...', shortcut: 'Ctrl+O', action: onFileOpen },
        {
          label: 'Open More',
          subItems: [
            { label: 'From Storage...', shortcut: 'Alt+Ctrl+O' },
            { label: 'Open from URL...', action: onOpenURL },
            { label: 'Take a picture...', action: onTakeSnapshot },
            { label: 'PSD Templates...' },
            { label: 'Import from Figma (PSD/SVG)...' },
            { label: 'Sample files' },
          ]
        },
        { label: 'Open and Place...', action: onPlaceFile },
        { label: 'Open Recent', disabled: true },
        { divider: true },
        {
          label: 'Share',
          subItems: [
            { label: 'PNG', action: () => onExport?.('png') },
            { label: 'JPG', action: () => onExport?.('jpg') },
          ]
        },
        { divider: true },
        { label: 'Save', shortcut: 'Ctrl+S', action: () => onSave?.(false) },
        { label: 'Save as PSD', action: () => onExport?.('psd') },
        {
          label: 'Save More',
          subItems: [
            {
              label: 'Save to Storage',
              subItems: [
                { label: 'Google Drive', action: () => onSaveToStorage?.('google_drive') },
                { label: 'Dropbox', action: () => onSaveToStorage?.('dropbox') },
                { label: 'OneDrive', action: () => onSaveToStorage?.('onedrive') },
              ]
            },
            {
              label: 'Save (Public)',
              subItems: [
                { label: 'Imgur', action: () => onSaveToPublic?.('imgur') },
                { label: 'ImageBB', action: () => onSaveToPublic?.('imagebb') },
                { label: 'PostImages', action: () => onSaveToPublic?.('postimages') },
              ]
            },
          ]
        },
        {
          label: 'Export as',
          subItems: [
            { label: 'PNG', action: () => onExport?.('png') },
            { label: 'JPG', action: () => onExport?.('jpg') },
            { label: 'SVG', action: () => onExport?.('svg') },
            { label: 'WEBP', action: () => onExport?.('webp') },
            { label: 'TIFF', action: () => onExport?.('tiff') },
            { label: 'BMP', action: () => onExport?.('bmp') },
            { label: 'GIF', action: () => onExport?.('gif') },
            { label: 'PDF', action: () => onExport?.('pdf') },
            { label: 'More...' },
          ]
        },
        { divider: true },
        { label: 'Print...', shortcut: 'Ctrl+P', action: onPrint },
        { label: 'Export Layers...' },
        { label: 'Export Color Lookup...' },
        { label: 'File Info...' },
        { divider: true },
        {
          label: 'Automate',
          subItems: [
            { label: 'Batch Processing...' },
            { label: 'Script...', action: onScript },
          ]
        },
        { label: 'Script...', action: onScript },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },
        { label: 'Redo', shortcut: 'Ctrl+Y', action: redo, disabled: !canRedo },
        { divider: true },
        { label: 'Step Forward', shortcut: 'Shift+Ctrl+Z', action: redo, disabled: !canRedo },
        { label: 'Step Backward', shortcut: 'Ctrl+Z', action: undo, disabled: !canUndo },

        { label: 'Fade...', shortcut: 'Shift+Ctrl+F' },
        { divider: true },
        { label: 'Cut', shortcut: 'Ctrl+X', action: onCut },
        { label: 'Copy', shortcut: 'Ctrl+C', action: onCopy },
        { label: 'Paste', shortcut: 'Ctrl+V', action: onPaste },
        { divider: true },
        { label: 'Fill...', action: onFillLayer },
        { label: 'Stroke...' },
        { divider: true },
        { label: 'Free Transform', shortcut: 'Alt+Ctrl+T' },
        {
          label: 'Transform',
          subItems: [
            { label: 'Scale' },
            { label: 'Rotate' },
            { label: 'Skew' },
            { label: 'Distort' },
            { label: 'Perspective' },
            { label: 'Warp' },
            { label: 'Rotate 180°', action: () => onTransformLayer?.('rotate180') },
            { label: 'Rotate 90° Clockwise', action: () => onTransformLayer?.('rotate90CW') },
            { label: 'Rotate 90° Counter Clockwise', action: () => onTransformLayer?.('rotate90CCW') },
            { divider: true },
            { label: 'Flip Horizontally', action: () => onTransformLayer?.('flipH') },
            { label: 'Flip Vertically', action: () => onTransformLayer?.('flipV') },
          ]
        },
        { divider: true },
        { label: 'Auto-Align' },
        { label: 'Auto-Blend' },
        { divider: true },
        {
          label: 'Define New',
          subItems: [
            { label: 'Brush' },
            { label: 'Pattern' },
            { label: 'Custom Shape' },
          ]
        },
        { divider: true },
        { label: 'Preferences...', shortcut: 'Ctrl+K' },
      ]
    },
    {
      label: 'Image',
      items: [
        {
          label: 'Mode',
          subItems: [
            { label: 'Grayscale' },
            { label: 'RGB' },
            { label: 'Indexed' },
            { divider: true },
            { label: '8 Bits/Channel' },
            { label: '16 Bits/Channel' },
            { label: '32 Bits/Channel' },
          ]
        },
        {
          label: 'Adjustments',
          subItems: [
            { label: 'Brightness/Contrast...' },
            { label: 'Levels...', shortcut: 'Ctrl+L' },
            { label: 'Curves...', shortcut: 'Ctrl+M' },
            { label: 'Exposure...' },
            { divider: true },
            { label: 'Vibrance...' },
            { label: 'Hue/Saturation...', shortcut: 'Ctrl+U' },
            { label: 'Color Balance...', shortcut: 'Ctrl+B' },
            { label: 'Black & White...', shortcut: 'Alt+Shift+Ctrl+B' },
            { label: 'Photo Filter...' },
            { label: 'Channel Mixer...' },
            { label: 'Color Lookup...' },
            { divider: true },
            { label: 'Invert', shortcut: 'Ctrl+I', action: onInvert },
            { label: 'Posterize...' },
            { label: 'Threshold...' },
            { label: 'Gradient Map...' },
            { label: 'Selective Color...' },
            { divider: true },
            { label: 'Replace Color...' },
            { label: 'Equalize' },
          ]
        },
        { divider: true },
        { label: 'Auto Tone' },
        { label: 'Auto Contrast' },
        { label: 'Auto Color' },
        { divider: true },
        { label: 'Canvas Size...', action: onCanvasSize },
        { label: 'Image Size...', action: onImageSize },
        { divider: true },
        {
          label: 'Transform',
          subItems: [
            { label: 'Rotate 180°', action: () => onTransformLayer?.('rotate180') },
            { label: 'Rotate 90° Clockwise', action: () => onTransformLayer?.('rotate90CW') },
            { label: 'Rotate 90° Counter Clockwise', action: () => onTransformLayer?.('rotate90CCW') },
            { divider: true },
            { label: 'Flip Horizontally', action: () => onTransformLayer?.('flipH') },
            { label: 'Flip Vertically', action: () => onTransformLayer?.('flipV') },
          ]
        },
        { divider: true },
        { label: 'Crop' },
        { label: 'Trim...' },
        { label: 'Reveal All' },
        { divider: true },
        { label: 'Duplicate' },
        { label: 'Apply Image...' },
      ]
    },
    {
      label: 'Layer',
      items: [
        {
          label: 'New',
          subItems: [
            { label: 'Layer', shortcut: 'Shift+Ctrl+N', action: onAddEmptyLayer },
            { label: 'Layer via Copy', shortcut: 'Ctrl+J', action: onDuplicateLayer },
            { label: 'Layer via Cut', shortcut: 'Shift+Ctrl+J' },
            { label: 'Folder' },
          ]
        },
        { label: 'Duplicate Layer', shortcut: 'Ctrl+J', action: onDuplicateLayer },
        { label: 'Delete Layer', shortcut: 'Del', action: onDeleteLayer },
        { divider: true },
        {
          label: 'Layer Style',
          subItems: [
            { label: 'Blending Options...' },
            { divider: true },
            { label: 'Drop Shadow...' },
            { label: 'Inner Shadow...' },
            { label: 'Outer Glow...' },
            { label: 'Inner Glow...' },
            { label: 'Bevel and Emboss...' },
            { label: 'Satin...' },
            { label: 'Color Overlay...' },
            { label: 'Gradient Overlay...' },
            { label: 'Pattern Overlay...' },
            { label: 'Stroke...' },
            { divider: true },
            { label: 'Copy Layer Style' },
            { label: 'Paste Layer Style' },
            { label: 'Clear Layer Style' },
          ]
        },
        {
          label: 'New Fill Layer',
          subItems: [
            { label: 'Color Fill...', action: onFillLayer },
            { label: 'Gradient Fill...' },
            { label: 'Pattern Fill...' },
          ]
        },
        {
          label: 'New Adjustment Layer',
          subItems: [
            { label: 'Brightness/Contrast...' },
            { label: 'Levels...' },
            { label: 'Curves...' },
            { label: 'Exposure...' },
            { label: 'Vibrance...' },
            { label: 'Hue/Saturation...' },
            { label: 'Color Balance...' },
            { label: 'Black & White...' },
            { label: 'Photo Filter...' },
            { label: 'Channel Mixer...' },
            { label: 'Color Lookup...' },
            { label: 'Invert' },
            { label: 'Posterize...' },
            { label: 'Threshold...' },
            { label: 'Gradient Map...' },
            { label: 'Selective Color...' },
          ]
        },
        { divider: true },
        {
          label: 'Raster Mask',
          subItems: [
            { label: 'Reveal All' },
            { label: 'Hide All' },
          ]
        },
        {
          label: 'Vector Mask',
          subItems: [
            { label: 'Reveal All' },
            { label: 'Hide All' },
          ]
        },
        { divider: true },
        {
          label: 'Smart Object',
          subItems: [
            { label: 'Convert to Smart Object' },
            { label: 'Relink to File...' },
            { label: 'Replace Content...' },
            { label: 'Export Contents...' },
          ]
        },
        { divider: true },
        { label: 'Group Layers', shortcut: 'Ctrl+G' },
        { label: 'Ungroup Layers', shortcut: 'Shift+Ctrl+G' },
        { divider: true },
        {
          label: 'Arrange',
          subItems: [
            { label: 'Bring to Front', shortcut: 'Shift+Ctrl+]' },
            { label: 'Bring Forward', shortcut: 'Ctrl+]' },
            { label: 'Send Backward', shortcut: 'Ctrl+[' },
            { label: 'Send to Back', shortcut: 'Shift+Ctrl+[' },
          ]
        },
        { divider: true },
        { label: 'Merge Layers', shortcut: 'Ctrl+E' },
        { label: 'Merge Visible', shortcut: 'Shift+Ctrl+E' },
        { label: 'Flatten Image' },
      ]
    },
    {
      label: 'Select',
      items: [
        { label: 'All', shortcut: 'Ctrl+A', action: onSelectAll },
        { label: 'Deselect', shortcut: 'Ctrl+D', action: onDeselect },
        { label: 'Inverse', shortcut: 'Shift+Ctrl+I', action: onInverseSelection },
        { divider: true },
        { label: 'Color Range...' },
        { label: 'Magic Cut...' },
        { label: 'Select Subject', action: onSelectSubject },
        { label: 'Remove BG', action: onRemoveBackground },
        { divider: true },
        { label: 'Refine Edge...', shortcut: 'Alt+Ctrl+R' },
        {
          label: 'Modify',
          subItems: [
            { label: 'Border...' },
            { label: 'Smooth...' },
            { label: 'Expand...' },
            { label: 'Contract...' },
            { label: 'Feather...', shortcut: 'Shift+F6' },
          ]
        },
        { divider: true },
        { label: 'Transform Selection' },
      ]
    },
    {
      label: 'Filter',
      items: [
        { label: 'Last Filter', shortcut: 'Alt+Ctrl+F' },
        { divider: true },
        { label: 'Filter Gallery...' },
        { label: 'Camera Raw...', shortcut: 'Shift+Ctrl+A' },
        { label: 'Lens Correction...', shortcut: 'Shift+Ctrl+R' },
        { label: 'Liquify...', shortcut: 'Shift+Ctrl+X' },
        { label: 'Vanishing Point...', shortcut: 'Alt+Ctrl+V' },
        { divider: true },
        {
          label: 'Blur',
          subItems: [
            { label: 'Average' },
            { label: 'Blur' },
            { label: 'Blur More' },
            { label: 'Box Blur...' },
            { label: 'Gaussian Blur...' },
            { label: 'Lens Blur...' },
            { label: 'Motion Blur...' },
            { label: 'Radial Blur...' },
            { label: 'Surface Blur...' },
          ]
        },
        {
          label: 'Distort',
          subItems: [
            { label: 'Diffuse Glow...' },
            { label: 'Displace...' },
            { label: 'Glass...' },
            { label: 'Ocean Ripple...' },
            { label: 'Pinch...' },
            { label: 'Polar Coordinates...' },
            { label: 'Ripple...' },
            { label: 'Shear...' },
            { label: 'Spherize...' },
            { label: 'Twirl...' },
            { label: 'Wave...' },
            { label: 'ZigZag...' },
          ]
        },
        {
          label: 'Noise',
          subItems: [
            { label: 'Add Noise...' },
            { label: 'Despeckle' },
            { label: 'Dust & Scratches...' },
            { label: 'Median...' },
            { label: 'Reduce Noise...' },
          ]
        },
        {
          label: 'Pixelate',
          subItems: [
            { label: 'Color Halftone...' },
            { label: 'Crystallize...' },
            { label: 'Facet' },
            { label: 'Fragment' },
            { label: 'Mezzotint...' },
            { label: 'Mosaic...' },
            { label: 'Pointillize...' },
          ]
        },
        {
          label: 'Render',
          subItems: [
            { label: 'Clouds' },
            { label: 'Difference Clouds' },
            { label: 'Fibers...' },
            { label: 'Lens Flare...' },
            { label: 'Lighting Effects...' },
          ]
        },
        {
          label: 'Sharpen',
          subItems: [
            { label: 'Sharpen' },
            { label: 'Sharpen Edges' },
            { label: 'Sharpen More' },
            { label: 'Smart Sharpen...' },
            { label: 'Unsharp Mask...' },
          ]
        },
        {
          label: 'Stylize',
          subItems: [
            { label: 'Diffuse...' },
            { label: 'Emboss...' },
            { label: 'Extrude...' },
            { label: 'Find Edges' },
            { label: 'Glowing Edges...' },
            { label: 'Solarize' },
            { label: 'Tiles...' },
            { label: 'Trace Contour...' },
            { label: 'Wind...' },
          ]
        },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', shortcut: 'Ctrl++', action: onZoomIn },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: onZoomOut },
        { label: 'Fit Area', shortcut: 'Ctrl+0', action: onZoomFit },
        { label: 'Pixel to Pixel', shortcut: 'Ctrl+1' },
        { divider: true },
        {
          label: 'Screen Mode',
          subItems: [
            { label: 'Standard' },
            { label: 'Full Screen' },
          ]
        },
        { divider: true },
        {
          label: 'Show',
          subItems: [
            { label: 'Grid', action: onToggleGrid },
            { label: 'Guides', action: onToggleGuides },
            { label: 'Slices' },
          ]
        },
        { divider: true },
        { label: 'Rulers', shortcut: 'Ctrl+R', action: onToggleRulers },
        { label: 'Snap', shortcut: 'Ctrl+;' },
      ]
    },
    {
      label: 'Window',
      items: [
        { label: 'Arrange' },
        { divider: true },
        { label: 'Adjustments', checked: visiblePanels.adjustments, action: () => togglePanel('adjustments') },
        { label: 'Channels', checked: visiblePanels.channels, action: () => togglePanel('channels') },
        { label: 'History', checked: visiblePanels.history, action: () => togglePanel('history') },
        { label: 'Layers', checked: visiblePanels.layers, action: () => togglePanel('layers') },
        { label: 'Paths', checked: visiblePanels.paths, action: () => togglePanel('paths') },
        { label: 'Swatches', checked: visiblePanels.swatches, action: () => togglePanel('swatches') },
      ]
    },
    {
      label: 'More',
      items: [
        { label: 'Language' },
        { label: 'Theme' },
        { divider: true },
        { label: 'Keyboard Shortcuts' },
        { label: 'Search' },
        { label: 'Help' },
        { label: 'About' },
      ]
    }
  ];

  const renderMenuItem = (item: MenuItem, index: number, parentLabel?: string) => {
    if (item.divider) {
      return <div key={`div-${index}-${parentLabel}`} className="menu-divider" />;
    }

    const isSubmenuActive = activeSubmenu === `${parentLabel}-${item.label}`;

    return (
      <div
        key={`${parentLabel}-${item.label}-${index}`}
        className={`menu-option ${item.subItems ? 'submenu-parent' : ''} ${isSubmenuActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
        onClick={(e) => {
          if (item.disabled) {
            e.stopPropagation();
            return;
          }
          if (item.subItems) {
            e.stopPropagation();
            setActiveSubmenu(isSubmenuActive ? null : `${parentLabel}-${item.label}`);
          } else if (item.action) {
            e.stopPropagation();
            item.action();
            setActiveMenu(null);
            setActiveSubmenu(null);
            onCloseMobile?.();
          }
        }}
        onMouseEnter={() => {
          if (window.innerWidth > 768 && item.subItems && !item.disabled) {
            setActiveSubmenu(`${parentLabel}-${item.label}`);
          }
        }}
      >
        <div className="menu-option-content">
          <span className="menu-option-check">{item.checked ? '✓' : ''}</span>
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
        </div>
        {item.subItems && <LucideIcons.ChevronRight size={12} className="submenu-arrow" />}
        {item.subItems && (
          <div className="menu-submenu">
            {item.subItems.map((subItem, subIndex) => renderMenuItem(subItem, subIndex, `${parentLabel}-${item.label}`))}
          </div>
        )}
      </div>
    );
  };

  return (
    <nav className={`menubar ${isMobileOpen ? 'mobile-open' : ''}`} ref={menuRef}>
      {isMobileOpen && (
        <div className="mobile-menu-header">
          <span>Menu</span>
          <button onClick={onCloseMobile}><LucideIcons.X size={20} /></button>
        </div>
      )}
      <div className="menu-items-wrapper">
        {menuData.map((section) => (
          <div
            key={section.label}
            className={`menu-item-container ${activeMenu === section.label ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu(activeMenu === section.label ? null : section.label);
              setActiveSubmenu(null);
            }}
            onMouseEnter={() => {
              if (window.innerWidth > 768 && activeMenu) {
                setActiveMenu(section.label);
                setActiveSubmenu(null);
              }
            }}
          >
            <span>{section.label}</span>
            {(activeMenu === section.label || (isMobileOpen && activeMenu === section.label)) && (
              <div className="menu-dropdown">
                {section.items.map((item, index) => renderMenuItem(item, index, section.label))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
};


export default MenuBar;

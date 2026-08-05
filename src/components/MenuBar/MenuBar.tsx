import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import './MenuBar.css';
import { useStore } from '../../store/useStore';
import { pasteFromClipboard } from '../../utils/clipboardUtils';

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
  onOpenExportDialog?: (format?: string) => void;
  onCut?: () => void;
  onCopy?: () => void;
  onPaste?: () => void;
  onTransformLayer?: (type: string) => void;
  onTransformImage?: (type: string) => void;
  onTransformMode?: (mode: 'free' | 'scale' | 'rotate' | 'skew' | 'distort' | 'perspective' | 'warp') => void;
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
  onDefineBrush?: () => void;
  onDefinePattern?: () => void;
  onDefineCustomShape?: () => void;
  onAssignProfile?: (profile: string) => void;
  onConvertToProfile?: (profile: string) => void;
  onPreferences?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onSaveToStorage?: (provider: string) => void;
  onSaveToPublic?: (service: string) => void;
  onGrayscale?: () => void;
  onConvertToRGB?: () => void;
  onConvertToCMYK?: () => void;
  onConvertToIndexed?: () => void;
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
  onOpenExportDialog,
  onCut,
  onCopy,
  onPaste,
  onTransformLayer,
  onTransformImage,
  onTransformMode,
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
  onDefineBrush,
  onDefinePattern,
  onDefineCustomShape,
  onAssignProfile,
  onConvertToProfile,
  onPreferences,
  isMobileOpen,
  onCloseMobile,
  onSaveToStorage,
  onSaveToPublic,
  onGrayscale,
  onConvertToRGB,
  onConvertToCMYK,
  onConvertToIndexed,
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubmenus, setActiveSubmenus] = useState<Record<string, boolean>>({});
  const menuRef = useRef<HTMLDivElement>(null);
  const visiblePanels = useStore((s) => s.visiblePanels);
  const togglePanel = useStore((s) => s.togglePanel);
  const addAdjustmentLayer = useStore((s) => s.addAdjustmentLayer);
  const layers = useStore((s) => s.layers);
  const activeLayerId = useStore((s) => s.activeLayerId);
  const autoAlignLayers = useStore((s) => s.autoAlignLayers);
  const autoBlendLayers = useStore((s) => s.autoBlendLayers);
  const autoTone = useStore((s) => s.autoTone);
  const autoContrast = useStore((s) => s.autoContrast);
  const autoColor = useStore((s) => s.autoColor);
  const colorMode = useStore((s) => s.colorMode);
  const clipboardDataUrl = useStore((s) => s.clipboardDataUrl);
  const clipboardLayer = useStore((s) => s.clipboardLayer);
  const selectionRect = useStore((s) => s.selectionRect);
  const addAlert = useStore((s) => s.addAlert);
  const setIsContentAwareScaleDialogOpen = useStore((s) => s.setIsContentAwareScaleDialogOpen);
  const applyFilterAction = useStore((s) => s.applyFilterAction);
  const shortcuts = useStore((s) => s.shortcuts || {});

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVector = activeLayer && (activeLayer.type === 'text' || activeLayer.type === 'shape');


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
        { label: 'New...', shortcut: shortcuts.file_new || 'Ctrl+N', action: onNewDocument },
        { label: 'Open...', shortcut: shortcuts.file_open || 'Ctrl+O', action: onFileOpen },
        {
          label: 'Open More',
          subItems: [
            { label: 'From Storage...', shortcut: 'Alt+Ctrl+O' },
            { label: 'Open from URL...', action: onOpenURL },
            { label: 'Take a picture...', action: onTakeSnapshot },
            { label: 'Recent Projects', action: () => useStore.getState().setIsOpenRecentDialogOpen(true) },
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
            { label: 'Share Canvas Link (URL)...', action: () => useStore.getState().setIsServerlessShareDialogOpen(true, 'url') },
            { label: 'Live Collaboration (P2P WebRTC)...', action: () => useStore.getState().setIsServerlessShareDialogOpen(true, 'webrtc') },
            { label: 'Public Host / OS Share...', action: () => useStore.getState().setIsServerlessShareDialogOpen(true, 'public') },
            { divider: true },
            { label: 'Export PNG', action: () => onOpenExportDialog?.('png') },
            { label: 'Export JPG', action: () => onOpenExportDialog?.('jpg') },
          ]
        },
        { divider: true },
        { label: 'Save', shortcut: shortcuts.file_save || 'Ctrl+S', action: () => onSave?.(false) },
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
        { label: 'Export...', action: () => onOpenExportDialog?.() },
        { divider: true },
        {
          label: 'Export as',
          subItems: [
            { label: 'PNG', action: () => onOpenExportDialog?.('png') },
            { label: 'JPG', action: () => onOpenExportDialog?.('jpg') },
            { label: 'SVG', action: () => onOpenExportDialog?.('svg') },
            { label: 'WEBP', action: () => onOpenExportDialog?.('webp') },
            { label: 'TIFF', action: () => onOpenExportDialog?.('tiff') },
            { label: 'BMP', action: () => onOpenExportDialog?.('bmp') },
            { label: 'GIF', action: () => onOpenExportDialog?.('gif') },
            { label: 'PDF', action: () => onOpenExportDialog?.('pdf') },
            { label: 'More...' },
          ]
        },
        { divider: true },
        { label: 'Print...', shortcut: shortcuts.file_print || 'Ctrl+P', action: onPrint },
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
        { label: 'Undo', shortcut: shortcuts.edit_undo || 'Ctrl+Z', action: undo, disabled: !canUndo },
        { label: 'Redo', shortcut: shortcuts.edit_redo || 'Shift+Ctrl+Z', action: redo, disabled: !canRedo },
        { divider: true },
        { label: 'Fade...', shortcut: 'Shift+Ctrl+F' },
        { divider: true },
        { label: 'Cut', shortcut: shortcuts.edit_cut || 'Ctrl+X', action: onCut },
        { label: 'Copy', shortcut: shortcuts.edit_copy || 'Ctrl+C', action: onCopy },
        { label: 'Paste', shortcut: shortcuts.edit_paste || 'Ctrl+V', action: onPaste },
        {
          label: 'Paste Special',
          subItems: [
            { label: 'Paste in Place', action: () => pasteFromClipboard(useStore.getState(), 'in_place'), disabled: !clipboardDataUrl && !clipboardLayer },
            { label: 'Paste Into', action: () => pasteFromClipboard(useStore.getState(), 'into'), disabled: (!clipboardDataUrl && !clipboardLayer) || !selectionRect },
            { label: 'Paste Outside', action: () => pasteFromClipboard(useStore.getState(), 'outside'), disabled: (!clipboardDataUrl && !clipboardLayer) || !selectionRect },
          ]
        },
        { divider: true },
        { label: 'Fill...', action: onFillLayer },
        { label: 'Stroke...' },
        { divider: true },
        { label: 'Free Transform', shortcut: shortcuts.edit_free_transform || 'Ctrl+T', action: () => onTransformMode?.('free') },
        { label: 'Content-Aware Scale', action: () => setIsContentAwareScaleDialogOpen(true) },
        { label: 'Puppet Warp', action: () => addAlert({ type: 'info', message: 'Puppet Warp is not implemented.' }) },
        {
          label: 'Transform',
          subItems: [
            { label: 'Scale', action: () => onTransformMode?.('scale') },
            { label: 'Rotate', action: () => onTransformMode?.('rotate') },
            { label: 'Skew', action: () => onTransformMode?.('skew') },
            { label: 'Distort', action: () => onTransformMode?.('distort'), disabled: !!isVector },
            { label: 'Perspective', action: () => onTransformMode?.('perspective'), disabled: !!isVector },
            { label: 'Warp', action: () => onTransformMode?.('warp'), disabled: !!isVector },
            { label: 'Rotate 180°', action: () => onTransformLayer?.('rotate180') },
            { label: 'Rotate 90° Clockwise', action: () => onTransformLayer?.('rotate90CW') },
            { label: 'Rotate 90° Counter Clockwise', action: () => onTransformLayer?.('rotate90CCW') },
            { divider: true },
            { label: 'Flip Horizontally', action: () => onTransformLayer?.('flipH') },
            { label: 'Flip Vertically', action: () => onTransformLayer?.('flipV') },
          ]
        },
        { divider: true },
        { label: 'Auto-Align', action: autoAlignLayers },
        { label: 'Auto-Blend', action: autoBlendLayers },
        { divider: true },
        {
          label: 'Define New',
          subItems: [
            { label: 'Brush', action: onDefineBrush },
            { label: 'Pattern', action: onDefinePattern },
            { label: 'Custom Shape', action: onDefineCustomShape },
          ]
        },
        { divider: true },
        {
          label: 'Assign Profile',
          subItems: [
            { label: 'sRGB IEC61966-2.1', action: () => onAssignProfile?.('sRGB IEC61966-2.1') },
            { label: 'Adobe RGB (1998)', action: () => onAssignProfile?.('Adobe RGB (1998)') },
            { label: 'Display P3', action: () => onAssignProfile?.('Display P3') },
            { label: 'ProPhoto RGB', action: () => onAssignProfile?.('ProPhoto RGB') },
            { label: 'Apple RGB', action: () => onAssignProfile?.('Apple RGB') },
            { label: 'ColorMatch RGB', action: () => onAssignProfile?.('ColorMatch RGB') },
            { label: 'Wide Gamut RGB', action: () => onAssignProfile?.('Wide Gamut RGB') },
          ]
        },
        {
          label: 'Convert to Profile',
          subItems: [
            { label: 'sRGB IEC61966-2.1', action: () => onConvertToProfile?.('sRGB IEC61966-2.1') },
            { label: 'Adobe RGB (1998)', action: () => onConvertToProfile?.('Adobe RGB (1998)') },
            { label: 'Display P3', action: () => onConvertToProfile?.('Display P3') },
            { label: 'ProPhoto RGB', action: () => onConvertToProfile?.('ProPhoto RGB') },
            { label: 'Apple RGB', action: () => onConvertToProfile?.('Apple RGB') },
            { label: 'ColorMatch RGB', action: () => onConvertToProfile?.('ColorMatch RGB') },
            { label: 'Wide Gamut RGB', action: () => onConvertToProfile?.('Wide Gamut RGB') },
          ]
        },
        { divider: true },
        { label: 'Preferences...', shortcut: shortcuts.edit_preferences || 'Ctrl+K', action: onPreferences },
      ]
    },
    {
      label: 'Image',
      items: [
        {
          label: 'Mode',
          subItems: [
            { label: 'RGB Color', checked: colorMode === 'rgb', action: onConvertToRGB, disabled: colorMode === 'rgb' },
            { label: 'Grayscale', checked: colorMode === 'grayscale', action: onGrayscale, disabled: colorMode === 'grayscale' },
            { label: 'CMYK Color', checked: colorMode === 'cmyk', action: onConvertToCMYK, disabled: colorMode === 'cmyk' },
            { label: 'Indexed Color', checked: colorMode === 'indexed', action: onConvertToIndexed, disabled: colorMode === 'indexed' },
            { divider: true },
            { label: '8 Bits/Channel' },
            { label: '16 Bits/Channel' },
            { label: '32 Bits/Channel' },
          ]
        },
        {
          label: 'Adjustments',
          subItems: [
            { label: 'Brightness/Contrast...', action: () => addAdjustmentLayer('brightness_contrast') },
            { label: 'Levels...', shortcut: shortcuts.adjust_levels || 'Ctrl+L', action: () => addAdjustmentLayer('levels') },
            { label: 'Curves...', shortcut: shortcuts.adjust_curves || 'Ctrl+M', action: () => addAdjustmentLayer('curves') },
            { label: 'Exposure...', action: () => addAdjustmentLayer('exposure') },
            { divider: true },
            { label: 'Vibrance...', action: () => addAdjustmentLayer('vibrance') },
            { label: 'Hue/Saturation...', shortcut: shortcuts.adjust_hue_saturation || 'Ctrl+U', action: () => addAdjustmentLayer('hue_saturation') },
            { label: 'Color Balance...', shortcut: shortcuts.adjust_color_balance || 'Ctrl+B', action: () => addAdjustmentLayer('color_balance') },
            { label: 'Black & White...', shortcut: 'Alt+Shift+Ctrl+B', action: () => addAdjustmentLayer('black_white') },
            { label: 'Photo Filter...', action: () => addAdjustmentLayer('photo_effects') },
            { label: 'Channel Mixer...', action: () => addAdjustmentLayer('channel_mixer') },
            { label: 'Color Lookup...', action: () => addAdjustmentLayer('color_lookup') },
            { divider: true },
            { label: 'Invert', shortcut: shortcuts.adjust_invert || 'Ctrl+I', action: onInvert },
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
        { label: 'Auto Tone', action: autoTone },
        { label: 'Auto Contrast', action: autoContrast },
        { label: 'Auto Color', action: autoColor },
        { divider: true },
        { label: 'Canvas Size...', shortcut: shortcuts.dialog_canvas_size || 'Alt+Ctrl+C', action: onCanvasSize },
        { label: 'Image Size...', shortcut: shortcuts.dialog_image_size || 'Alt+Ctrl+I', action: onImageSize },
        { divider: true },
        {
          label: 'Transform',
          subItems: [
            { label: 'Rotate 180°', action: () => onTransformImage?.('rotate180') },
            { label: 'Rotate 90° Clockwise', action: () => onTransformImage?.('rotate90CW') },
            { label: 'Rotate 90° Counter Clockwise', action: () => onTransformImage?.('rotate90CCW') },
            { divider: true },
            { label: 'Flip Horizontally', action: () => onTransformImage?.('flipH') },
            { label: 'Flip Vertically', action: () => onTransformImage?.('flipV') },
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
            { label: 'Brightness/Contrast...', action: () => addAdjustmentLayer('brightness_contrast') },
            { label: 'Levels...', action: () => addAdjustmentLayer('levels') },
            { label: 'Curves...', action: () => addAdjustmentLayer('curves') },
            { label: 'Exposure...', action: () => addAdjustmentLayer('exposure') },
            { label: 'Vibrance...', action: () => addAdjustmentLayer('vibrance') },
            { label: 'Hue/Saturation...', action: () => addAdjustmentLayer('hue_saturation') },
            { label: 'Color Balance...', action: () => addAdjustmentLayer('color_balance') },
            { label: 'Black & White...', action: () => addAdjustmentLayer('black_white') },
            { label: 'Photo Filter...', action: () => addAdjustmentLayer('photo_effects') },
            { label: 'Channel Mixer...', action: () => addAdjustmentLayer('channel_mixer') },
            { label: 'Color Lookup...', action: () => addAdjustmentLayer('color_lookup') },
            { label: 'Invert', action: onInvert },
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
        { label: 'Filter Gallery...', action: () => applyFilterAction('filter_gallery') },
        { label: 'Camera Raw...', shortcut: 'Shift+Ctrl+A', action: () => applyFilterAction('camera_raw') },
        { label: 'Lens Correction...', shortcut: 'Shift+Ctrl+R' },
        { label: 'Liquify...', shortcut: 'Shift+Ctrl+X' },
        { label: 'Vanishing Point...', shortcut: 'Alt+Ctrl+V' },
        { divider: true },
        {
          label: 'Blur',
          subItems: [
            { label: 'Average', action: () => applyFilterAction('average') },
            { label: 'Blur', action: () => applyFilterAction('blur') },
            { label: 'Blur More', action: () => applyFilterAction('blur_more') },
            { label: 'Box Blur...', action: () => applyFilterAction('gaussian_blur') },
            { label: 'Gaussian Blur...', action: () => applyFilterAction('gaussian_blur') },
            { label: 'Lens Blur...' },
            { label: 'Motion Blur...', action: () => applyFilterAction('motion_blur') },
            { label: 'Radial Blur...' },
            { label: 'Surface Blur...' },
          ]
        },
        {
          label: 'Distort',
          subItems: [
            { label: 'Diffuse Glow...' },
            { label: 'Displace...', action: () => applyFilterAction('displace') },
            { label: 'Glass...' },
            { label: 'Ocean Ripple...' },
            { label: 'Pinch...', action: () => applyFilterAction('pinch') },
            { label: 'Polar Coordinates...' },
            { label: 'Ripple...', action: () => applyFilterAction('ripple') },
            { label: 'Shear...' },
            { label: 'Spherize...' },
            { label: 'Twirl...' },
            { label: 'Wave...', action: () => applyFilterAction('wave') },
            { label: 'ZigZag...' },
          ]
        },
        {
          label: 'Noise',
          subItems: [
            { label: 'Add Noise...', action: () => applyFilterAction('add_noise') },
            { label: 'Despeckle' },
            { label: 'Dust & Scratches...', action: () => applyFilterAction('dust_scratches') },
            { label: 'Median...', action: () => applyFilterAction('median') },
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
            { label: 'Sharpen', action: () => applyFilterAction('sharpen') },
            { label: 'Sharpen Edges' },
            { label: 'Sharpen More', action: () => applyFilterAction('sharpen_more') },
            { label: 'Smart Sharpen...' },
            { label: 'Unsharp Mask...', action: () => applyFilterAction('unsharp_mask') },
          ]
        },
        {
          label: 'Stylize',
          subItems: [
            { label: 'Diffuse...' },
            { label: 'Emboss...', action: () => applyFilterAction('emboss') },
            { label: 'Extrude...' },
            { label: 'Find Edges', action: () => applyFilterAction('find_edges') },
            { label: 'Glowing Edges...' },
            { label: 'Solarize' },
            { label: 'Tiles...' },
            { label: 'Trace Contour...' },
            { label: 'Wind...' },
          ]
        },
        {
          label: 'Other',
          subItems: [
            { label: 'High Pass...', action: () => applyFilterAction('high_pass') },
            { label: 'Maximum...', action: () => applyFilterAction('maximum') },
            { label: 'Minimum...', action: () => applyFilterAction('minimum') },
          ]
        },
      ]
    },
    {
      label: '⚗ Experimental',
      items: [
        {
          label: 'Precision Fill...',
          action: () => useStore.getState().setIsPrecisionFillDialogOpen(true),
        },
        { divider: true },
        {
          label: 'AI & Generative',
          subItems: [
            { label: 'Generative Fill...', action: () => addAlert({ type: 'info', message: '🧪 Generative Fill — coming soon!' }) },
            { label: 'Remove Background (AI)', action: () => addAlert({ type: 'info', message: '🧪 AI Background Removal — coming soon!' }) },
            { label: 'Upscale Image (AI)', action: () => addAlert({ type: 'info', message: '🧪 AI Upscaling — coming soon!' }) },
            { label: 'Denoise (AI)', action: () => addAlert({ type: 'info', message: '🧪 AI Denoising — coming soon!' }) },
          ]
        },
        { divider: true },
        {
          label: 'Advanced Filters',
          subItems: [
            { label: 'Halftone Effect', action: () => addAlert({ type: 'info', message: '🧪 Halftone Effect — coming soon!' }) },
            { label: 'Duotone...', action: () => addAlert({ type: 'info', message: '🧪 Duotone — coming soon!' }) },
            { label: 'Glitch Effect', action: () => addAlert({ type: 'info', message: '🧪 Glitch Effect — coming soon!' }) },
          ]
        },
        {
          label: 'Smart Objects',
          subItems: [
            { label: 'Convert to Smart Object', action: () => addAlert({ type: 'info', message: '🧪 Smart Objects — coming soon!' }) },
            { label: 'Edit Contents', action: () => addAlert({ type: 'info', message: '🧪 Smart Object editing — coming soon!' }) },
            { label: 'Rasterize Smart Object', action: () => addAlert({ type: 'info', message: '🧪 Rasterize — coming soon!' }) },
          ]
        },
        { divider: true },
        {
          label: 'Collaboration',
          subItems: [
            { label: 'Share Canvas (Live)', action: () => useStore.getState().setIsServerlessShareDialogOpen(true, 'webrtc') },
            { label: 'Comment on Layer', action: () => addAlert({ type: 'info', message: '🧪 Layer Comments — coming soon!' }) },
          ]
        },
        { divider: true },
        {
          label: 'Developer Tools',
          subItems: [
            {
              label: 'Log Store State',
              action: () => {
                const s = useStore.getState();
                console.group('[Pixelite] Store Snapshot');
                console.log('documentSize:', s.documentSize);
                console.log('zoom:', s.zoom);
                console.log('activeLayerId:', s.activeLayerId);
                console.log('layers:', s.layers);
                console.groupEnd();
                addAlert({ type: 'success', message: 'Store state logged to console (F12)' });
              }
            },
            {
              label: 'Clear Thumbnail Cache',
              action: () => {
                useStore.getState().layers.forEach((l: any) => useStore.getState().updateLayer(l.id, { thumbnail: '' }));
                addAlert({ type: 'success', message: 'Thumbnail cache cleared — regenerating…' });
              }
            },
            {
              label: 'Performance Info',
              action: () => {
                const s = useStore.getState();
                const mem = (performance as any).memory;
                const heap = mem ? `${(mem.usedJSHeapSize / 1_048_576).toFixed(1)} MB` : 'N/A';
                addAlert({ type: 'info', message: `Layers: ${s.layers.length} · JS Heap: ${heap}` });
              }
            },
          ]
        },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom In', shortcut: 'Ctrl++', action: onZoomIn },
        { label: 'Zoom Out', shortcut: 'Ctrl+-', action: onZoomOut },
        { label: 'Fit Area', shortcut: shortcuts.view_zoom_fit || 'Ctrl+0', action: onZoomFit },
        { label: 'Pixel to Pixel', shortcut: shortcuts.view_zoom_100 || 'Ctrl+1', action: () => useStore.getState().setZoom(1.0) },
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
        { label: 'Rulers', shortcut: shortcuts.view_rulers || 'Ctrl+R', action: onToggleRulers },
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
        { label: 'Keyboard Shortcuts', action: () => useStore.getState().setIsKeyboardShortcutsDialogOpen(true) },
        { label: 'Search' },
        { label: 'Help' },
        { label: 'About' },
      ]
    }
  ];

  const renderMenuItem = (item: MenuItem, index: number, parentLabel?: string, depth = 1) => {
    if (item.divider) {
      return <div key={`div-${index}-${parentLabel}`} className="menu-divider" />;
    }

    const submenuKey = `${parentLabel}-${item.label}`;
    const isSubmenuActive = Boolean(activeSubmenus[submenuKey]);

    return (
      <div
        key={`${parentLabel}-${item.label}-${index}`}
        style={{ '--depth': depth } as React.CSSProperties}
        className={`menu-option ${item.subItems ? 'submenu-parent' : ''} ${isSubmenuActive ? 'active' : ''} ${item.disabled ? 'disabled' : ''}`}
        onClick={(e) => {
          if (item.disabled) {
            e.stopPropagation();
            return;
          }
          if (item.subItems) {
            e.stopPropagation();
            setActiveSubmenus((prev) => ({
              ...prev,
              [submenuKey]: !prev[submenuKey]
            }));
          } else if (item.action) {
            e.stopPropagation();
            item.action();
            setActiveMenu(null);
            setActiveSubmenus({});
            onCloseMobile?.();
          }
        }}
        onMouseEnter={() => {
          if (window.innerWidth > 768 && item.subItems && !item.disabled) {
            setActiveSubmenus({ [submenuKey]: true });
          }
        }}
        onMouseLeave={() => {
          if (window.innerWidth > 768 && item.subItems) {
            setActiveSubmenus((prev) => ({
              ...prev,
              [submenuKey]: false
            }));
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
          <div className={`menu-submenu-wrapper ${isSubmenuActive ? 'open' : ''}`}>
            <div className="menu-submenu-inner">
              <div className="menu-submenu">
                {item.subItems.map((subItem, subIndex) => renderMenuItem(subItem, subIndex, `${parentLabel}-${item.label}`, depth + 1))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hasDocument = layers.length > 0;

  const processMenuItems = (items: MenuItem[], parentLabel?: string): MenuItem[] => {
    return items.map(item => {
      let shouldEnableOnWelcome = false;

      if (!parentLabel) {
        // Top level items
      } else if (parentLabel === 'File') {
        shouldEnableOnWelcome = ['New...', 'Open...', 'Open More', 'Open Recent', 'Share'].includes(item.label || '');
      } else if (parentLabel === 'Open More' || parentLabel === 'Share' || parentLabel === 'Collaboration') {
        shouldEnableOnWelcome = true;
      } else if (parentLabel === 'Edit') {
        shouldEnableOnWelcome = ['Preferences...'].includes(item.label || '');
      } else if (parentLabel === 'Window' || parentLabel === 'More' || parentLabel === '⚗ Experimental' ||
        parentLabel === 'AI & Generative' || parentLabel === 'Advanced Filters' ||
        parentLabel === 'Smart Objects' || parentLabel === 'Collaboration' || parentLabel === 'Developer Tools') {
        shouldEnableOnWelcome = true;
      }

      const newSubItems = item.subItems ? processMenuItems(item.subItems, item.label) : undefined;
      const isDisabled = item.divider
        ? false
        : item.disabled || (!hasDocument && !shouldEnableOnWelcome);

      return {
        ...item,
        subItems: newSubItems,
        disabled: isDisabled
      };
    });
  };

  const processedMenuData = menuData.map(section => ({
    ...section,
    items: processMenuItems(section.items, section.label)
  }));

  return (
    <nav className={`menubar main-nav ${isMobileOpen ? 'mobile-open' : ''}`} ref={menuRef}>
      {isMobileOpen && (
        <div className="mobile-menu-header">
          <span>Menu</span>
          <button onClick={onCloseMobile}><LucideIcons.X size={20} /></button>
        </div>
      )}
      <div className="menu-items-wrapper">
        {processedMenuData.map((section) => (
          <div
            key={section.label}
            className={`menu-item-container ${activeMenu === section.label ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu(activeMenu === section.label ? null : section.label);
              setActiveSubmenus({});
            }}
            onMouseEnter={() => {
              if (window.innerWidth > 768) {
                setActiveMenu(section.label);
                setActiveSubmenus({});
              }
            }}
            onMouseLeave={() => {
              if (window.innerWidth > 768) {
                setActiveMenu(null);
                setActiveSubmenus({});
              }
            }}
          >
            <div className="menu-title-row">
              <span>{section.label}</span>
              {isMobileOpen && (
                <LucideIcons.ChevronRight
                  size={14}
                  className="submenu-icon"
                />
              )}
            </div>
            <div className={`menu-dropdown-wrapper ${activeMenu === section.label ? 'open' : ''}`}>
              <div className="menu-dropdown-inner">
                <div className="menu-dropdown">
                  {section.items.map((item, index) => renderMenuItem(item, index, section.label, 1))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </nav>
  );
};


export default MenuBar;

import React, { useState, useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import './MenuBar.css';
import { useStore } from '../../store/useStore';
import { pasteFromClipboard } from '../../utils/clipboardUtils';
import { convertTextLayerToPathAsync } from '../../utils/canvasUtils';

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: (state: ReturnType<typeof useStore.getState>) => void;
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
  onDuplicateImage?: () => void;
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
  onTransformMode?: (mode: 'free' | 'scale' | 'rotate' | 'skew' | 'distort' | 'perspective' | 'warp' | 'puppet') => void;
  onCanvasSize?: () => void;
  onImageSize?: () => void;
  onVariables?: () => void;
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
  onDuplicateImage,
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
  onVariables,
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

  // Layer > Arrange keyboard shortcuts (Ctrl+]/Ctrl+[ family).
  // Handled here instead of App.tsx so this menu's advertised shortcuts work.
  useEffect(() => {
    const matches = (e: KeyboardEvent, shortcut: string): boolean => {
      if (!shortcut) return false;
      const parts = shortcut.split('+').map(p => p.trim().toLowerCase());
      const needsCtrl = parts.includes('ctrl') || parts.includes('cmd') || parts.includes('control');
      const needsShift = parts.includes('shift');
      const needsAlt = parts.includes('alt') || parts.includes('option');
      const keyPart = parts.find(p => !['ctrl', 'cmd', 'control', 'shift', 'alt', 'option'].includes(p));
      if (!keyPart) return false;
      if (needsCtrl !== (e.ctrlKey || e.metaKey)) return false;
      if (needsShift !== e.shiftKey) return false;
      if (needsAlt !== e.altKey) return false;
      return e.key.toLowerCase() === keyPart;
    };
    const arrange = (dir: 'front' | 'forward' | 'backward' | 'back') => {
      const st = useStore.getState();
      if (!st.activeLayerId) return;
      if (dir === 'front') st.reorderLayers?.(st.layers.findIndex(l => l.id === st.activeLayerId), 0);
      else if (dir === 'back') st.reorderLayers?.(st.layers.findIndex(l => l.id === st.activeLayerId), st.layers.length - 1);
      else if (dir === 'forward') st.moveLayer?.(st.activeLayerId, 'up');
      else st.moveLayer?.(st.activeLayerId, 'down');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts while typing (same guard as App.tsx)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || useStore.getState().isTyping) {
        return;
      }
      const sc = useStore.getState().shortcuts || {};
      if (matches(e, sc.layer_arrange_front || 'Shift+Ctrl+]')) { e.preventDefault(); arrange('front'); }
      else if (matches(e, sc.layer_arrange_forward || 'Ctrl+]')) { e.preventDefault(); arrange('forward'); }
      else if (matches(e, sc.layer_arrange_backward || 'Ctrl+[')) { e.preventDefault(); arrange('backward'); }
      else if (matches(e, sc.layer_arrange_back || 'Shift+Ctrl+[')) { e.preventDefault(); arrange('back'); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVector = activeLayer && (activeLayer.type === 'text' || activeLayer.type === 'shape');

  // ---------- Combine Shapes helpers ----------

  // The "Combine Shapes" submenu parent is only enabled when at least two
  // shape layers are in the current selection (or the active layer plus one
  // more shape, when only one is selected).
  const canCombineShapes = (s: ReturnType<typeof useStore.getState>): boolean => {
    const ids = s.selectedLayerIds.length > 0 ? s.selectedLayerIds : (s.activeLayerId ? [s.activeLayerId] : []);
    const shapeCount = ids.filter((id: string) => {
      const l = s.layers.find((x: any) => x.id === id);
      return l && l.type === 'shape' && l.shapeData;
    }).length;
    return shapeCount >= 2 && typeof s.combineShapes === 'function';
  };

  const runCombine = (
    s: ReturnType<typeof useStore.getState>,
    op: 'union' | 'subtract' | 'intersect' | 'exclude'
  ) => {
    const ids = s.selectedLayerIds.length > 0 ? s.selectedLayerIds : (s.activeLayerId ? [s.activeLayerId] : []);
    const shapeIds = ids.filter((id: string) => {
      const l = s.layers.find((x: any) => x.id === id);
      return l && l.type === 'shape' && l.shapeData;
    });
    if (shapeIds.length < 2) {
      s.addAlert?.({ type: 'error', message: 'Select two or more shape layers to combine.' });
      return;
    }
    s.combineShapes?.(shapeIds, op);
  };


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
        { label: 'Fade...', shortcut: 'Shift+Ctrl+F', disabled: true },
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
        { label: 'Perspective Warp', action: () => useStore.getState().setActiveTool('perspective_warp') },
        { label: 'Puppet Warp', action: () => onTransformMode?.('puppet') },
        { label: 'Content-Aware Scale', action: () => setIsContentAwareScaleDialogOpen(true) },
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
            { label: 'Posterize...', action: () => addAdjustmentLayer('posterize') },
            { label: 'Threshold...', action: () => addAdjustmentLayer('threshold') },
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
        { label: 'Duplicate', action: onDuplicateImage },
        { label: 'Apply Image...' },
        { divider: true },
        { label: 'Variables...', action: onVariables },
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
          label: 'Text',
          disabled: activeLayer?.type !== 'text',
          subItems: [
            {
              label: 'Convert to Shape',
              action: async (s) => {
                const layer = s.layers.find((l) => l.id === s.activeLayerId);
                if (!layer || layer.type !== 'text') return;
                const svgPath = await convertTextLayerToPathAsync(layer as any);
                if (!svgPath) {
                  s.addAlert?.({ type: 'error', message: 'Could not convert this text layer to a shape.' });
                  return;
                }
                s.addLayer({
                  type: 'shape',
                  name: `${layer.name || 'Text'} Shape`,
                  position: { ...(layer.position || { x: 0, y: 0 }) },
                  width: layer.width,
                  height: layer.height,
                  rotation: layer.rotation,
                  shapeData: {
                    type: 'path',
                    svgPath,
                    fill: layer.color || '#000000',
                    stroke: layer.strokeColor || 'transparent',
                    strokeWidth: layer.strokeWidth || 0,
                    fillRule: 'evenodd',
                  },
                });
                // Hide the original text layer: its glyphs would otherwise render
                // underneath the new shape and fill in the evenodd holes (the
                // counters in "A", "B", "P", "D"), making them look solid.
                s.updateLayer(layer.id, { visible: false });
              }
            },
          ]
        },
        { divider: true },
        {
          label: 'Layer Style',
          subItems: [
            { label: 'Blending Options...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('blending'); } },
            { divider: true },
            { label: 'Drop Shadow...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('dropShadow'); } },
            { label: 'Inner Shadow...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('innerShadow'); } },
            { label: 'Outer Glow...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('outerGlow'); } },
            { label: 'Inner Glow...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('innerGlow'); } },
            { label: 'Bevel and Emboss...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('bevelAndEmboss'); } },
            { label: 'Satin...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('satin'); } },
            { label: 'Color Overlay...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('colorOverlay'); } },
            { label: 'Gradient Overlay...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('gradientOverlay'); } },
            { label: 'Pattern Overlay...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('patternOverlay'); } },
            { label: 'Stroke...', action: (s) => { s.setIsLayerStyleDialogOpen?.(true); s.setLayerStyleActiveTab?.('strokeStyle'); } },
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
            { label: 'Posterize...', action: () => addAdjustmentLayer('posterize') },
            { label: 'Threshold...', action: () => addAdjustmentLayer('threshold') },
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
            { label: 'Bring to Front', shortcut: 'Shift+Ctrl+]', action: (s) => s.activeLayerId && s.reorderLayers?.(s.layers.findIndex(l => l.id === s.activeLayerId), 0) },
            { label: 'Bring Forward', shortcut: 'Ctrl+]', action: (s) => s.activeLayerId && s.moveLayer?.(s.activeLayerId, 'up') },
            { label: 'Send Backward', shortcut: 'Ctrl+[', action: (s) => s.activeLayerId && s.moveLayer?.(s.activeLayerId, 'down') },
            { label: 'Send to Back', shortcut: 'Shift+Ctrl+[', action: (s) => s.activeLayerId && s.reorderLayers?.(s.layers.findIndex(l => l.id === s.activeLayerId), s.layers.length - 1) },
          ]
        },
        {
          label: 'Combine Shapes',
          disabled: !canCombineShapes(useStore.getState()),
          subItems: [
            { label: 'Union',     action: (s) => runCombine(s, 'union') },
            { label: 'Subtract',  action: (s) => runCombine(s, 'subtract') },
            { label: 'Intersect', action: (s) => runCombine(s, 'intersect') },
            { label: 'Exclude',   action: (s) => runCombine(s, 'exclude') },
            { divider: true },
            { label: 'Make Compound Shape', action: (s) => s.makeCompoundShape?.(s.selectedLayerIds) },
          ]
        },
        { divider: true },
        { label: 'Merge Down', shortcut: 'Ctrl+E', action: (s) => s.mergeLayers?.() },
        { label: 'Merge Visible', shortcut: 'Shift+Ctrl+E', action: (s) => s.mergeVisible?.() },
        { label: 'Flatten Image', action: (s) => s.flattenImage?.() },
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
            { label: 'Generative Fill...', disabled: true, action: () => {} },
            { label: 'Remove Background (AI)', disabled: true, action: () => {} },
            { label: 'Upscale Image (AI)', disabled: true, action: () => {} },
            { label: 'Denoise (AI)', disabled: true, action: () => {} },
          ]
        },
        { divider: true },
        {
          label: 'Advanced Filters',
          subItems: [
            { label: 'Halftone Effect', action: () => applyFilterAction('halftone') },
            { label: 'Duotone...', action: () => applyFilterAction('duotone') },
            { label: 'Glitch Effect', action: () => applyFilterAction('glitch') },
          ]
        },
        {
          label: 'Smart Objects',
          subItems: [
            { label: 'Convert to Smart Object', disabled: true, action: () => {} },
            { label: 'Edit Contents', disabled: true, action: () => {} },
            { label: 'Rasterize Smart Object', disabled: true, action: () => {} },
          ]
        },
        { divider: true },
        {
          label: 'Collaboration',
          subItems: [
            { label: 'Share Canvas (Live)', action: () => useStore.getState().setIsServerlessShareDialogOpen(true, 'webrtc') },
            { label: 'Comment on Layer', disabled: true, action: () => {} },
          ]
        },
        { divider: true },
        {
          label: 'Developer Tools',
          subItems: [
            {
              label: 'Log Store State',
              action: () => {
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
            item.action(useStore.getState());
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

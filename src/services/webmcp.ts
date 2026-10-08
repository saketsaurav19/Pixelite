/**
 * WebMCP integration for Pixelite.
 *
 * Exposes the editor's functions as Model-Context-Protocol tools via the browser's
 * `document.modelContext` (Chrome 149+, gated by the `tools` Permissions Policy and
 * origin isolation). The agent running in the browser can discover and call these
 * tools to drive the editor programmatically.
 *
 * When `document.modelContext` is unavailable (older browsers, non-isolated
 * contexts, missing feature flag) this module no-ops and logs once.
 *
 * Reference: https://developer.chrome.com/docs/ai/webmcp/imperative-api
 */
import { useStore } from '../store/useStore';
import type { Layer, Tool } from '../store/types';
import { pasteFromClipboard } from '../utils/clipboardUtils';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** Best-effort access to the bridge that App.tsx populates for non-store handlers. */
function getBridge(): Record<string, any> {
  return (typeof window !== 'undefined' ? (window as any).__pixelite : null) || {};
}

/** Snapshot of the editor's current document. */
function snapshotState() {
  const s = useStore.getState();
  return {
    documentName: s.activeDocumentName,
    documentSize: s.documentSize,
    colorMode: s.colorMode,
    bitDepth: s.bitDepth,
    zoom: s.zoom,
    canvasRotation: s.canvasRotation,
    canvasOffset: s.canvasOffset,
    visiblePanels: s.visiblePanels,
    showRulers: s.showRulers,
    showGrid: s.showGrid,
    showGuides: s.showGuides,
    activeLayerId: s.activeLayerId,
    selectedLayerIds: s.selectedLayerIds,
    selectionRect: s.selectionRect,
    isInverseSelection: s.isInverseSelection,
    activeTool: s.activeTool,
    transformMode: s.transformMode,
    historyIndex: s.historyIndex,
    historyLength: s.history.length,
  };
}

function text(s: any) {
  // Plain string => WebMCP will surface it as text content
  return typeof s === 'string' ? s : JSON.stringify(s, null, 2);
}

function findLayer(layers: any[], id: string | null | undefined): Layer | undefined {
  if (!id) return undefined;
  const stack = [...layers];
  while (stack.length) {
    const node = stack.shift()!;
    if (node.id === id) return node;
    if (node.children?.length) stack.push(...node.children);
  }
  return undefined;
}

/** All visible panel names for the `toggle_panel` enum. */
const PANEL_KEYS = [
  'layers', 'history', 'properties', 'adjustments', 'navigator',
  'extras', 'rulers', 'guides', 'swatches', 'channels', 'paths',
] as const;

const TOOL_NAMES: Tool[] = [
  'move', 'artboard', 'marquee', 'ellipse_marquee', 'lasso', 'polygonal_lasso', 'magnetic_lasso',
  'quick_selection', 'magic_wand', 'object_selection', 'crop', 'perspective_crop', 'slice', 'slice_select',
  'eyedropper', 'color_sampler', 'ruler', 'healing', 'healing_brush', 'patch', 'content_aware_move', 'red_eye',
  'brush', 'pencil', 'color_replacement', 'mixer_brush', 'history_brush', 'art_history_brush', 'clone', 'pattern_stamp',
  'eraser', 'background_eraser', 'magic_eraser', 'rectangle_eraser', 'lasso_eraser', 'gradient', 'paint_bucket',
  'blur', 'sharpen', 'smudge', 'dodge', 'burn', 'sponge', 'text', 'vertical_text', 'pen', 'free_pen',
  'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select',
  'shape', 'ellipse_shape', 'triangle_shape', 'polygon_shape', 'line_shape', 'custom_shape',
  'hand', 'rotate_view', 'zoom_tool', 'lighting', 'transform', 'perspective_warp', 'mesh_warp',
];

const FILTER_TYPES = [
  'filter_gallery', 'camera_raw',
  'average', 'blur', 'blur_more', 'gaussian_blur', 'motion_blur',
  'displace', 'pinch', 'ripple', 'wave',
  'add_noise', 'dust_scratches', 'median',
  'sharpen', 'sharpen_more', 'unsharp_mask',
  'emboss', 'find_edges', 'oil_paint',
  'high_pass', 'maximum', 'minimum',
] as const;

const ADJUSTMENT_TYPES = [
  'brightness_contrast', 'levels', 'curves', 'exposure', 'vibrance',
  'hue_saturation', 'black_white', 'photo_effects', 'color_balance',
  'channel_mixer', 'color_lookup',
] as const;

const EXPORT_FORMATS = ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'pdf', 'tiff', 'bmp'] as const;

const MIME_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  svg: 'image/svg+xml', gif: 'image/gif', pdf: 'application/pdf',
  tiff: 'image/tiff', bmp: 'image/bmp',
};

const SCREEN_MODES = ['standard', 'full-menu', 'full'] as const;
const WORKSPACES = ['essentials', 'photography', 'graphic-web'] as const;
const DOCUMENT_LAYOUTS = ['tabs', 'cascade', 'tile', 'float'] as const;
const COLOR_MODES = ['rgb', 'grayscale', 'cmyk', 'indexed'] as const;
const BIT_DEPTHS = [8, 16, 32] as const;
const TRANSFORM_MODES = ['free', 'scale', 'rotate', 'skew', 'distort', 'perspective', 'warp', 'puppet'] as const;
const GRID_TYPES = ['square', 'horizontal', 'vertical', 'cross'] as const;
const SELECTION_MODIFICATIONS = ['expand', 'contract', 'border', 'smooth'] as const;
const ARRANGE_TARGETS = ['front', 'forward', 'backward', 'back'] as const;
const SHARE_TABS = ['url', 'webrtc', 'public'] as const;

/* -------------------------------------------------------------------------- */
/*  Tool definitions                                                          */
/* -------------------------------------------------------------------------- */

/**
 * A WebMCP tool definition. We use a loose shape that matches the imperative API
 * spec: name, description, inputSchema, annotations?, execute. The runtime
 * (document.modelContext.registerTool) accepts the exact same shape.
 */
export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (args: any) => Promise<any>;
}

/**
 * Build the full tool catalog. Each tool maps 1:1 to a user-facing editor function
 * (menu item, dialog, or store action).
 */
function buildTools(): WebMCPTool[] {
  const tools: WebMCPTool[] = [];

  // --- Read-only / state query tools (declared first so they're easy to find) ---
  tools.push({
    name: 'get_document_info',
    description:
      'Get information about the current document: name, canvas size (pixels), color mode, bit depth, zoom, active tool, layer count, selection, history cursor.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => text(snapshotState()),
  });

  tools.push({
    name: 'list_layers',
    description:
      'List all layers in the current document as a tree. Each layer entry includes id, name, type, visible, locked, opacity, blendMode, and position/size where available.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const layers = useStore.getState().layers;
      const compact = (nodes: any[]): any[] =>
        nodes.map((n) => ({
          id: n.id,
          name: n.name,
          type: n.type,
          visible: n.visible,
          locked: n.locked,
          opacity: n.opacity,
          blendMode: n.blendMode,
          position: n.position,
          width: n.width,
          height: n.height,
          children: n.children?.length ? compact(n.children) : undefined,
        }));
      return text(compact(layers));
    },
  });

  tools.push({
    name: 'get_active_layer',
    description: 'Return the currently active layer, including its dataUrl (truncated).',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const s = useStore.getState();
      const layer = findLayer(s.layers, s.activeLayerId);
      if (!layer) return text({ error: 'No active layer' });
      const { dataUrl, ...rest } = layer as any;
      return text({ ...rest, dataUrl: dataUrl ? `${dataUrl.slice(0, 64)}…` : null });
    },
  });

  tools.push({
    name: 'get_selection_info',
    description: 'Return the current selection rectangle and inverse flag, or null if no selection.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    execute: async () => {
      const s = useStore.getState();
      return text({
        selectionRect: s.selectionRect,
        shape: (s as any).selectionShape,
        lassoPaths: (s.lassoPaths || []).length,
        isInverseSelection: s.isInverseSelection,
        mode: s.selectionMode,
        feather: s.selectionFeather,
        antiAlias: s.selectionAntiAlias,
        tolerance: s.selectionTolerance,
      });
    },
  });

  // --- File operations ---
  tools.push({
    name: 'new_document',
    description:
      'Open the New Document dialog so the user can configure a new canvas. To create one without prompting, use the alternative overload via the store.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsNewDocumentDialogOpen(true);
      return 'New Document dialog opened';
    },
  });

  tools.push({
    name: 'create_document',
    description: 'Create a new document with the given name and pixel size.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Document name (default: Untitled)' },
        width: { type: 'number', description: 'Width in pixels (default: 1920)' },
        height: { type: 'number', description: 'Height in pixels (default: 1080)' },
      },
    },
    execute: async ({ name, width, height }: { name?: string; width?: number; height?: number }) => {
      useStore.getState().addDocument(name, { w: width ?? 1920, h: height ?? 1080 });
      return `Created document "${name ?? 'Untitled'}" ${width ?? 1920}×${height ?? 1080}`;
    },
  });

  tools.push({
    name: 'open_file',
    description: 'Open the system file picker to load an image (PNG, JPG, SVG, PDF, PSD, …).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.openFile === 'function') {
        bridge.openFile();
        return 'File picker opened';
      }
      document.getElementById('global-file-input')?.click();
      return 'File picker opened';
    },
  });

  tools.push({
    name: 'open_url',
    description: 'Open an image from a URL into a new document.',
    inputSchema: {
      type: 'object',
      properties: { url: { type: 'string', description: 'HTTP(S) URL of an image' } },
      required: ['url'],
    },
    execute: async ({ url }: { url: string }) => {
      const bridge = getBridge();
      if (typeof bridge.openURL === 'function') {
        await bridge.openURL(url);
        return `Opened ${url}`;
      }
      return 'openURL handler not available';
    },
  });

  tools.push({
    name: 'save_document',
    description: 'Save the current document. With asNew=true a "Save As" flow is triggered.',
    inputSchema: {
      type: 'object',
      properties: { asNew: { type: 'boolean', description: 'Force Save As dialog' } },
    },
    execute: async ({ asNew }: { asNew?: boolean } = {}) => {
      const bridge = getBridge();
      if (typeof bridge.save === 'function') {
        await bridge.save(Boolean(asNew));
        return asNew ? 'Saved as new file' : 'Saved';
      }
      return 'save handler not available';
    },
  });

  tools.push({
    name: 'export_image',
    description:
      'Export the current image in the chosen format. Opens the Export dialog; the user completes the actual file save.',
    inputSchema: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: [...EXPORT_FORMATS] as unknown as string[], description: 'Image format' },
      },
      required: ['format'],
    },
    execute: async ({ format }: { format: string }) => {
      const s = useStore.getState();
      s.setExportFormat((MIME_MAP[format] || 'image/png') as any);
      s.setIsExportDialogOpen(true);
      return `Export dialog opened (${format})`;
    },
  });

  tools.push({
    name: 'print_document',
    description: 'Open the browser print dialog for the current document.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.print === 'function') {
        bridge.print();
        return 'Print dialog opened';
      }
      window.print();
      return 'Print dialog opened';
    },
  });

  tools.push({
    name: 'take_snapshot',
    description: 'Open the device camera to capture a photo as a new document.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.takeSnapshot === 'function') {
        await bridge.takeSnapshot();
        return 'Camera opened';
      }
      useStore.getState().setIsCameraDialogOpen(true);
      return 'Camera dialog opened';
    },
  });

  tools.push({
    name: 'share_canvas',
    description:
      'Open a share dialog. mode "url" shares a static URL, "webrtc" starts a live P2P collaboration session, "public" publishes to a public host.',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: [...SHARE_TABS] as unknown as string[] } },
      required: ['mode'],
    },
    execute: async ({ mode }: { mode: 'url' | 'webrtc' | 'public' }) => {
      useStore.getState().setIsServerlessShareDialogOpen(true, mode);
      return `Share dialog opened (${mode})`;
    },
  });

  // --- Edit / history ---
  tools.push({
    name: 'undo',
    description: 'Undo the most recent history step.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.undo?.();
      return s.historyIndex > 0 ? 'Undone' : 'Nothing to undo';
    },
  });

  tools.push({
    name: 'redo',
    description: 'Redo a previously undone step.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.redo?.();
      return 'Redone';
    },
  });

  tools.push({
    name: 'cut',
    description: 'Cut the active (or selected) layer / selection to the clipboard.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.cut === 'function') {
        await bridge.cut();
        return 'Cut';
      }
      return 'cut handler not available';
    },
  });

  tools.push({
    name: 'copy',
    description: 'Copy the active (or selected) layer / selection to the clipboard.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.copy === 'function') {
        await bridge.copy();
        return 'Copied';
      }
      return 'copy handler not available';
    },
  });

  tools.push({
    name: 'copy_merged',
    description: 'Copy a flattened (merged) snapshot of the document to the clipboard.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      const { copySelectionToClipboard } = await import('../utils/clipboardUtils');
      copySelectionToClipboard(s, true);
      return 'Copied merged';
    },
  });

  tools.push({
    name: 'paste',
    description: 'Paste clipboard contents into the document (centered).',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['center', 'in_place', 'into', 'outside'] as unknown as string[], description: 'Where to place the pasted content (default: center)' },
      },
    },
    execute: async ({ mode }: { mode?: 'center' | 'in_place' | 'into' | 'outside' } = {}) => {
      pasteFromClipboard(useStore.getState(), mode ?? 'center');
      return `Pasted (${mode ?? 'center'})`;
    },
  });

  tools.push({
    name: 'free_transform',
    description: 'Activate the Free Transform tool on the active layer.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.freeTransform === 'function') {
        bridge.freeTransform();
        return 'Free Transform activated';
      }
      const s = useStore.getState();
      s.setActiveTool?.('transform');
      return 'Free Transform activated';
    },
  });

  tools.push({
    name: 'perspective_warp',
    description: 'Activate the Perspective Warp tool.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setActiveTool('perspective_warp');
      return 'Perspective Warp activated';
    },
  });

  tools.push({
    name: 'puppet_warp',
    description: 'Activate Puppet Warp (mesh-based deformation) on the active layer.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setTransformMode('puppet');
      s.setActiveTool('transform');
      return 'Puppet Warp activated';
    },
  });

  tools.push({
    name: 'content_aware_scale',
    description: 'Open the Content-Aware Scale dialog.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsContentAwareScaleDialogOpen(true);
      return 'Content-Aware Scale dialog opened';
    },
  });

  tools.push({
    name: 'fill_layer',
    description: 'Open the Fill Layer dialog (solid, gradient or pattern).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.fillLayer === 'function') {
        bridge.fillLayer();
        return 'Fill Layer dialog opened';
      }
      useStore.getState().setIsPrecisionFillDialogOpen(true);
      return 'Fill Layer dialog opened';
    },
  });

  tools.push({
    name: 'auto_align_layers',
    description: 'Auto-align the selected layers (Photoshop-style auto-align).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await useStore.getState().autoAlignLayers?.();
      return 'Auto-aligned';
    },
  });

  tools.push({
    name: 'auto_blend_layers',
    description: 'Auto-blend the selected layers (panorama / focus-stacking heuristics).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await useStore.getState().autoBlendLayers?.();
      return 'Auto-blended';
    },
  });

  tools.push({
    name: 'preferences',
    description: 'Open the Preferences dialog.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsPreferencesDialogOpen(true);
      return 'Preferences opened';
    },
  });

  tools.push({
    name: 'keyboard_shortcuts',
    description: 'Open the Keyboard Shortcuts dialog.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsKeyboardShortcutsDialogOpen(true);
      return 'Keyboard Shortcuts opened';
    },
  });

  // --- Image operations ---
  tools.push({
    name: 'set_color_mode',
    description: 'Switch the document color mode.',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: [...COLOR_MODES] as unknown as string[] } },
      required: ['mode'],
    },
    execute: async ({ mode }: { mode: 'rgb' | 'grayscale' | 'cmyk' | 'indexed' }) => {
      const s = useStore.getState();
      if (mode === 'grayscale') {
        // Defer to the App handler so the same async pipeline (layer iteration,
        // image data conversion, history recording) runs end-to-end.
        const bridge = getBridge();
        if (typeof bridge.grayscale === 'function') {
          bridge.grayscale();
          return 'Converted to Grayscale';
        }
      }
      s.setColorMode(mode);
      return `Color mode set to ${mode}`;
    },
  });

  tools.push({
    name: 'set_bit_depth',
    description: 'Set the bit depth per channel.',
    inputSchema: {
      type: 'object',
      properties: { depth: { type: 'number', enum: [...BIT_DEPTHS] as unknown as number[] } },
      required: ['depth'],
    },
    execute: async ({ depth }: { depth: 8 | 16 | 32 }) => {
      useStore.getState().setBitDepth(depth);
      return `Bit depth set to ${depth}`;
    },
  });

  tools.push({
    name: 'auto_tone',
    description: 'Apply automatic tone correction (Levels auto).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().autoTone?.();
      return 'Auto tone applied';
    },
  });

  tools.push({
    name: 'auto_contrast',
    description: 'Apply automatic contrast correction.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().autoContrast?.();
      return 'Auto contrast applied';
    },
  });

  tools.push({
    name: 'auto_color',
    description: 'Apply automatic color balance.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().autoColor?.();
      return 'Auto color applied';
    },
  });

  tools.push({
    name: 'add_adjustment_layer',
    description: 'Add an adjustment layer of the given type. Adjustments are non-destructive.',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', enum: [...ADJUSTMENT_TYPES] as unknown as string[] } },
      required: ['type'],
    },
    execute: async ({ type }: { type: typeof ADJUSTMENT_TYPES[number] }) => {
      useStore.getState().addAdjustmentLayer(type);
      return `Added ${type} adjustment layer`;
    },
  });

  tools.push({
    name: 'image_size',
    description: 'Open the Image Size dialog (resize the rasterized output).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsImageSizeDialogOpen(true);
      return 'Image Size dialog opened';
    },
  });

  tools.push({
    name: 'canvas_size',
    description: 'Open the Canvas Size dialog (change the document dimensions).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsCanvasSizeDialogOpen(true);
      return 'Canvas Size dialog opened';
    },
  });

  tools.push({
    name: 'rotate_canvas',
    description: 'Rotate the entire canvas.',
    inputSchema: {
      type: 'object',
      properties: { degrees: { type: 'number', enum: [-90, 90, 180] as unknown as number[] } },
      required: ['degrees'],
    },
    execute: async ({ degrees }: { degrees: -90 | 90 | 180 }) => {
      const s = useStore.getState();
      const next = (((s.canvasRotation || 0) + degrees) % 360 + 360) % 360;
      s.setCanvasRotation?.(next as any);
      s.recordHistory?.(`Rotate Canvas ${degrees}°`);
      return `Canvas rotated by ${degrees}° (now ${next}°)`;
    },
  });

  tools.push({
    name: 'flip_canvas',
    description: 'Flip the entire canvas horizontally or vertically.',
    inputSchema: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['horizontal', 'vertical'] as unknown as string[] } },
      required: ['direction'],
    },
    execute: async ({ direction }: { direction: 'horizontal' | 'vertical' }) => {
      await useStore.getState().flipCanvas?.(direction);
      return `Canvas flipped ${direction}`;
    },
  });

  tools.push({
    name: 'trim_canvas',
    description: 'Trim the canvas to the bounding box of the visible pixels.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().trimCanvas?.();
      return 'Canvas trimmed';
    },
  });

  // --- Layer operations ---
  tools.push({
    name: 'add_layer',
    description: 'Add a new layer of the given type. Returns the new layer id.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Layer name' },
        type: { type: 'string', enum: ['paint', 'text', 'shape', 'group', 'image'] as unknown as string[], description: 'Layer type' },
      },
    },
    execute: async ({ name, type }: { name?: string; type?: 'paint' | 'text' | 'shape' | 'group' | 'image' } = {}) => {
      const id = useStore.getState().addLayer({ name: name || `Layer ${Date.now()}`, type: (type as any) || 'paint' });
      return text({ id, message: `Added ${type ?? 'paint'} layer "${name ?? id}"` });
    },
  });

  tools.push({
    name: 'duplicate_layer',
    description: 'Duplicate a layer by id. Defaults to the active layer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Source layer id (default: active layer)' } },
    },
    execute: async ({ id }: { id?: string } = {}) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No source layer' });
      s.duplicateLayer?.(target);
      return `Duplicated layer ${target}`;
    },
  });

  tools.push({
    name: 'delete_layer',
    description: 'Delete a layer by id. Defaults to the active layer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Layer id (default: active layer)' } },
    },
    execute: async ({ id }: { id?: string } = {}) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer to delete' });
      s.removeLayer?.(target);
      s.recordHistory?.(`Delete Layer ${target}`);
      return `Deleted layer ${target}`;
    },
  });

  tools.push({
    name: 'set_active_layer',
    description: 'Make the layer with the given id the active layer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
    execute: async ({ id }: { id: string }) => {
      useStore.getState().setActiveLayer(id);
      return `Active layer set to ${id}`;
    },
  });

  tools.push({
    name: 'set_selected_layers',
    description: 'Replace the current multi-selection with the given layer ids.',
    inputSchema: {
      type: 'object',
      properties: { ids: { type: 'array', items: { type: 'string' } } },
      required: ['ids'],
    },
    execute: async ({ ids }: { ids: string[] }) => {
      useStore.getState().setSelectedLayerIds(ids);
      return `Selected ${ids.length} layer(s)`;
    },
  });

  tools.push({
    name: 'toggle_layer_visibility',
    description: 'Toggle the visibility of a layer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Layer id (default: active layer)' } },
    },
    execute: async ({ id }: { id?: string } = {}) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer' });
      s.toggleLayerVisibility?.(target);
      return `Toggled visibility of ${target}`;
    },
  });

  tools.push({
    name: 'update_layer',
    description:
      'Update a layer\'s properties. Useful for: rename, opacity (0-100), locked, visible, blendMode, position, width, height.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Layer id (default: active layer)' },
        name: { type: 'string' },
        opacity: { type: 'number', description: 'Opacity 0-100' },
        locked: { type: 'boolean' },
        visible: { type: 'boolean' },
        blendMode: { type: 'string' },
        position: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
        width: { type: 'number' },
        height: { type: 'number' },
      },
    },
    execute: async (args: { id?: string; [k: string]: any }) => {
      const s = useStore.getState();
      const { id, ...patch } = args;
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer' });
      const updates: any = { ...patch };
      if (typeof updates.opacity === 'number') updates.opacity = Math.max(0, Math.min(100, updates.opacity));
      s.updateLayer?.(target, updates);
      return `Updated layer ${target}`;
    },
  });

  tools.push({
    name: 'move_layer',
    description: 'Move a layer up or down in the layer stack (single step).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Layer id (default: active layer)' },
        direction: { type: 'string', enum: ['up', 'down'] as unknown as string[] },
      },
      required: ['direction'],
    },
    execute: async ({ id, direction }: { id?: string; direction: 'up' | 'down' }) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer' });
      s.moveLayer?.(target, direction);
      return `Moved layer ${target} ${direction}`;
    },
  });

  tools.push({
    name: 'reorder_layer',
    description: 'Move a layer before/after/inside another layer (groups/artboards).',
    inputSchema: {
      type: 'object',
      properties: {
        draggedId: { type: 'string', description: 'Layer to move (default: active layer)' },
        targetId: { type: 'string', description: 'Reference layer id' },
        position: { type: 'string', enum: ['before', 'after', 'inside'] as unknown as string[] },
      },
      required: ['targetId', 'position'],
    },
    execute: async ({ draggedId, targetId, position }: { draggedId?: string; targetId: string; position: 'before' | 'after' | 'inside' }) => {
      const s = useStore.getState();
      const target = draggedId || s.activeLayerId;
      if (!target) return text({ error: 'No source layer' });
      s.reorderNodesAction?.(target, targetId, position);
      return `Reordered ${target} ${position} ${targetId}`;
    },
  });

  tools.push({
    name: 'arrange_layer',
    description: 'Bring a layer to the front, forward, backward, or to the back.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Layer id (default: active layer)' },
        where: { type: 'string', enum: [...ARRANGE_TARGETS] as unknown as string[] },
      },
      required: ['where'],
    },
    execute: async ({ id, where }: { id?: string; where: typeof ARRANGE_TARGETS[number] }) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer' });
      const idx = s.layers.findIndex((l: any) => l.id === target);
      if (idx === -1) return text({ error: 'Layer not found at top level' });
      switch (where) {
        case 'front':
          s.reorderLayers?.(idx, 0);
          break;
        case 'back':
          s.reorderLayers?.(idx, s.layers.length - 1);
          break;
        case 'forward':
          s.moveLayer?.(target, 'up');
          break;
        case 'backward':
          s.moveLayer?.(target, 'down');
          break;
      }
      return `Arranged ${target} ${where}`;
    },
  });

  tools.push({
    name: 'merge_down',
    description: 'Merge the active layer down with the layer below it.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await useStore.getState().mergeLayers?.();
      return 'Merged down';
    },
  });

  tools.push({
    name: 'merge_visible',
    description: 'Merge all visible layers into a single layer.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await useStore.getState().mergeVisible?.();
      return 'Visible layers merged';
    },
  });

  tools.push({
    name: 'flatten_image',
    description: 'Flatten the image (merge all layers and discard hidden ones).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      await useStore.getState().flattenImage?.();
      return 'Image flattened';
    },
  });

  tools.push({
    name: 'rasterize_layer',
    description: 'Rasterize a vector or text layer into a paint layer.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'Layer id (default: active layer)' } },
    },
    execute: async ({ id }: { id?: string } = {}) => {
      const s = useStore.getState();
      const target = id || s.activeLayerId;
      if (!target) return text({ error: 'No layer' });
      s.rasterizeLayer?.(target);
      return `Rasterized ${target}`;
    },
  });

  tools.push({
    name: 'convert_to_smart_object',
    description: 'Convert the active layer into a Smart Object (image layer).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      if (!s.activeLayerId) return text({ error: 'No active layer' });
      s.updateLayer?.(s.activeLayerId, { type: 'image' });
      return 'Converted to smart object';
    },
  });

  tools.push({
    name: 'layer_style',
    description: 'Open the Layer Style dialog at the specified tab.',
    inputSchema: {
      type: 'object',
      properties: { tab: { type: 'string', description: 'Tab to open (default: blending)' } },
    },
    execute: async ({ tab }: { tab?: string } = {}) => {
      const s = useStore.getState();
      s.setIsLayerStyleDialogOpen?.(true);
      s.setLayerStyleActiveTab?.(tab as any || 'blending');
      return `Layer Style opened (${tab || 'blending'})`;
    },
  });

  // --- Selection operations ---
  tools.push({
    name: 'select_all',
    description: 'Select the entire canvas.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.selectAll === 'function') {
        bridge.selectAll();
        return 'Select All applied';
      }
      const s = useStore.getState();
      s.setSelectionRect?.({ x: 0, y: 0, w: s.documentSize.w, h: s.documentSize.h }, 'rect');
      return 'Select All applied';
    },
  });

  tools.push({
    name: 'deselect',
    description: 'Clear the current selection.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.deselect === 'function') {
        bridge.deselect();
        return 'Deselected';
      }
      const s = useStore.getState();
      s.setSelectionRect?.(null);
      s.setLassoPaths?.([]);
      return 'Deselected';
    },
  });

  tools.push({
    name: 'reselect',
    description: 'Restore the previous selection.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().reselect?.();
      return 'Reselected';
    },
  });

  tools.push({
    name: 'inverse_selection',
    description: 'Invert the current selection (select everything that was unselected and vice versa).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().inverseSelection?.();
      return 'Inverted';
    },
  });

  tools.push({
    name: 'select_subject',
    description: 'Run AI subject detection and select the detected subject.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.selectSubject === 'function') {
        await bridge.selectSubject();
        return 'Subject selected';
      }
      window.dispatchEvent(new CustomEvent('select-subject'));
      return 'Subject selection triggered';
    },
  });

  tools.push({
    name: 'select_sky',
    description: 'Run AI sky detection and select the sky region.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      window.dispatchEvent(new CustomEvent('select-sky'));
      return 'Sky selection triggered';
    },
  });

  tools.push({
    name: 'remove_background',
    description: 'Run AI background removal on the active layer.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const bridge = getBridge();
      if (typeof bridge.removeBackground === 'function') {
        await bridge.removeBackground();
        return 'Background removed';
      }
      window.dispatchEvent(new CustomEvent('remove-background'));
      return 'Background removal triggered';
    },
  });

  tools.push({
    name: 'color_range',
    description: 'Open the Color Range dialog for selecting by color.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsColorRangeDialogOpen(true);
      return 'Color Range dialog opened';
    },
  });

  tools.push({
    name: 'modify_selection',
    description: 'Modify the current selection (expand, contract, border, smooth).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: [...SELECTION_MODIFICATIONS] as unknown as string[] },
        amount: { type: 'number', description: 'Amount in pixels' },
      },
      required: ['type', 'amount'],
    },
    execute: async ({ type, amount }: { type: typeof SELECTION_MODIFICATIONS[number]; amount: number }) => {
      useStore.getState().modifySelection?.(type, amount);
      return `Selection ${type} by ${amount}px`;
    },
  });

  tools.push({
    name: 'feather_selection',
    description: 'Apply a feather (soft edge) to the current selection.',
    inputSchema: {
      type: 'object',
      properties: { radius: { type: 'number', description: 'Feather radius in pixels' } },
      required: ['radius'],
    },
    execute: async ({ radius }: { radius: number }) => {
      useStore.getState().setSelectionFeather?.(radius);
      return `Selection feathered by ${radius}px`;
    },
  });

  tools.push({
    name: 'transform_selection',
    description: 'Open the Transform Selection dialog.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setIsTransformSelectionDialogOpen(true);
      return 'Transform Selection dialog opened';
    },
  });

  // --- Filter operations ---
  tools.push({
    name: 'apply_filter',
    description:
      'Apply a filter to the active layer. Some filters open a parameter dialog; others apply immediately with default settings.',
    inputSchema: {
      type: 'object',
      properties: { type: { type: 'string', enum: [...FILTER_TYPES] as unknown as string[] } },
      required: ['type'],
    },
    execute: async ({ type }: { type: string }) => {
      useStore.getState().applyFilterAction?.(type);
      return `Filter ${type} applied`;
    },
  });

  // --- View ---
  tools.push({
    name: 'set_zoom',
    description: 'Set the canvas zoom level (1 = 100%).',
    inputSchema: {
      type: 'object',
      properties: { zoom: { type: 'number', description: 'Zoom factor (0.1 to 32)' } },
      required: ['zoom'],
    },
    execute: async ({ zoom }: { zoom: number }) => {
      const z = Math.max(0.1, Math.min(32, zoom));
      useStore.getState().setZoom(z);
      return `Zoom set to ${z.toFixed(3)} (${(z * 100).toFixed(0)}%)`;
    },
  });

  tools.push({
    name: 'zoom_in',
    description: 'Zoom in by 25%.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setZoom?.(Math.max(0.1, Math.min(32, (s.zoom || 1) * 1.25)));
      return 'Zoomed in';
    },
  });

  tools.push({
    name: 'zoom_out',
    description: 'Zoom out by 25%.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setZoom?.(Math.max(0.1, Math.min(32, (s.zoom || 1) / 1.25)));
      return 'Zoomed out';
    },
  });

  tools.push({
    name: 'zoom_fit',
    description: 'Fit the entire document on screen.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      const { w, h } = s.documentSize;
      const padding = 40;
      const availableW = window.innerWidth - 300;
      const availableH = window.innerHeight - 150;
      const zoom = Math.min((availableW - padding) / w, (availableH - padding) / h);
      s.setZoom?.(zoom);
      s.setCanvasOffset?.({ x: 0, y: 0 });
      return `Fit at ${zoom.toFixed(3)}`;
    },
  });

  tools.push({
    name: 'zoom_100',
    description: 'Set zoom to actual pixels (100%).',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      useStore.getState().setZoom(1);
      return 'Zoomed to 100%';
    },
  });

  tools.push({
    name: 'set_screen_mode',
    description: 'Change the screen mode (standard, full screen with menu bar, or full screen).',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: [...SCREEN_MODES] as unknown as string[] } },
      required: ['mode'],
    },
    execute: async ({ mode }: { mode: typeof SCREEN_MODES[number] }) => {
      useStore.getState().setScreenMode?.(mode as any);
      return `Screen mode: ${mode}`;
    },
  });

  tools.push({
    name: 'toggle_panel',
    description: 'Show or hide a workspace panel (layers, history, properties, …).',
    inputSchema: {
      type: 'object',
      properties: { panel: { type: 'string', enum: [...PANEL_KEYS] as unknown as string[] } },
      required: ['panel'],
    },
    execute: async ({ panel }: { panel: string }) => {
      useStore.getState().togglePanel?.(panel as any);
      return `Toggled panel: ${panel}`;
    },
  });

  tools.push({
    name: 'set_snap',
    description: 'Enable or disable snapping for guides, layers, or document bounds.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', enum: ['guides', 'layers', 'documentBounds'] as unknown as string[] },
        enabled: { type: 'boolean' },
      },
      required: ['target', 'enabled'],
    },
    execute: async ({ target, enabled }: { target: 'guides' | 'layers' | 'documentBounds'; enabled: boolean }) => {
      useStore.getState().setSnapSetting?.(target, enabled);
      return `Snap ${target} = ${enabled}`;
    },
  });

  tools.push({
    name: 'toggle_rulers',
    description: 'Show or hide the rulers.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setShowRulers(!s.showRulers);
      return 'Rulers toggled';
    },
  });

  tools.push({
    name: 'toggle_grid',
    description: 'Show or hide the grid.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setShowGrid(!s.showGrid);
      return 'Grid toggled';
    },
  });

  tools.push({
    name: 'toggle_guides',
    description: 'Show or hide the guides.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      const s = useStore.getState();
      s.setShowGuides(!s.showGuides);
      return 'Guides toggled';
    },
  });

  tools.push({
    name: 'set_grid',
    description: 'Configure the grid (color, type, gap, subdivisions).',
    inputSchema: {
      type: 'object',
      properties: {
        color: { type: 'string', description: 'Hex color (e.g. #808080)' },
        type: { type: 'string', enum: [...GRID_TYPES] as unknown as string[] },
        gapX: { type: 'number', description: 'Horizontal gap in pixels' },
        gapY: { type: 'number', description: 'Vertical gap in pixels' },
        subdivisions: { type: 'number' },
      },
    },
    execute: async (args: { color?: string; type?: typeof GRID_TYPES[number]; gapX?: number; gapY?: number; subdivisions?: number }) => {
      const s = useStore.getState();
      if (args.color) s.setGridColor?.(args.color);
      if (args.type) s.setGridType?.(args.type as any);
      if (typeof args.gapX === 'number') s.setGridGapX?.(args.gapX);
      if (typeof args.gapY === 'number') s.setGridGapY?.(args.gapY);
      if (typeof args.subdivisions === 'number') s.setGridSubdivision?.(args.subdivisions);
      return 'Grid updated';
    },
  });

  // --- Window / workspace ---
  tools.push({
    name: 'set_workspace',
    description: 'Switch the workspace layout (Essentials, Photography, Graphic & Web).',
    inputSchema: {
      type: 'object',
      properties: { workspace: { type: 'string', enum: [...WORKSPACES] as unknown as string[] } },
      required: ['workspace'],
    },
    execute: async ({ workspace }: { workspace: typeof WORKSPACES[number] }) => {
      useStore.getState().setWorkspace?.(workspace as any);
      return `Workspace: ${workspace}`;
    },
  });

  tools.push({
    name: 'set_document_layout',
    description: 'Arrange open documents: cascade, tile, or float.',
    inputSchema: {
      type: 'object',
      properties: { layout: { type: 'string', enum: [...DOCUMENT_LAYOUTS] as unknown as string[] } },
      required: ['layout'],
    },
    execute: async ({ layout }: { layout: typeof DOCUMENT_LAYOUTS[number] }) => {
      useStore.getState().setDocumentLayout?.(layout as any);
      return `Layout: ${layout}`;
    },
  });

  // --- Tools ---
  tools.push({
    name: 'set_active_tool',
    description:
      'Activate an editor tool. The full set of tools is exposed via the enum. Some tools (e.g. selection tools) keep the current selection; others reset it.',
    inputSchema: {
      type: 'object',
      properties: { tool: { type: 'string', enum: [...TOOL_NAMES] as unknown as string[] } },
      required: ['tool'],
    },
    execute: async ({ tool }: { tool: Tool }) => {
      useStore.getState().setActiveTool?.(tool);
      return `Active tool: ${tool}`;
    },
  });

  tools.push({
    name: 'set_transform_mode',
    description: 'Switch the current transform interaction mode (free, scale, rotate, skew, …).',
    inputSchema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: [...TRANSFORM_MODES] as unknown as string[] } },
      required: ['mode'],
    },
    execute: async ({ mode }: { mode: typeof TRANSFORM_MODES[number] }) => {
      useStore.getState().setTransformMode?.(mode as any);
      return `Transform mode: ${mode}`;
    },
  });

  return tools;
}

/* -------------------------------------------------------------------------- */
/*  Registration                                                              */
/* -------------------------------------------------------------------------- */

let _registered = false;
let _abortController: AbortController | null = null;
let _registrations: { abort: () => void; name: string }[] = [];

/** Whether the current document exposes `document.modelContext.registerTool`. */
export function isWebMCPAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  const mc = (document as any).modelContext;
  return Boolean(mc && typeof mc.registerTool === 'function');
}

/**
 * Register every Pixelite function as a WebMCP tool. Idempotent — subsequent
 * calls unregister the previous batch first. Safe to call in environments where
 * WebMCP is unavailable (logs once and returns).
 */
export async function initWebMCP(): Promise<{ ok: boolean; count: number; reason?: string }> {
  if (_registered) return { ok: true, count: _registrations.length };

  if (!isWebMCPAvailable()) {
    // Don't spam the console on every render in non-supporting browsers
    if (!(globalThis as any).__pixelite_webmcp_warned) {
      (globalThis as any).__pixelite_webmcp_warned = true;
      // eslint-disable-next-line no-console
      console.info('[WebMCP] document.modelContext is not available — tools not registered.');
    }
    return { ok: false, count: 0, reason: 'unavailable' };
  }

  const tools = buildTools();
  _abortController = new AbortController();
  const mc = (document as any).modelContext;

  for (const tool of tools) {
    try {
      // The imperative API accepts: { name, description, inputSchema, annotations, execute }
      await mc.registerTool(
        {
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
          execute: tool.execute,
        },
        { signal: _abortController.signal },
      );
      _registrations.push({ name: tool.name, abort: () => _abortController?.abort() });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[WebMCP] failed to register tool "${tool.name}":`, err);
    }
  }

  _registered = true;
  // eslint-disable-next-line no-console
  console.info(`[WebMCP] registered ${_registrations.length} tool(s).`);
  return { ok: true, count: _registrations.length };
}

/** Unregister every tool previously registered by initWebMCP. */
export function teardownWebMCP(): void {
  if (!_registered) return;
  try { _abortController?.abort(); } catch { /* noop */ }
  _abortController = null;
  _registrations = [];
  _registered = false;
}

export const __webmcp_tools = buildTools;

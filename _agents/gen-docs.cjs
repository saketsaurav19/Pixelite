#!/usr/bin/env node
/**
 * gen-docs.cjs
 * Generates rich markdown documentation for every .ts/.tsx file in src/,
 * mirroring the src/ directory structure under docs/src/.
 *
 * Run: node _agents/gen-docs.cjs
 */

const fs   = require('fs');
const path = require('path');

const SRC_DIR  = path.resolve(__dirname, '..', 'src');
const DOCS_DIR = path.resolve(__dirname, '..', 'docs', 'src');

// ─── helpers ─────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.d.ts')) out.push(full);
  }
  return out;
}

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─── extractors ──────────────────────────────────────────────────────────────

function extractImports(src) {
  const imports = [];
  const re = /import\s+(?:type\s+)?(?:{([^}]*)}|(\w+)(?:\s*,\s*{([^}]*)})?)?\s*from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const named  = (m[1] || m[3] || '').split(',').map(s => s.trim()).filter(Boolean);
    const def    = m[2] ? m[2].trim() : null;
    const from   = m[4].trim();
    if (def) named.unshift(def);
    imports.push({ from, names: named });
  }
  return imports;
}

/** Walk backwards from `pos` to find a preceding /** ... *\/ JSDoc block */
function extractJsDoc(src, pos) {
  const before    = src.slice(0, pos);
  const trimmedAfterClose = before.slice(before.lastIndexOf('*/') + 2).trim();
  if (trimmedAfterClose.length > 0) return '';
  const jsdocEnd   = before.lastIndexOf('*/');
  if (jsdocEnd === -1) return '';
  const jsdocStart = before.lastIndexOf('/**', jsdocEnd);
  if (jsdocStart === -1) return '';
  return before.slice(jsdocStart, jsdocEnd + 2)
    .replace(/^\/\*\*\s*/m, '').replace(/\s*\*\/$/m, '')
    .replace(/^\s*\*\s?/gm, '').trim();
}

/** Find the first real file-level comment (skip @ts-ignore style single lines) */
function extractTopComment(src) {
  // Multi-line JSDoc at very top
  const m = src.match(/^\/\*\*([\s\S]*?)\*\//);
  if (m) {
    const text = m[1].replace(/^\s*\*\s?/gm, '').trim();
    if (text.length > 20 && !text.startsWith('@')) return text;
  }
  // Single-line comment that is meaningful
  const lines = src.split('\n');
  for (const line of lines.slice(0, 5)) {
    const stripped = line.replace(/^\/\/\s*/, '').trim();
    if (stripped.length > 15 && !stripped.startsWith('@') && !/^[A-Z_]{2,}/.test(stripped)) {
      return stripped;
    }
  }
  return '';
}

function extractFunctions(src) {
  const fns = [];
  const seen = new Set();

  const add = (obj) => {
    if (!seen.has(obj.name)) { seen.add(obj.name); fns.push(obj); }
  };

  // export (async) function name(...): ret {
  const fnRe = /export\s+(default\s+)?(?:async\s+)?function\s+(\w+)\s*(<[^>]*>)?\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)\s*(?::\s*([^{]+?))?\s*\{/g;
  let m;
  while ((m = fnRe.exec(src)) !== null) {
    add({ kind: 'function', name: m[2], params: m[4].trim(), returns: (m[5]||'').trim(), jsdoc: extractJsDoc(src, m.index), isDefault: !!m[1] });
  }

  // export const name = async (...): ret =>
  const arrowRe = /export\s+const\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\(([^)]*(?:\([^)]*\)[^)]*)*)\)\s*(?::\s*([^=>{]+?))?\s*=>/g;
  while ((m = arrowRe.exec(src)) !== null) {
    add({ kind: 'arrow', name: m[1], params: m[2].trim(), returns: (m[3]||'').trim(), jsdoc: extractJsDoc(src, m.index) });
  }

  // React.FC components: export const Name: React.FC<Props> = ...
  const compRe = /export\s+const\s+(\w+)\s*:\s*React\.(?:FC|memo|ForwardRefExoticComponent|MemoExoticComponent)[^=]*=/g;
  while ((m = compRe.exec(src)) !== null) {
    add({ kind: 'component', name: m[1], params: 'props', returns: 'JSX.Element', jsdoc: extractJsDoc(src, m.index) });
  }

  // Non-exported functions that are important (called multiple times)
  const localFnRe = /(?:^|\n)(?:async\s+)?function\s+(\w+)\s*\(/g;
  while ((m = localFnRe.exec(src)) !== null) {
    if (seen.has(m[1])) continue;
    const useCount = (src.match(new RegExp(`\\b${m[1]}\\b`, 'g')) || []).length;
    if (useCount > 2) {
      add({ kind: 'internal', name: m[1], params: '', returns: '', jsdoc: extractJsDoc(src, m.index) });
    }
  }

  return fns;
}

function extractInterfaces(src) {
  const items = [];
  const re = /export\s+(?:interface|type)\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?\{([^}]*)\}/gs;
  let m;
  while ((m = re.exec(src)) !== null) {
    const body = m[2].trim().split('\n').map(l => l.trim()).filter(Boolean);
    items.push({ name: m[1], body });
  }
  return items;
}

function extractConstants(src) {
  const items = [];
  const re = /^export\s+const\s+([A-Z_][A-Z0-9_]*)\s*(?::\s*[^=]+)?\s*=\s*([^;\n]+)/mg;
  let m;
  while ((m = re.exec(src)) !== null) {
    items.push({ name: m[1], value: m[2].trim().slice(0, 100) });
  }
  return items;
}

function extractStateVars(src) {
  const vars = [];
  let m;
  const stateRe = /const\s+\[(\w+),\s*set\w+\]\s*=\s*useState[<(]/g;
  while ((m = stateRe.exec(src)) !== null) {
    const count = (src.match(new RegExp(`\\b${m[1]}\\b`, 'g')) || []).length;
    vars.push({ name: m[1], kind: 'state', count });
  }
  const refRe = /const\s+(\w+)\s*=\s*useRef[<(]/g;
  while ((m = refRe.exec(src)) !== null) {
    const count = (src.match(new RegExp(`\\b${m[1]}\\b`, 'g')) || []).length;
    vars.push({ name: m[1], kind: 'ref', count });
  }
  const memoRe = /const\s+(\w+)\s*=\s*useMemo\(/g;
  while ((m = memoRe.exec(src)) !== null) {
    const count = (src.match(new RegExp(`\\b${m[1]}\\b`, 'g')) || []).length;
    vars.push({ name: m[1], kind: 'memo', count });
  }
  return vars;
}

// ─── purpose resolver ─────────────────────────────────────────────────────────

const PURPOSE_MAP = {
  'App.tsx':                          'Root React component — app shell, global layout, event wiring. Renders the toolbar, canvas, menus, all dialogs, and the tab bar. Manages top-level state connections between Zustand and child components.',
  'main.tsx':                         'Application entry point. Mounts the React root into `#root`, registers the Vite PWA service worker, and boots the scripting engine.',
  'sw.ts':                            'Service Worker — caches app assets for offline use via Workbox/vite-plugin-pwa.',

  'store/types.ts':                   'Master TypeScript type definitions for the entire Zustand store. Defines `Layer`, `Document`, `Tool`, `HistoryEntry`, `SelectionState`, `BrushSettings`, and all supporting types used across the whole app.',
  'store/useStore.ts':                'Central Zustand store. Combines all slices (layers, tools, history, UI, lighting, selection, document) into a single `useStore` hook used throughout the app.',
  'store/slices/layerSlice.ts':       'Zustand slice — layer CRUD, ordering, visibility, locking, opacity, blending, grouping, and masking state.',
  'store/slices/historySlice.ts':     'Zustand slice — undo/redo history stack. Stores snapshots of the layer state and exposes `undo()` / `redo()` actions.',
  'store/slices/toolSlice.ts':        'Zustand slice — currently active tool, brush settings, opacity, hardness, color picker state.',
  'store/slices/uiSlice.ts':          'Zustand slice — panel visibility, dialog open/close flags, zoom level, scroll offsets, ruler visibility.',
  'store/slices/selectionSlice.ts':   'Zustand slice — pixel selection mask, selection bounds, feather, and anti-alias settings.',
  'store/slices/lightingSlice.ts':    'Zustand slice — 3D lighting rig state (lights array, intensity, normal map settings).',
  'store/slices/documentSlice.ts':    'Zustand slice — document metadata (width, height, resolution, color mode, background color).',

  'components/Canvas/Canvas.tsx':               'Main canvas orchestrator component. Wires together rendering hooks, event handlers, overlays, and the `<canvas>` element. Manages zoom/pan, layer compositing, and WebGPU vs 2D fallback.',
  'components/Canvas/types.ts':                 'Local TypeScript types specific to the Canvas component (tool modes, event payload shapes).',
  'components/Canvas/Core/colorUtils.ts':       'Pure color utility functions: hex↔RGB↔HSL conversion, color mixing, opacity blending, luminance calculation. No React, no side effects.',
  'components/Canvas/Core/coordUtils.ts':       'Canvas coordinate utilities: converts screen↔canvas space accounting for zoom/pan/devicePixelRatio.',
  'components/Canvas/Core/cropUtils.ts':        'Crop tool geometry utilities: aspect ratio locking, handle hit-testing, crop rect clamping to canvas bounds.',
  'components/Canvas/Core/cursorUtils.ts':      'Returns the correct CSS cursor string for each tool mode and canvas interaction state.',
  'components/Canvas/Core/edgeUtils.ts':        'Edge detection utilities used by the Magic Wand and Quick Selection tools (Sobel filter on ImageData).',
  'components/Canvas/Core/eventUtils.ts':       'Shared event helper utilities: pointer normalization, modifier key detection, drag threshold checks.',
  'components/Canvas/Core/gradientUtils.ts':    'Renders linear/radial/angle/reflected gradients onto a canvas ImageData buffer.',
  'components/Canvas/Core/paintBucketUtils.ts': 'Flood-fill algorithm (paint bucket tool) using a scanline BFS on ImageData pixels.',
  'components/Canvas/Core/pathUtils.ts':        'Bezier path utilities for the Pen tool: path building, anchor manipulation, segment subdivision.',
  'components/Canvas/Core/selectionUtils.ts':   'Selection mask utilities: marching-ants animation tick, selection expand/contract/feather, Boolean combine/subtract/intersect.',
  'components/Canvas/Core/textUtils.ts':        'Text layout helpers: measures text on a canvas, wraps text to a bounding box, builds text layer metadata from user input.',
  'components/Canvas/Core/toolUtils.ts':        'General tool utilities: resolves active tool from store, determines if a tool is a painting/selection/vector tool.',

  'components/Canvas/Events/interactionHandlers.ts': 'Pointer event handlers (mousedown/move/up) for all canvas tools. Dispatches to the correct tool logic based on the active tool.',
  'components/Canvas/Events/touchHandlers.ts':       'Touch and gesture event handlers: pinch-to-zoom, two-finger pan, tap for touch devices.',

  'components/Canvas/Rendering/useLayerRendering.ts':    'React hook — composites all layers onto the main 2D canvas in the correct blend mode/opacity order on every relevant state change.',
  'components/Canvas/Rendering/useLighting.ts':          'React hook — drives the WebGPU lighting pass (normal map generation + Phong shading) and writes the result back to the canvas.',
  'components/Canvas/Rendering/useSelectionAnimation.ts':'React hook — animates the marching-ants selection border using requestAnimationFrame.',
  'components/Canvas/Rendering/useTextRendering.ts':     'React hook — re-renders active text layers onto the canvas when text content, font, or style changes.',
  'components/Canvas/Rendering/useThumbnailGeneration.ts':'React hook — debounced layer thumbnail generation into 64×64 canvases shown in the Layers panel.',

  'components/Canvas/UI/CanvasLayer.tsx':           'Renders a single layer\'s visual content as a DOM element (for text/vector layers). The `VectorTextLayer` sub-component uses HarfBuzz WASM shaping to render text as CSS-positioned `<span>` elements.',
  'components/Canvas/UI/ArtboardOverlay.tsx':       'SVG overlay that draws artboard boundaries and labels.',
  'components/Canvas/UI/CropOverlay.tsx':           'Interactive crop overlay: draws crop rect handles, rule-of-thirds grid, and handles drag interactions to resize/move the crop area.',
  'components/Canvas/UI/DraftOverlay.tsx':          'Renders in-progress stroke drafts (brush, pencil, eraser) before they are committed to the layer canvas.',
  'components/Canvas/UI/GlobalRulers.tsx':          'Horizontal and vertical pixel rulers with guide line dragging support.',
  'components/Canvas/UI/LightingOverlay.tsx':       'Interactive overlay for placing and adjusting 3D light sources by dragging on the canvas.',
  'components/Canvas/UI/PerspectiveCropOverlay.tsx':'Handles the perspective crop tool overlay with 4-corner warp handles.',
  'components/Canvas/UI/RulerOverlay.tsx':          'Ruler guide lines overlaid on the canvas (dragged out from the rulers).',
  'components/Canvas/UI/SelectionOverlay.tsx':      'Renders the marching-ants selection border as an SVG or canvas path on top of the image.',
  'components/Canvas/UI/SVGFilters.tsx':            'Injects a hidden `<svg>` with filter definitions (e.g. feComponentTransfer) referenced by CSS filter properties on canvas layers.',
  'components/Canvas/UI/TextEditorOverlay.tsx':     'The in-canvas text editing overlay — renders a transparent `<div contenteditable>` over text layers for live editing.',
  'components/Canvas/UI/VectorOverlay.tsx':         'SVG overlay for pen/vector tool: draws path anchors, handles, and segments as the user constructs a vector path.',
  'components/Canvas/UI/WorkflowStatus.tsx':        'Small status indicator UI showing async operation progress (e.g. "Processing AI…").',

  'components/Dialogs/CameraDialog.tsx':          'Camera capture dialog for desktop — accesses getUserMedia, shows preview, and captures a frame as a new layer.',
  'components/Dialogs/ExportAsDialog.tsx':        'Export As dialog: format picker (PNG, JPEG, WebP, PSD), quality/resolution sliders, and triggers ExportEngine.',
  'components/Dialogs/FileInfoDialog.tsx':        'Document info dialog — shows pixel dimensions, resolution, color mode, and embedded EXIF metadata.',
  'components/Dialogs/MobileCameraDialog.tsx':    'Mobile-optimized camera capture dialog with portrait/landscape handling.',
  'components/Dialogs/NewDocumentDialog.tsx':     'New Document dialog: preset sizes, custom W×H, resolution, color mode, background color.',
  'components/Dialogs/OpenFromCloudDialog.tsx':   'Open From Cloud dialog — lists cloud-saved projects and opens them.',
  'components/Dialogs/OpenRecentDialog.tsx':      'Open Recent dialog — lists recently opened files from RecentProjectsStorage.',
  'components/Dialogs/SignatureDialog.tsx':       'Signature/handwriting capture dialog: draw-on-canvas capture, style options, inserts result as a new layer.',

  'components/MenuSystem/menus/edit/core.ts':     'Edit menu actions: Cut, Copy, Paste, Delete, Fill, Stroke, Preferences.',
  'components/MenuSystem/menus/edit/transform.ts':'Transform sub-menu actions: Free Transform, Scale, Rotate, Flip, Distort, Perspective.',
  'components/MenuSystem/menus/image/adjustments.ts':'Image > Adjustments sub-menu: Brightness/Contrast, Hue/Saturation, Curves, Levels, Color Balance.',
  'components/MenuSystem/menus/image/canvas.ts':  'Image > Canvas sub-menu: Canvas Size, Crop, Trim, Rotate Canvas.',
  'components/MenuSystem/menus/image/mode.ts':    'Image > Mode sub-menu: RGB, Grayscale, CMYK, Indexed color mode switching.',
  'components/MenuSystem/menus/layer/management.ts':'Layer menu management actions: New Layer, Duplicate, Delete, Merge, Flatten.',
  'components/MenuSystem/menus/layer/styles.ts':  'Layer > Layer Style sub-menu actions: Drop Shadow, Inner Shadow, Stroke, Bevel/Emboss.',
  'components/MenuSystem/menus/types.ts':         'TypeScript types for the menu system: `MenuItem`, `MenuSection`, `MenuAction`.',

  'pdf/PdfImportManager.ts':                      'Entry point for importing a PDF file. Orchestrates the worker pipeline: parse → extract scene → convert to layers → push to store.',
  'pdf/parser/PdfjsParser.ts':                    'Core PDF.js wrapper. Loads a PDF, iterates pages, extracts operator lists (drawing commands), and emits them to the engine adapter.',
  'pdf/parser/PdfFullExtractor.ts':               'Full-page content extractor — collects all text, images, and vector items from all PDF pages into a flat list.',
  'pdf/parser/GraphicsState.ts':                  'Tracks the PDF graphics state machine (CTM matrix, fill/stroke color, opacity, clip) as the operator list is processed.',
  'pdf/parser/check_ctm.ts':                      'Debug utility: prints the Current Transformation Matrix at each operator step — used for diagnosing coordinate transform issues.',
  'pdf/parser/cli-extractor.ts':                  'CLI tool for running the PDF extractor outside the browser (Node.js + JSDOM polyfill).',
  'pdf/sceneGraph/LayerConversion.ts':            'Converts the raw `SceneNode[]` tree output from the parser engines into Pixelite `Layer[]` objects compatible with the Zustand store.',
  'pdf/types/SceneNode.ts':                       'TypeScript types for the intermediate PDF scene graph: `SceneNode`, `TextNode`, `VectorNode`, `ImageNode`, `TableNode`.',
  'pdf/types/PdfEngineAdapter.ts':                'Interface and types for the PDF engine adapter pattern (allows swapping the underlying PDF library).',
  'pdf/worker/engines/TextEngine.ts':             'Extracts text from a PDF page: font lookup, character decoding, glyph positioning, run merging, shaping hints, bidi direction.',
  'pdf/worker/engines/VectorEngine.ts':           'Extracts vector paths (lines, curves, rectangles, clips) from PDF operator streams, converting to SVG-compatible path data.',
  'pdf/worker/engines/ImageEngine.ts':            'Extracts and decodes raster images from PDF XObject streams (JPEG, PNG, raw bitmap).',
  'pdf/worker/engines/TableEngine.ts':            'Detects table structures from text and vector data using heuristic grid analysis.',
  'pdf/worker/engines/AnnotationEngine.ts':       'Extracts PDF annotations (highlights, comments, form fields, links).',
  'pdf/worker/engines/MetadataEngine.ts':         'Extracts document-level PDF metadata (author, title, creation date, XMP).',
  'pdf/worker/engines/FontRegistry.ts':           'In-memory registry of fonts extracted from the PDF. Maps font checksum → font data (ArrayBuffer) + name. Used by TextEngine and WasmShaper.',
  'pdf/worker/engines/WasmShaper.ts':             'HarfBuzz WASM text shaping engine. Takes a Unicode string + font + font size, runs it through HarfBuzz (via harfbuzzjs) with bidi reordering, per-script segmentation (Latin/Devanagari/Arabic/Hebrew), and UAX#9 L2 visual reorder. Exports `shapeTextWasm` (SVG path glyphs) and `shapeTextToRuns` (character cluster positions for CSS span rendering).',
  'pdf/worker/engines/PdfjsEngineAdapter.ts':     'Adapter that wraps PDF.js\'s `getOperatorList()` output into the internal engine interface expected by the extraction engines.',
  'pdf/worker/pdf.worker.ts':                     'Web Worker entry point for the PDF pipeline. Receives import requests from the main thread and runs the full extraction pipeline off-thread.',
  'pdf/worker/PdfWorkerClient.ts':                'Main-thread client for the PDF Web Worker. Sends import requests and receives the resulting layer data.',

  'scripting/Application.ts':   'Implements the Photoshop-compatible `app` global object for the scripting API.',
  'scripting/Document.ts':      'Implements the Photoshop-compatible `Document` scripting API object.',
  'scripting/ArtLayer.ts':      'Implements the Photoshop-compatible `ArtLayer` scripting API object.',
  'scripting/index.ts':         'Scripting engine bootstrapper — installs `app`, `Document`, `ArtLayer` globals into the scripting sandbox.',

  'services/export/ExportEngine.ts':       'Handles final image export: composites layers, applies transforms, encodes to PNG/JPEG/WebP/PSD.',
  'services/export/WorkerExportBridge.ts': 'Offloads heavy export encoding to a worker thread.',
  'services/import/ImportEngine.ts':       'Handles file import dispatch: routes PNG/JPEG/GIF/WebP/SVG/PSD/PDF to their respective parsers.',
  'services/file/FileSystemService.ts':    'File System Access API wrapper: open/save file pickers, drag-and-drop file reading.',
  'services/storage/RecentProjectsStorage.ts': 'Persists the list of recently opened projects in localStorage/IndexedDB.',
  'services/advanced/AutosaveManager.ts':  'Periodic auto-save of the current document to IndexedDB (via localforage).',
  'services/advanced/CloudSyncManager.ts': 'Cloud sync integration: uploads/downloads project files to/from cloud storage.',
  'services/advanced/ScriptEngine.ts':     'Sandboxed JavaScript execution engine for running Photoshop-style action scripts.',

  'tools/types.ts':                        'TypeScript types for the tools system: `ToolDefinition`, `ToolOptions`, `ToolContext`.',
  'tools/index.ts':                        'Tool registry — exports the complete list of all registered tools.',
  'tools/toolState.ts':                    'Tool state machine: tracks current tool phase (idle/drawing/done), drag state, and modifier keys.',
  'tools/Artboard/artboardTool.ts':        'Artboard tool: creates, resizes, and names artboard regions on the canvas.',
  'tools/Painting/paintingTools.ts':       'Painting tools: Brush, Pencil, Eraser, Color Replacement — implement stroke rendering on the active layer.',
  'tools/Retouching/retouchingTools.ts':   'Retouching tools: Smudge, Dodge, Burn, Sponge — apply pixel-level adjustments along a stroke.',
  'tools/Retouching/exposureTools.ts':     'Exposure adjustment tools: Dodge (lighten), Burn (darken), Sponge (saturate/desaturate).',
  'tools/Retouching/healingTools.ts':      'Healing tools: Spot Healing Brush, Healing Brush, Patch — clone + blend to remove blemishes.',
  'tools/Selection/marqueeTools.ts':       'Rectangular and Elliptical Marquee selection tools.',
  'tools/Selection/lassoTools.ts':         'Lasso, Polygonal Lasso, and Magnetic Lasso selection tools.',
  'tools/Selection/magicWandTool.ts':      'Magic Wand tool — selects contiguous pixels within a tolerance range using flood fill.',
  'tools/Selection/quickSelectionTool.ts': 'Quick Selection tool — grows a selection as the user drags using edge-aware expansion.',
  'tools/Selection/objectSelectionTool.ts':'Object Selection tool — AI-assisted selection using the SAM/ONNX model.',
  'tools/Selection/utils.ts':             'Shared selection tool utilities: hit testing, selection modifier (add/subtract/intersect) logic.',
  'tools/Transform/transformTools.ts':     'Free Transform, Scale, Rotate, Skew, Distort, Perspective Warp tools.',
  'tools/Utility/utilityTools.ts':         'Utility tools: Move, Eyedropper, Ruler, Hand (pan), Zoom.',

  'utils/canvasUtils.ts':          'Canvas utility functions: getImageData, putImageData, scaleCanvas, compositeLayersToCanvas, imageDataToDataURL.',
  'utils/layerUtils.ts':           'Layer utility functions: flatten group to canvas, apply layer mask, merge visible layers.',
  'utils/clipboardUtils.ts':       'Clipboard read/write helpers using the Clipboard API.',
  'utils/cloudServices.ts':        'Cloud service API clients (Google Drive, Dropbox, etc.) for open/save operations.',
  'utils/exifUtils.ts':            'EXIF metadata read/write using piexifjs — extracts camera info from JPEGs, injects it back on export.',
  'utils/metadataInjectors.ts':    'Injects custom metadata (author, tags, description) into exported image files.',
  'utils/svgUtils.ts':             'SVG parsing and manipulation utilities — converts SVG paths to canvas paths.',
  'utils/webgpu/gpuDevice.ts':     'WebGPU device singleton — initializes and caches the GPUDevice and GPUAdapter.',
  'utils/webgpu/LightingRenderer.ts': 'WebGPU lighting renderer — runs the Phong shading compute pass using a normal map texture.',
  'utils/webgpu/lightingShader.ts': 'WGSL shader source for the WebGPU lighting pass (Phong + ambient occlusion).',
  'utils/webgpu/LightManager.ts':  'Manages the array of lights sent as a uniform buffer to the WebGPU lighting shader.',
  'utils/webgpu/NormalGenerator.ts':'Generates a normal map from the composited canvas using a Sobel filter on the GPU.',
  'utils/webgpu/normalMapShader.ts':'WGSL shader source for the GPU normal-map generation pass.',
  'utils/ml/DepthProcessor.ts':   'Runs the MiDaS depth estimation ONNX model on the canvas image to produce a depth map used for pseudo-3D lighting.',

  'hooks/useFileImporter.ts':      'Custom hook: wires file input, drag-and-drop, and paste events to the ImportEngine.',
  'workers/fileWorker.ts':         'Web Worker for heavy file I/O: reads large files, encodes/decodes image data off the main thread.',
};

function guessPurpose(relPath, topComment) {
  const normalized = relPath.replace(/\\/g, '/');

  // Exact match
  for (const [key, val] of Object.entries(PURPOSE_MAP)) {
    if (normalized === key || normalized.endsWith('/' + key)) return val;
  }

  // Fall back to smart inference from path
  if (normalized.includes('store/slices/'))        return `Zustand state slice — manages ${path.basename(normalized, '.md').replace('Slice','')} state.`;
  if (normalized.includes('worker/engines/'))      return `PDF extraction engine — extracts ${path.basename(normalized, '.md').replace('Engine','')} data from PDF pages.`;
  if (normalized.includes('components/Canvas/Core/')) return 'Pure utility functions for canvas operations — no React, no side effects.';
  if (normalized.includes('components/Canvas/Rendering/')) return 'React hook that drives canvas rendering for a specific concern.';
  if (normalized.includes('components/Canvas/UI/')) return 'React component rendered on top of the main canvas.';
  if (normalized.includes('components/MenuSystem/menus/')) return 'Menu definition — exports an array of menu items for one menu section.';
  if (normalized.includes('tools/Selection/'))    return 'Selection tool implementation.';
  if (normalized.includes('tools/'))              return 'Canvas tool implementation.';
  if (normalized.includes('services/'))           return 'Application service module.';
  if (normalized.includes('scripting/'))          return 'Photoshop-compatible scripting API object.';
  if (normalized.includes('utils/webgpu/'))       return 'WebGPU utility — GPU-accelerated rendering helper.';
  if (normalized.includes('utils/'))              return 'Pure utility module.';
  if (normalized.includes('hooks/'))              return 'Custom React hook.';

  return topComment || 'Source module.';
}

// ─── markdown generator ───────────────────────────────────────────────────────

function formatParams(params) {
  if (!params.trim()) return [];
  // Split by commas not inside angle brackets or parens
  const parts = [];
  let depth = 0, cur = '';
  for (const ch of params) {
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function generateMd(filePath) {
  const src        = fs.readFileSync(filePath, 'utf8');
  const relPath    = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  const topComment = extractTopComment(src);
  const purpose    = guessPurpose(relPath, topComment);
  const imports    = extractImports(src);
  const functions  = extractFunctions(src);
  const interfaces = extractInterfaces(src);
  const constants  = extractConstants(src);
  const stateVars  = extractStateVars(src);

  const L = [];

  // Header
  L.push(`# \`${relPath}\``);
  L.push('');
  L.push('## 📋 Purpose');
  L.push('');
  L.push(purpose);
  L.push('');

  // Source link
  const srcRelFromDocs = path.relative(DOCS_DIR, filePath).replace(/\\/g, '/');
  L.push(`> **Source file:** \`src/${relPath}\``);
  L.push('');

  // ── Imports ──────────────────────────────────────────────────────────────
  if (imports.length > 0) {
    L.push('---');
    L.push('## 📦 Imports & Dependencies');
    L.push('');
    L.push('| From | What is imported |');
    L.push('|------|-----------------|');
    for (const imp of imports) {
      const names = imp.names.length ? `\`${imp.names.join('`, `')}\`` : '*(side-effect only)*';
      const isLocal = imp.from.startsWith('.');
      const from = isLocal ? `\`${imp.from}\`` : `[\`${imp.from}\`](https://www.npmjs.com/package/${imp.from.split('/')[0]})`;
      L.push(`| ${from} | ${names} |`);
    }
    L.push('');
  }

  // ── Exports: Functions & Components ──────────────────────────────────────
  if (functions.length > 0) {
    L.push('---');
    L.push('## 🔧 Functions & Components');
    L.push('');

    for (const fn of functions) {
      const emoji = fn.kind === 'component' ? '⚛️' : fn.kind === 'internal' ? '🔒' : fn.kind === 'arrow' ? '➡️' : '🔵';
      const kindLabel = { component: 'React Component', arrow: 'Arrow Function', function: 'Function', internal: 'Internal Function' }[fn.kind];
      L.push(`### ${emoji} \`${fn.name}\``);
      L.push('');
      L.push(`**Type:** ${kindLabel}`);
      L.push('');

      if (fn.jsdoc) {
        L.push(`**Description:**`);
        L.push('');
        L.push(fn.jsdoc.split('\n').map(l => `> ${l}`).join('\n'));
        L.push('');
      }

      const params = formatParams(fn.params);
      if (params.length > 0 && fn.kind !== 'component') {
        L.push('**Parameters:**');
        L.push('');
        L.push('| Name | Type |');
        L.push('|------|------|');
        for (const p of params) {
          const colonIdx = p.indexOf(':');
          if (colonIdx > -1) {
            const name = p.slice(0, colonIdx).trim().replace(/^\.\.\./, '...');
            const type = p.slice(colonIdx + 1).trim();
            L.push(`| \`${name}\` | \`${type.slice(0, 80)}\` |`);
          } else {
            L.push(`| \`${p}\` | *(inferred)* |`);
          }
        }
        L.push('');
      }

      if (fn.returns) {
        L.push(`**Returns:** \`${fn.returns.replace(/\s+/g,' ').slice(0,120)}\``);
        L.push('');
      }

      const useCount = (src.match(new RegExp(`\\b${fn.name}\\b`, 'g')) || []).length;
      const exportedTimes = fn.kind === 'internal' ? 0 : 1;
      const internalUses = Math.max(0, useCount - 1 - exportedTimes);
      if (internalUses > 0) L.push(`**Used internally:** ~${internalUses} time(s) in this file`);
      L.push('');
    }
  }

  // ── Interfaces & Types ────────────────────────────────────────────────────
  if (interfaces.length > 0) {
    L.push('---');
    L.push('## 📐 Interfaces & Types');
    L.push('');
    for (const iface of interfaces) {
      L.push(`### \`${iface.name}\``);
      L.push('');
      L.push('```typescript');
      for (const line of iface.body) L.push(line);
      L.push('```');
      L.push('');
    }
  }

  // ── Constants ─────────────────────────────────────────────────────────────
  if (constants.length > 0) {
    L.push('---');
    L.push('## 📌 Exported Constants');
    L.push('');
    L.push('| Name | Value |');
    L.push('|------|-------|');
    for (const c of constants) {
      L.push(`| \`${c.name}\` | \`${c.value}\` |`);
    }
    L.push('');
  }

  // ── State Variables ───────────────────────────────────────────────────────
  if (stateVars.length > 0) {
    L.push('---');
    L.push('## 🗃️ Key State Variables');
    L.push('');
    L.push('| Name | Kind | Used (times in file) |');
    L.push('|------|------|---------------------|');
    for (const v of stateVars) {
      L.push(`| \`${v.name}\` | ${v.kind} | ${v.count} |`);
    }
    L.push('');
  }

  L.push('---');
  L.push(`*Auto-generated by \`_agents/gen-docs.cjs\` · ${new Date().toISOString().slice(0,10)}*`);

  return L.join('\n');
}

// ─── main ──────────────────────────────────────────────────────────────────

const files = walk(SRC_DIR);
let count = 0;

for (const filePath of files) {
  try {
    const relPath = path.relative(SRC_DIR, filePath);
    const mdPath  = path.join(DOCS_DIR, relPath.replace(/\.(ts|tsx)$/, '.md'));
    ensureDir(path.dirname(mdPath));
    fs.writeFileSync(mdPath, generateMd(filePath), 'utf8');
    count++;
    process.stdout.write(`\r  ✓ ${count}/${files.length}  ${relPath.padEnd(60)}`);
  } catch (err) {
    console.error(`\n✗ Error on ${filePath}: ${err.message}`);
  }
}

console.log(`\n\n✅ Done! Generated ${count} markdown files → docs/src/`);

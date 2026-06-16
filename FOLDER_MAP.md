# Pixelite Codebase Map

A detailed overview of the project structure and folder organization.

## Root Directory

```
PhotoshopClone/
├── src/                  ← Primary application source code
├── public/               ← Static assets, fonts, ONNX models
├── dist/                 ← Production build output (auto-generated)
├── _agents/              ← Debug & agent scripts (NOT part of app)
├── _tests/               ← Test data, results, and screenshots
│   ├── data/             ← Sample JSON test fixtures
│   ├── results/          ← Test run output
│   └── assets/           ← Reference screenshots for visual testing
├── docs/                 ← Reference documentation (PDFs, guides)
├── chrome-extension/     ← Chrome extension source
├── .github/              ← GitHub workflow configurations
├── vite.config.ts        ← Vite configuration
├── tsconfig.json         ← TypeScript configuration
└── package.json
```

---

## Source Code (`src/`)

### Core
- `App.tsx` — Main application shell and layout
- `App.css` — Global styles and theme
- `main.tsx` — Application entry point

### Components (`src/components/`)
- `Canvas/` — Core canvas rendering and interaction logic
  - `Core/` — Canvas utilities (text utils, geometry)
  - `Rendering/` — WebGPU and 2D canvas rendering hooks
  - `UI/` — On-canvas UI elements (CanvasLayer, TextEditorOverlay, gizmos)
- `MenuBar/` — Top application menus
- `MenuSystem/` — Menu system definitions and actions
- `OptionsBar/` — Contextual tool settings
- `Toolbar/` — Left-side tool selection
- `TabBar/` — Multi-document tab management
- `Modals/` — Application dialogs (New Document, Export, etc.)
- `Dialogs/` — Specialized dialogs (SignatureDialog, etc.)
- `UI/` — Generic app UI components (AgentTestPanel, etc.)
- `shared/` — Reusable UI components (ColorPickers, Sliders)

### State Management (`src/store/`)
- `useStore.ts` — Main Zustand store
- `types.ts` — Core application type definitions
- `slices/` — Modular state slices
  - `lightingSlice.ts` — Lighting and relighting state
  - `layerSlice.ts` — Layer management
  - `toolSlice.ts` — Active tool and settings
  - `historySlice.ts` — Undo/Redo management
  - `uiSlice.ts` — UI state (panels, modals)

### PDF Engine (`src/pdf/`)
- `PdfImportManager.ts` — Entry point for PDF import
- `parser/` — PDF.js-based parsing
  - `PdfjsParser.ts` — Main PDF parser
  - `PdfFullExtractor.ts` — Full-page content extractor
- `sceneGraph/` — Converts parsed nodes to layers
  - `LayerConversion.ts` — Node-to-layer conversion
- `worker/engines/` — Specialized extraction engines
  - `TextEngine.ts` — Text extraction and shaping
  - `VectorEngine.ts` — Vector/path extraction
  - `ImageEngine.ts` — Image extraction
  - `TableEngine.ts` — Table detection
  - `AnnotationEngine.ts` — PDF annotations
  - `WasmShaper.ts` — HarfBuzz WASM text shaping (bidi, multi-script)
  - `FontRegistry.ts` — Custom font management
- `types/` — PDF-specific types and adapters
- `fonts/` — Font database and metadata

### Utilities (`src/utils/`)
- `webgpu/` — WebGPU renderers, shaders, buffer managers
- `ml/` — Machine learning utilities (MiDaS depth processing)
- `canvasUtils.ts` — Helper functions for 2D canvas operations

### Other
- `src/tools/` — Tool definitions and behaviors
- `src/hooks/` — Custom React hooks
- `src/scripting/` — Scripting API (Photoshop-style JS runtime)
- `src/services/` — External service integrations
- `src/workers/` — Web workers
- `src/types/` — Shared TypeScript types

---

## Agent Scripts (`_agents/`) — Debug Only

Scripts for debugging, PDF inspection, and automated testing. These are **not** part of the app bundle.

| File | Purpose |
|------|---------|
| `debug-pdf.cjs` | Inspect raw PDF structure |
| `inspect-pdf-fonts.cjs` | List fonts in a PDF |
| `inspect-pdf-operators.cjs` | Dump PDF drawing operators |
| `inspect-pdfjs-source.cjs` | Inspect PDF.js source |
| `print-text-nodes.cjs` | Print extracted text nodes |
| `run-parser.cjs` | Run the PDF parser on a file |
| `server.cjs` | Local dev server for PDF testing |
| `test-extracted-shaping.cjs` | Test HarfBuzz shaping output |
| `test-pdf-parsing.ts` | TypeScript test for PDF parsing |
| `uploads/` | Sample PDFs for testing |

---

## Test Data (`_tests/`) — Testing Only

| Path | Purpose |
|------|---------|
| `data/test-anjani.json` | Sample extracted PDF layer data |
| `data/test-land-tax.json` | Sample extracted PDF layer data |
| `results/` | Output from test runs |
| `assets/` | Reference screenshots for visual comparison |

---

## Reference Docs (`docs/`)
- `photoshop-javascript-ref-2020.pdf` — Adobe Photoshop JavaScript API reference

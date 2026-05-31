# Pixelite Enterprise Architecture Proposal

## 1. Full Rewritten Architecture Tree
```text
Core System
├── React UI Layer
│   ├── Schema-Driven Menu System
│   ├── Schema-Driven Panel System
│   ├── Dialogs & Modals
│   └── Editor Mount Point (No Logic)
├── UI State Manager (Zustand - UI only)
├── Command Bus
│   ├── History Manager (Event Sourced)
│   └── Patch/Delta Generator
├── Editor Engine
│   ├── Document Model (Layers, Selections, Masks)
│   ├── Tool System Lifecycle
│   ├── Plugin API
│   └── PSD Import/Export Engine
├── Rendering Pipeline
│   ├── IRenderer (Interface)
│   ├── Canvas2DRenderer
│   └── WebGPURenderer (Future)
├── Worker-Thread Architecture
│   ├── Heavy Filters Worker
│   ├── Export/Encode Worker
│   ├── PSD Parse/Generate Worker
│   └── AI Operations Worker
└── Input Manager
    ├── Pointer Normalizer
    ├── Multi-Touch Gestures
    └── Keyboard / Shortcuts
```

## 2. Domain-Driven Folder Structure
```text
src/
├── core/
│   ├── engine/           (EditorEngine, CommandBus, HistoryManager)
│   ├── document/         (DocumentModel, LayerModel, SelectionModel)
│   ├── renderer/         (IRenderer, Canvas2DRenderer, WebGPURenderer)
│   ├── tools/            (ToolManager, ITool, BaseTool)
│   └── plugins/          (PluginManager, PluginAPI)
├── input/                (InputManager, PointerNormalizer, GestureRecognizer)
├── commands/             (Implementations of ICommand: DrawStroke, AddLayer)
├── schemas/              (UI Definitions: MenuSchema, PanelSchema)
├── ui/
│   ├── Editor/           (CanvasContainer - purely mounts renderer)
│   ├── Menus/            (Schema-driven Menu components)
│   ├── Panels/           (Schema-driven Panel layout)
│   ├── Dialogs/          (Modals)
│   ├── state/            (Zustand stores ONLY for UI state/preferences)
│   └── hooks/            (Bridges between Engine events and React state)
├── workers/              (Web Workers for Image, AI, PSD, Export)
└── utils/                (Math, Geometry, Image/Color processing)
```

## 3. Component Hierarchy
```text
App
 ├── InputManagerProvider
 ├── EngineProvider
 ├── Layout
 │   ├── MenuBar (reads MenuSchema)
 │   ├── Toolbar (reads ToolSchema)
 │   ├── OptionsBar (reads ToolSchema Options)
 │   ├── EditorWorkspace
 │   │   ├── CanvasContainer (Mounts IRenderer canvas)
 │   │   └── OverlayContainer (Schema-driven UI overlays)
 │   └── PanelContainer (reads PanelSchema)
 └── DialogHost (handles modals)
```

## 4. Rendering Pipeline Architecture
- **Abstraction**: `IRenderer` interface implementing `renderTile`, `renderDirtyRect`, `compositeLayers`.
- **Canvas2DRenderer**: Implementation using `OffscreenCanvas` for layer caching. Only modified areas (dirty rectangles) trigger redraws.
- **Data Flow**: Editor Engine mutates Document Model -> Engine calculates dirty bounds -> Dispatches `RenderCommand` to `IRenderer`.
- React does not know about the rendering pipeline or canvas contexts.

## 5. Tool Lifecycle Architecture
All tools inherit from a `BaseTool` or implement `ITool`:
```typescript
interface ITool {
    id: string;
    onActivate(context: EditorContext): void;
    onDeactivate(context: EditorContext): void;
    onPointerDown(event: EditorPointerEvent): void;
    onPointerMove(event: EditorPointerEvent): void;
    onPointerUp(event: EditorPointerEvent): void;
    onKeyDown(event: EditorKeyEvent): void;
    onWheel(event: EditorWheelEvent): void;
}
```
Tools dispatch `Commands` rather than directly mutating the document or canvas.

## 6. Menu System Architecture
- **Schema**: Menus defined as JSON schemas (e.g., `id: 'file.new', command: 'newDoc', shortcut: 'Ctrl+N'`).
- **Rendering**: Recursive React components (`MenuNode`) that parse the schema.
- **Dynamic**: Plugins can inject schema nodes into predefined registry slots (`menuRegistry.register('file.export', newSchema)`).

## 7. Panel System Architecture
- **Schema**: Panels (Layers, History, Properties) are registered via schema.
- **Layout**: A docking/tabbing system governed by Zustand UI state.
- **Logic**: Panels interact with the Editor Engine via the Command Bus, completely decoupled from direct layer mutation.

## 8. State Management Architecture
- **Zustand**: Strictly for UI state (`activePanel`, `dialogOpen`, `theme`).
- **Editor Engine**: Manages document state. UI components subscribe to Engine events (e.g., `engine.on('layerAdded', forceUpdateUI)`).
- **History**: Transition from full snapshots to `ICommand` (execute/undo/redo). Uses delta patching for bitmaps.

## 9. Worker-Thread Architecture
- Heavy calculations (Gaussian blur, resizing, encoding) are offloaded.
- **WorkerBridge**: Promises-based wrapper sending `SharedArrayBuffer` or transferring `ImageBitmap` to avoid structured clone bottleneck on the main thread.

## 10. GPU Rendering Strategy
- Isolate rendering logic behind `IRenderer`.
- Phase 2 implementation of `WebGPURenderer` using compute shaders for compositing (blend modes, opacity) and fragment shaders for brush rendering.

## 11. Plugin Architecture
- In-memory ES modules executing via a strict `PluginAPI` wrapper.
- Plugins register Commands, Tools, Menu schemas, and Panel schemas.
- Cannot mutate rendering or document state directly, must dispatch Commands.

## 12. PSD Import/Export Architecture
- Move `ag-psd` parsing entirely to a Web Worker.
- Worker sends back structured JSON + ArrayBuffers for layer bitmaps.
- Engine creates an `ImportPSDCommand` adding layers natively. Export reverses this process via the Worker.

## 13. AI System Architecture
- Local AI (e.g., ONNX, `background-removal`) runs inside a dedicated Web Worker.
- Input passes through `OffscreenCanvas` to convert to tensor formats.
- Dispatches a `MaskCommand` on success.

## 14. Mobile Architecture
- `InputManager` processes `touchstart`/`touchmove`/`touchend` natively.
- Evaluates multi-touch to recognize Gestures (Pinch to zoom, two-finger tap for undo).
- Dispatches standardized `EditorPointerEvent` or `ZoomCommand`.
- Tools do not need separate mobile logic.

## 15. Performance Optimization Strategy
- **Dirty Rectangles**: Only redraw the bounding box of the brush stroke.
- **Event Throttling**: Input manager utilizes `requestAnimationFrame` for pointer events.
- **OffscreenCanvas**: Caches static layers, composited onto main canvas in a single operation.

## 16. Technical Debt Report
- **Canvas.tsx Monolith**: 800+ lines mixing React logic, DOM events, layer loops, and tool switching.
- **Zustand Overuse**: Giant immutable document snapshots cause massive GC pauses.
- **Direct Mutability**: Tools modify `toolState` globally and use React state setters directly for canvas logic.

## 17. Refactor Priority Roadmap
1. Create `IRenderer` and `EditorEngine` skeletons.
2. Implement `InputManager` and migrate tool lifecycles.
3. Migrate basic tools (Brush, Eraser) to the Command Bus.
4. Extract rendering from `Canvas.tsx` to `Canvas2DRenderer`.
5. Implement Schema-Driven UI and migrate menus/toolbars.
6. Migrate complex tools and History to Event Sourcing.
7. Migrate PSD/AI tasks to Web Workers.

## 18. File-by-file Migration Plan
- `src/components/Canvas/Canvas.tsx` -> Delete. Split into `src/ui/Editor/CanvasContainer.tsx` and `src/core/renderer/Canvas2DRenderer.ts`.
- `src/components/MenuSystem/*` -> Delete. Replace with `src/schemas/MenuSchema.ts` and generic `src/ui/Menus/MenuNode.tsx`.
- `src/components/Toolbar/*` -> Convert to read `ToolRegistry`.
- `src/store/slices/*` -> Keep UI variables, delete document/layer/history slices. Move logic to `src/core/engine/DocumentModel.ts` and `HistoryManager.ts`.
- `src/tools/painting/*` -> Refactor implementations to `ITool` interface inside `src/core/tools/`.
- `src/tools/toolState.ts` -> Delete. Use `ToolContext` provided by the Engine.
- `src/components/Canvas/Events/interactionHandlers.ts` -> Move to `src/input/PointerNormalizer.ts`.

# Pixelite Target Folder Structure

## Purpose

This is the proposed end-state structure for Pixelite. It is designed so each
file has one clear job and each feature exposes a small, intentional public API.
This is a migration blueprint, not a request to move every file at once.

## Rules

1. A file owns one concern: UI, state, command, domain logic, browser adapter,
   or test fixture. It must not mix several of these roles.
2. A feature may import from `core`, `shared`, and `infrastructure`; it may not
   import another feature's internal files.
3. Cross-feature work goes through a feature's `index.ts` public API or a
   typed command/context interface.
4. React components render and translate user events. Commands change state.
   Pure domain functions transform data and do not access React, Zustand, or
   browser APIs.
5. Each folder gets an `index.ts` only for the symbols it deliberately exposes.
   Consumers must not use deep imports into another feature.
6. One unit test file sits beside the pure module it covers. Component and
   workflow tests live in that feature's `__tests__` folder.

## Target Tree

```text
src/
|- app/                                  # Application composition only
|  |- App.tsx                            # Layout, providers, top-level feature hosts
|  |- bootstrap.tsx                      # React bootstrapping and application setup
|  |- routes.ts                          # Screen/view selection when routes are introduced
|  |- shortcuts/
|  |  |- useEditorShortcuts.ts           # Registers keyboard shortcuts
|  |  |- shortcutRegistry.ts             # Maps shortcut IDs to commands
|  |  `- shortcutTypes.ts                # Shortcut contracts
|  |- layout/
|  |  |- EditorLayout.tsx                # Main workspace layout
|  |  |- DesktopLayout.tsx               # Desktop arrangement only
|  |  |- MobileLayout.tsx                # Mobile arrangement only
|  |  `- layout.css                      # Layout styling only
|  `- providers/
|     |- EditorProviders.tsx             # App-level provider composition
|     `- ErrorBoundary.tsx               # App-level error presentation
|
|- core/                                 # Framework-independent editor domain
|  |- document/
|  |  |- documentTypes.ts                # Document data contracts
|  |  |- createDocument.ts               # Creates a document model
|  |  |- transformDocument.ts            # Rotate/flip/resize document model
|  |  `- transformDocument.test.ts       # Document transformation tests
|  |- layers/
|  |  |- layerTypes.ts                   # Layer data contracts
|  |  |- layerTree.ts                    # Traverse/find/reparent tree nodes
|  |  |- layerLocking.ts                 # Layer lock decisions
|  |  |- layerVisibility.ts              # Visibility decisions
|  |  `- layerTree.test.ts               # Tree behavior tests
|  |- selection/
|  |  |- selectionTypes.ts               # Selection data contracts
|  |  |- selectionGeometry.ts            # Bounds, intersections, clipping geometry
|  |  `- selectionGeometry.test.ts       # Geometry tests
|  |- imaging/
|  |  |- blendModes.ts                   # Blend mode mapping only
|  |  |- pixelOperations.ts              # Pure pixel algorithms
|  |  |- color.ts                        # Color conversion and comparison
|  |  `- geometry.ts                     # Coordinates, rectangles, transforms
|  `- tools/
|     |- toolTypes.ts                    # Tool IDs and contracts
|     `- toolRegistry.ts                 # Tool metadata, not implementation
|
|- features/                             # User-facing editor capabilities
|  |- document/
|  |  |- index.ts                        # Public document feature API
|  |  |- state/
|  |  |  `- documentSlice.ts             # Document state/actions only
|  |  |- commands/
|  |  |  |- createDocument.ts            # State-aware create command
|  |  |  |- openDocument.ts              # Chooses import flow
|  |  |  |- saveDocument.ts              # Chooses export/persistence flow
|  |  |  `- transformDocument.ts         # Calls core transform + records history
|  |  |- components/
|  |  |  |- NewDocumentDialog.tsx        # Form and submit event only
|  |  |  |- DocumentTabs.tsx             # Open document tabs only
|  |  |  `- FileInfoDialog.tsx           # Metadata display only
|  |  `- __tests__/
|  |     `- documentCommands.test.ts     # Document workflows
|  |- layers/
|  |  |- index.ts
|  |  |- state/
|  |  |  `- layerSlice.ts                # Layer state/actions only
|  |  |- commands/
|  |  |  |- createLayer.ts               # New layer workflow
|  |  |  |- moveLayer.ts                 # Reorder/reparent workflow
|  |  |  |- duplicateLayer.ts            # Duplication workflow
|  |  |  `- mergeLayers.ts               # Merge workflow
|  |  `- components/
|  |     |- LayerPanel.tsx               # Layer-list composition
|  |     |- LayerRow.tsx                 # One layer row
|  |     `- LayerContextMenu.tsx         # Context-menu presentation
|  |- canvas/
|  |  |- index.ts
|  |  |- viewport/
|  |  |  |- CanvasViewport.tsx           # Canvas DOM and hook composition
|  |  |  |- viewportCoordinates.ts       # Screen/document conversion
|  |  |  `- useViewportTransform.ts      # Zoom, pan, rotate view state
|  |  |- interaction/
|  |  |  |- useCanvasInteraction.ts      # Pointer lifecycle registration
|  |  |  |- createInteractionContext.ts  # Typed tool command context
|  |  |  |- startInteraction.ts          # Pointer-down decision
|  |  |  |- moveInteraction.ts           # Pointer-move decision
|  |  |  `- finishInteraction.ts         # Pointer-up cleanup/history
|  |  |- rendering/
|  |  |  |- useLayerRendering.ts         # Layer render scheduling
|  |  |  |- renderLayer.ts               # One layer rendering decision
|  |  |  |- useThumbnailGeneration.ts    # Thumbnail scheduling
|  |  |  `- useSelectionAnimation.ts     # Selection animation frame
|  |  `- overlays/
|  |     |- CanvasOverlays.tsx           # Overlay composition only
|  |     |- SelectionOverlay.tsx         # Selection UI only
|  |     |- TransformOverlay.tsx         # Transform handles only
|  |     |- TextEditorOverlay.tsx        # Text editing UI only
|  |     |- CropOverlay.tsx              # Crop UI only
|  |     `- VectorOverlay.tsx            # Vector path UI only
|  |- tools/
|  |  |- index.ts                        # Public tool feature API
|  |  |- state/
|  |  |  `- toolSlice.ts                 # Active tool/settings state only
|  |  |- registry/
|  |  |  |- paintingTools.ts              # Painting tool metadata
|  |  |  |- selectionTools.ts             # Selection tool metadata
|  |  |  `- transformTools.ts             # Transform tool metadata
|  |  |- painting/
|  |  |  |- brushInteraction.ts           # Brush pointer behavior
|  |  |  `- brushStroke.ts                # Brush stroke calculation
|  |  |- selection/
|  |  |  |- marqueeInteraction.ts         # Marquee pointer behavior
|  |  |  |- lassoInteraction.ts           # Lasso pointer behavior
|  |  |  `- magicWandSelection.ts         # Magic-wand algorithm adapter
|  |  `- transform/
|  |     |- transformInteraction.ts       # Transform pointer behavior
|  |     `- transformMath.ts              # Pure transform calculation
|  |- adjustments/
|  |  |- index.ts
|  |  |- commands/
|  |  |  `- applyAdjustment.ts            # Applies and records an adjustment
|  |  |- algorithms/
|  |  |  |- brightnessContrast.ts         # One adjustment algorithm
|  |  |  |- hueSaturation.ts              # One adjustment algorithm
|  |  |  `- levels.ts                     # One adjustment algorithm
|  |  `- components/
|  |     |- AdjustmentDialog.tsx          # Dialog host and selection
|  |     |- BrightnessContrastPanel.tsx   # One adjustment panel
|  |     |- HueSaturationPanel.tsx        # One adjustment panel
|  |     `- LevelsPanel.tsx               # One adjustment panel
|  |- history/
|  |  |- state/
|  |  |  `- historySlice.ts               # History state/actions only
|  |  `- commands/
|  |     `- recordHistory.ts              # Snapshot policy only
|  |- selection/
|  |  |- state/
|  |  |  `- selectionSlice.ts             # Selection state/actions only
|  |  `- commands/
|  |     |- clearSelection.ts             # Clear workflow
|  |     `- invertSelection.ts            # Invert workflow
|  |- menus/
|  |  |- MenuBar.tsx                      # Menu presentation only
|  |  |- menuDefinitions.ts               # Menu labels and structure
|  |  `- menuActions.ts                   # Invokes public feature commands
|  `- dialogs/
|     |- DialogHost.tsx                   # Renders active dialog only
|     |- dialogRegistry.ts                # Dialog ID -> component mapping
|     `- state/dialogSlice.ts             # Dialog visibility/state only
|
|- infrastructure/                       # Browser/external-system implementations
|  |- import/
|  |  |- ImportEngine.ts                  # Format dispatch only
|  |  |- imageImporter.ts                 # Image format adapter
|  |  |- psdImporter.ts                   # PSD format adapter
|  |  `- pdfImporter.ts                   # PDF format adapter
|  |- export/
|  |  |- ExportEngine.ts                  # Format dispatch only
|  |  |- imageExporter.ts                 # Image export adapter
|  |  `- psdExporter.ts                   # PSD export adapter
|  |- persistence/
|  |  |- FileSystemService.ts             # File System Access API adapter
|  |  |- RecentProjectsStorage.ts         # Recent-project persistence
|  |  `- AutosaveManager.ts               # Autosave scheduling
|  |- cloud/
|  |  |- cloudClient.ts                   # Shared cloud request contract
|  |  |- imgurClient.ts                   # Imgur integration
|  |  |- imageBbClient.ts                 # ImageBB integration
|  |  `- googleDriveClient.ts             # Google Drive integration
|  |- pdf/                                # Existing PDF engine, organized by pipeline
|  |  |- PdfImportManager.ts              # PDF import façade
|  |  |- parser/                          # Parse PDF data
|  |  |- extraction/                      # Text/image/vector/table extraction
|  |  |- sceneGraph/                      # Convert PDF nodes to editor layers
|  |  `- worker/                          # Worker protocol and worker entry point
|  |- graphics/
|  |  |- webgpu/                          # WebGPU adapters, shaders, resources
|  |  `- pixi/                            # Pixi adapter only
|  `- workers/
|     `- fileWorker.ts                    # File worker entry point only
|
|- shared/                               # Reusable UI and non-domain helpers
|  |- ui/
|  |  |- ColorPicker.tsx                  # Reusable color input only
|  |  |- AlertContainer.tsx               # Alert rendering only
|  |  `- icons.tsx                        # Shared icon wrappers only
|  |- hooks/
|  |  `- useFileImporter.ts               # Reusable file-picker hook
|  |- styles/
|  |  |- tokens.css                       # CSS variables/design tokens
|  |  `- globals.css                      # Global reset/base styles
|  `- types/
|     `- browser.d.ts                     # Browser vendor declarations
|
|- store/
|  |- useEditorStore.ts                   # Zustand composition only
|  |- editorState.ts                      # Root store contract only
|  `- selectors/                          # Shared, memoized selectors only
|     |- documentSelectors.ts
|     |- layerSelectors.ts
|     `- uiSelectors.ts
|
`- test/
   |- setup.ts                            # Test environment setup
   |- factories/                          # Reusable document/layer test data
   `- helpers/                            # Browser/canvas test helpers
```

## Dependency Direction

```text
app -> features -> core
              -> infrastructure
              -> shared

features -> store
store    -> feature state slices only
core     -> no React, Zustand, DOM, browser API, or infrastructure imports
shared   -> no feature imports
infrastructure -> core/shared contracts, never React components
```

## Migration Order

### Phase 0: Stabilize the baseline

1. Fix the current `EditorState` / `useStore` type mismatch.
2. Restrict linting to source files and exclude generated `dist` output.
3. Add a test runner and establish tests for existing pure utilities before
   moving them.

### Phase 1: Create the boundaries without moving behavior

1. Add `core`, `features`, `infrastructure`, `shared`, and `app` folders.
2. Add public `index.ts` files and import aliases.
3. Move only pure utilities first: layer tree, blend modes, geometry, color,
   selection geometry, and transform math.
4. Keep compatibility re-exports temporarily so each small move builds.

### Phase 2: Reduce the application shell

1. Extract document commands from `App.tsx`: import, save/export, rotate,
   flip, resize, and clipboard operations.
2. Extract keyboard shortcut registration and the dialog host.
3. Replace direct utility/store wiring in `App.tsx` with feature APIs.
4. Target: `App.tsx` becomes layout and composition only.

### Phase 3: Reduce canvas coupling

1. Move pointer/touch lifecycle code out of `Canvas.tsx`.
2. Introduce a typed interaction context shared by tool handlers.
3. Move rendering and overlay assembly behind their own modules.
4. Target: `CanvasViewport.tsx` is a small orchestrator, not a tool engine.

### Phase 4: Split feature internals

1. Break `AdjustmentDialog` into one dialog host, focused panels, and pure
   adjustment algorithms.
2. Break `OptionsBar` into tool-family option panels.
3. Separate every tool into metadata, interaction behavior, and pure math or
   pixel work.
4. Convert existing menu files into declarative definitions that call public
   commands.

### Phase 5: Enforce and document the architecture

1. Add lint rules for import boundaries and no deep feature imports.
2. Remove temporary compatibility re-exports.
3. Replace the old folder map after migration with a concise map of actual
   modules and public APIs.
4. Require each new module to have one responsibility and a nearby test when
   it contains non-trivial behavior.

## Definition of Done for Each Extraction

- The moved code has one named responsibility.
- Existing behavior is unchanged and covered by a focused test where practical.
- Imports follow the dependency direction above.
- The old module no longer reaches into the extracted module's internals.
- Build, source lint, and relevant tests pass before the next extraction.

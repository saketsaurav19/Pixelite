# Pixelite Codebase Map

A detailed overview of the project structure and folder organization.

## Root Directory
- `.github/` - GitHub workflow configurations
- `dist/` - Production build output
- `public/` - Static assets and ONNX models for depth estimation
- `src/` - Primary source code
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration

## Source Code (`src/`)

### Core
- `App.tsx` - Main application shell and layout
- `App.css` - Global styles and theme
- `main.tsx` - Application entry point

### Components (`src/components/`)
- `Canvas/` - Core canvas rendering and interaction logic
  - `Rendering/` - WebGPU and 2D canvas rendering hooks
  - `UI/` - On-canvas UI elements like gizmos and overlays
- `MenuBar/` - Top application menus
- `OptionsBar/` - Contextual tool settings and lighting controls
- `Toolbar/` - Left-side tool selection
- `TabBar/` - Multi-document tab management
- `Modals/` - Application dialogs (New Document, Export, etc.)
- `shared/` - Reusable UI components (ColorPickers, Sliders)

### State Management (`src/store/`)
- `useStore.ts` - Main Zustand store definition
- `types.ts` - Core application type definitions
- `slices/` - Modular state slices
  - `lightingSlice.ts` - Lighting and relighting state
  - `layerSlice.ts` - Layer management
  - `toolSlice.ts` - Active tool and settings
  - `historySlice.ts` - Undo/Redo management

### Utilities (`src/utils/`)
- `webgpu/` - WebGPU renderers, shaders, and buffer managers
- `ml/` - Machine learning utilities (MiDaS depth processing)
- `canvasUtils.ts` - Helper functions for 2D canvas operations

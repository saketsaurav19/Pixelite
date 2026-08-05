import type { MenuItem } from '../types';

export const experimentalMenu: MenuItem[] = [
  // ── AI & Generative ────────────────────────────────────────────────────
  {
    label: 'AI & Generative',
    submenu: [
      {
        label: 'Generative Fill...',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Generative Fill — coming soon!' }),
      },
      {
        label: 'Remove Background (AI)',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 AI Background Removal — coming soon!' }),
      },
      {
        label: 'Upscale Image (AI)',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 AI Upscaling — coming soon!' }),
      },
      {
        label: 'Denoise (AI)',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 AI Denoising — coming soon!' }),
      },
    ],
  },

  { divider: true },

  // ── Advanced Filters ───────────────────────────────────────────────────
  {
    label: 'Advanced Filters',
    submenu: [
      {
        label: 'Halftone Effect',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Halftone Effect — coming soon!' }),
      },
      {
        label: 'Duotone...',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Duotone — coming soon!' }),
      },
      {
        label: 'Glitch Effect',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Glitch Effect — coming soon!' }),
      },
      {
        label: 'Liquify...',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Liquify — coming soon!' }),
      },
    ],
  },

  // ── Smart Objects ──────────────────────────────────────────────────────
  {
    label: 'Smart Objects',
    submenu: [
      {
        label: 'Convert to Smart Object',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Smart Objects — coming soon!' }),
      },
      {
        label: 'Edit Contents',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Smart Object editing — coming soon!' }),
      },
      {
        label: 'Rasterize Smart Object',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Rasterize — coming soon!' }),
      },
    ],
  },

  { divider: true },

  // ── Rendering ─────────────────────────────────────────────────────────
  {
    label: 'Rendering',
    submenu: [
      {
        label: 'WebGL Renderer',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 WebGL Renderer — coming soon!' }),
      },
      {
        label: 'GPU Accelerated Filters',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 GPU Filters — coming soon!' }),
      },
    ],
  },

  // ── Collaboration ─────────────────────────────────────────────────────
  {
    label: 'Collaboration',
    submenu: [
      {
        label: 'Share Canvas (Live)',
        action: (s) => (s as any).setIsServerlessShareDialogOpen?.(true, 'webrtc'),
      },
      {
        label: 'Comment on Layer',
        action: (s) => s.addAlert?.({ type: 'info', message: '🧪 Layer Comments — coming soon!' }),
      },
    ],
  },

  { divider: true },

  // ── Debug ─────────────────────────────────────────────────────────────
  {
    label: 'Developer Tools',
    submenu: [
      {
        label: 'Log Store State',
        action: (s) => {
          const { layers, documentSize, zoom, activeLayerId } = s;
          console.group('[Pixelite] Store Snapshot');
          console.log('documentSize:', documentSize);
          console.log('zoom:', zoom);
          console.log('activeLayerId:', activeLayerId);
          console.log('layers:', layers);
          console.groupEnd();
          s.addAlert?.({ type: 'success', message: 'Store state logged to console (F12)' });
        },
      },
      {
        label: 'Clear Layer Cache',
        action: (s) => {
          // Invalidate all thumbnails by clearing them
          s.layers.forEach((layer: any) => s.updateLayer(layer.id, { thumbnail: '' }));
          s.addAlert?.({ type: 'success', message: 'Layer thumbnail cache cleared — regenerating…' });
        },
      },
      {
        label: 'Performance Info',
        action: (s) => {
          const layerCount = s.layers.length;
          const mem = (performance as any).memory;
          const heapMB = mem ? `${(mem.usedJSHeapSize / 1_048_576).toFixed(1)} MB` : 'N/A';
          s.addAlert?.({ type: 'info', message: `Layers: ${layerCount} · JS Heap: ${heapMB}` });
        },
      },
    ],
  },
];

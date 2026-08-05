import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import fs from 'fs'
import path from 'path'
import pkg from './package.json';

// Custom plugin to serve harfbuzz.wasm with correct MIME type
const harfbuzzWasmPlugin = () => ({
  name: 'harfbuzz-wasm-plugin',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.endsWith('harfbuzz.wasm')) {
        const wasmPath = path.resolve(__dirname, 'node_modules/harfbuzzjs/dist/harfbuzz.wasm');
        if (fs.existsSync(wasmPath)) {
          res.setHeader('Content-Type', 'application/wasm');
          res.end(fs.readFileSync(wasmPath));
          return;
        }
      }
      next();
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
 define: {
    global: 'globalThis',
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    harfbuzzWasmPlugin(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon.png'],
      manifest: {
        name: 'Pixelite - Photo Editor',
        short_name: 'Pixelite',
        description: 'Advanced mobile-friendly photo editor',
        theme_color: '#1e1e1e',
        background_color: '#1e1e1e',
        display: 'standalone',
        icons: [
          {
            src: 'icon.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },

    })
  ],
  optimizeDeps: {
    include: ['@embedpdf/pdfium'],
    exclude: ['harfbuzzjs']
  },
  base: '/',
  server: {
    host: true,
    port: 5174,
    cors: true,
  },
  preview: {
    port: 5174,
  },
})

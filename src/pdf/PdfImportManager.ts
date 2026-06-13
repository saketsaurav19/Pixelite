import { PdfjsEngineAdapter } from './worker/engines/PdfjsEngineAdapter';
import { convertSceneNodeToLayer } from './sceneGraph/LayerConversion';
import type { Layer } from '../store/types';
import { nanoid } from 'nanoid';

export interface PdfImportResult {
  layers: Layer[];
  width: number;
  height: number;
}

/**
 * Imports a PDF directly in the main thread.
 *
 * Layout: pages side-by-side (left→right) with a 20px gap.
 * Each page is a group layer positioned at its X offset.
 * Children use local coordinates (origin 0,0 within the group).
 *
 * Page dimensions come from pdf.js getViewport({ scale:1.0 }) — the native
 * logical pixel size of the PDF page. The bitmap is rendered at 2× for
 * high-fidelity but stored at 1× logical dimensions.
 */
export class PdfImportManager {
  static async importPdf(arrayBuffer: ArrayBuffer): Promise<PdfImportResult> {
    const adapter = new PdfjsEngineAdapter();

    await adapter.init();
    await adapter.loadDocument(arrayBuffer);

    // ── Step 1: get native dimensions for ALL pages first ─────────────────
    const pages = await adapter.getPages();
    console.log('[PDF] Pages found:', pages.length, pages.map(p => `${p.width}×${p.height}`));

    const topLevelLayers: Layer[] = [];
    const GAP = 20;
    let currentX = 0;
    let maxPageHeight = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      // Native logical dimensions at scale 1.0
      const { width: pageW, height: pageH } = page;
      const pageX = currentX;
      currentX += pageW + GAP;
      maxPageHeight = Math.max(maxPageHeight, pageH);

      console.log(`[PDF] Rendering page ${i + 1}: ${pageW}×${pageH}px`);

      // ── Step 2: render bitmap at 2× for high-fidelity ──────────────────
      let backgroundDataUrl = '';
      try {
        backgroundDataUrl = await adapter.renderPageToDataUrl(i, 2.0);
      } catch (renderErr) {
        console.error(`[PDF] Failed to render page ${i + 1}:`, renderErr);
        // Create a blank white placeholder so the page group still appears
        const placeholder = document.createElement('canvas');
        placeholder.width = pageW;
        placeholder.height = pageH;
        const ctx = placeholder.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);
        backgroundDataUrl = placeholder.toDataURL();
      }

      // ── Step 3: extract editable layers (text + vector paths) ──────────
      // Image nodes are stubs (empty dataUrl) from ImageEngine — skip them.
      // Order matches Photopea: text on top, then shapes, bitmap at bottom.
      let textLayers: Layer[] = [];
      let shapeLayers: Layer[] = [];
      try {
        const nodes = await adapter.extractObjects(i);
        textLayers = nodes
          .filter(node => node.type === 'text')
          .map(node => convertSceneNodeToLayer(node));
        shapeLayers = nodes
          .filter(node => node.type === 'path')
          .map(node => convertSceneNodeToLayer(node));
      } catch (parseErr) {
        console.warn(`[PDF] Layer extraction failed for page ${i + 1} (skipping):`, parseErr);
      }

      // ── Step 4: build layer tree for this page ──────────────────────────
      // Bitmap: local position (0,0) within group, native 1× dimensions
      // Background bitmap: full-fidelity raster base (like Photopea's 'Background' layer)
      const bitmapBg: Layer = {
        id: nanoid(),
        name: 'Bitmap',
        type: 'image',
        visible: true,
        locked: true,   // locked by default, like Photopea
        opacity: 1,
        blendMode: 'source-over',
        position: { x: 0, y: 0 },
        dataUrl: backgroundDataUrl,
        width: pageW,    // native CSS pixel width  (scale 1.0)
        height: pageH,   // native CSS pixel height (scale 1.0)
      };

      const pageGroup: Layer = {
        id: nanoid(),
        name: `Page ${i + 1}`,
        type: 'artboard',
        width: pageW,
        height: pageH,
        // Layer order (top→bottom): text > vector shapes > raster background
        children: [...textLayers, ...shapeLayers, bitmapBg],
        collapsed: false,
        position: { x: pageX, y: 0 },  // document-space X offset
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'pass through',
      };

      topLevelLayers.push(pageGroup);
    }

    await adapter.closeDocument();

    const totalWidth = currentX > 0 ? currentX - GAP : 0;
    console.log(`[PDF] Import complete: ${totalWidth}×${maxPageHeight}px, ${pages.length} page(s)`);

    return {
      layers: topLevelLayers,
      width: totalWidth,
      height: maxPageHeight,
    };
  }
}

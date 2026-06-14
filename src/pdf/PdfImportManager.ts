import { PdfjsEngineAdapter } from './worker/engines/PdfjsEngineAdapter';
import { convertSceneNodeToLayer } from './sceneGraph/LayerConversion';
import type { Layer } from '../store/types';
import { nanoid } from 'nanoid';

export interface PdfImportResult {
  layers: Layer[];
  width: number;
  height: number;
  metadata?: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    createdAt?: string;
    modifiedAt?: string;
  };
}

/**
 * Imports a PDF directly in the main thread.
 *
 * Layout: pages side-by-side (left→right) with a 20px gap.
 * Each page is a group layer positioned at its X offset.
 * Children use local coordinates (origin 0,0 within the group).
 *
 * Extraction pipeline (per page):
 *   1. Render bitmap @ 2× for high-fidelity background
 *   2. Extract text layers (with color, opacity, rotation, fontWeight)
 *   3. Extract vector paths (with fill/stroke color, opacity, blendMode)
 *   4. Extract embedded images (with real CTM position)
 *   5. Extract annotations (links, comments, form fields)
 *
 * Document-level:
 *   6. Extract metadata (author, title, creator, dates)
 */
export class PdfImportManager {
  static async importPdf(arrayBuffer: ArrayBuffer): Promise<PdfImportResult> {
    const adapter = new PdfjsEngineAdapter();

    await adapter.init();
    await adapter.loadDocument(arrayBuffer);

    // ── Step 1: get native dimensions for ALL pages first ─────────────────
    const pages = await adapter.getPages();
    console.log('[PDF] Pages found:', pages.length, pages.map(p => `${p.width}×${p.height}`));

    // ── Step 6: extract document metadata (once, from whole doc) ──────────
    const metadata = await adapter.extractMetadata();
    if (metadata.author || metadata.title) {
      console.log('[PDF] Metadata:', metadata);
    }

    const topLevelLayers: Layer[] = [];
    const GAP = 20;
    let currentX = 0;
    let maxPageHeight = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];

      const { width: pageW, height: pageH } = page;
      const pageX = currentX;
      currentX += pageW + GAP;
      maxPageHeight = Math.max(maxPageHeight, pageH);

      console.log(`[PDF] Parsing page ${i + 1}: ${pageW}×${pageH}px`);

      // ── Step 2: render bitmap at 2× for high-fidelity ─────────────────
      let backgroundDataUrl = '';
      try {
        console.log(`[PDF] Page ${i + 1}: starting rendering background bitmap...`);
        backgroundDataUrl = await adapter.renderPageToDataUrl(i, 2.0, {
          includeText: false,
          includeImages: false,
          includeVectors: false,
        });
        console.log(`[PDF] Page ${i + 1}: successfully rendered background bitmap (length: ${backgroundDataUrl.length} chars)`);
      } catch (renderErr) {
        console.error(`[PDF] Page ${i + 1}: failed to render background bitmap:`, renderErr);
        const placeholder = document.createElement('canvas');
        placeholder.width = pageW;
        placeholder.height = pageH;
        const ctx = placeholder.getContext('2d')!;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageW, pageH);
        backgroundDataUrl = placeholder.toDataURL();
      }

      // ── Step 3–4: extract editable layers (text + vector + images) ──────
      let textLayers: Layer[] = [];
      let shapeLayers: Layer[] = [];
      let imageLayers: Layer[] = [];

      try {
        console.log(`[PDF] Page ${i + 1}: starting extracting objects...`);
        const nodes = await adapter.extractObjects(i);
        console.log(`[PDF] Page ${i + 1}: extracted ${nodes.length} scene nodes total`);

        textLayers = nodes
          .filter(node => node.type === 'text')
          .map(node => convertSceneNodeToLayer(node));
        console.log(`[PDF] Page ${i + 1}: converted ${textLayers.length} text layers`);

        shapeLayers = nodes
          .filter(node => node.type === 'path')
          .map(node => convertSceneNodeToLayer(node));
        console.log(`[PDF] Page ${i + 1}: converted ${shapeLayers.length} shape layers`);

        imageLayers = nodes
          .filter(node => node.type === 'image' && (node as any).geometry?.dataUrl)
          .map(node => convertSceneNodeToLayer(node));
        console.log(`[PDF] Page ${i + 1}: converted ${imageLayers.length} image layers`);

        console.log(`[PDF] Page ${i + 1} extraction complete: ${textLayers.length} text, ${shapeLayers.length} paths, ${imageLayers.length} images`);
        console.log(`[PDF] Page ${i + 1} Converted Layers (Raw JSON):`, {
          textLayers,
          shapeLayers,
          imageLayers
        });
      } catch (parseErr) {
        console.error(`[PDF] Page ${i + 1} extraction failed:`, parseErr);
        console.warn(`[PDF] Layer extraction failed for page ${i + 1} (skipping):`, parseErr);
      }

      // ── Step 5: extract page annotations ────────────────────────────────
      let annotations: any[] = [];
      try {
        annotations = await adapter.extractAnnotations(i, pageH);
        if (annotations.length) {
          console.log(`[PDF] Page ${i + 1}: ${annotations.length} annotation(s)`);
        }
      } catch (annErr) {
        console.warn(`[PDF] Annotation extraction failed for page ${i + 1}:`, annErr);
      }

      // ── Step 4: build layer tree for this page ──────────────────────────
      // Order (top→bottom): text > watermarks (already in textLayers) > shapes > embedded images > bitmap
      const bitmapBg: Layer = {
        id: nanoid(),
        name: 'Bitmap',
        type: 'image',
        visible: true,
        locked: true,
        opacity: 1,
        blendMode: 'source-over',
        position: { x: 0, y: 0 },
        dataUrl: backgroundDataUrl,
        width: pageW,
        height: pageH,
      };

      const pageGroup: Layer = {
        id: nanoid(),
        name: `Page ${i + 1}`,
        type: 'artboard',
        width: pageW,
        height: pageH,
        children: [...textLayers, ...shapeLayers, ...imageLayers, bitmapBg],
        collapsed: false,
        position: { x: pageX, y: 0 },
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'pass through',
        annotations: annotations.length ? annotations : undefined,
        pdfMetadata: i === 0 ? metadata : undefined, // attach doc metadata to page 1
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
      metadata,
    };
  }
}

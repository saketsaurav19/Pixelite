import * as pdfjsLib from 'pdfjs-dist';
import type { SceneNode, PathNode, TextNode } from '../types/SceneNode';
import { TextEngine } from '../worker/engines/TextEngine';
import { ImageEngine } from '../worker/engines/ImageEngine';
import { VectorEngine } from '../worker/engines/VectorEngine';
import { TableEngine } from '../worker/engines/TableEngine';
import { GraphicsState } from './GraphicsState';
import type { GraphicsStateSnapshot } from './GraphicsState';

/**
 * PdfjsParser — Stateful PDF Operator List Walker
 *
 * Walks getOperatorList() while maintaining a full GraphicsState stack.
 * Each drawing operator reads color, opacity, transform, and line properties
 * from the state — so all engines get accurate data.
 *
 * Operator references: PDF ISO 32000-1 §8–11, pdfjs-dist OPS enum
 */
export class PdfjsParser {
  private page: pdfjsLib.PDFPageProxy;

  constructor(page: pdfjsLib.PDFPageProxy) {
    this.page = page;
  }

  async parseObjects(): Promise<SceneNode[]> {
    const nodes: SceneNode[] = [];
    const viewport = this.page.getViewport({ scale: 1.0 });
    const pageHeight = viewport.height;

    try {
      const state = new GraphicsState();

      // ── 1. Build a per-item snapshot map for the TextEngine ─────────────
      // We walk the operator list first to build a map of item index → state
      // snapshot, then call TextEngine which uses getTextContent() (which
      // gives us text strings + transforms but not colors/opacity).
      console.log('[PdfjsParser] Fetching page operator list...');
      const opList = await this.page.getOperatorList();
      console.log(`[PdfjsParser] Operator list retrieved. Length: ${opList.fnArray.length} operations`);

      // We need to know which graphics state was active when each text item
      // was drawn. Track a separate "text item counter" as we walk the ops.
      const textItemStates: GraphicsStateSnapshot[] = [];
      const tempState = new GraphicsState();

      console.log('[PdfjsParser] Building graphics state snapshot map for text runs...');
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const rawArgs = opList.argsArray[i] as any[];
        const args = getFlatArgs(rawArgs);
        applyStateOp(fn, args, tempState, this.page);

        if (
          fn === pdfjsLib.OPS.showText ||
          fn === pdfjsLib.OPS.showSpacedText ||
          fn === pdfjsLib.OPS.nextLineShowText ||
          fn === pdfjsLib.OPS.nextLineSetSpacingShowText
        ) {
          // Capture a snapshot of the state at this text paint call (deep copy matrix arrays)
          textItemStates.push({
            ...tempState.current,
            ctm: [...tempState.current.ctm],
            textMatrix: [...tempState.current.textMatrix],
          });
        }
      }
      console.log(`[PdfjsParser] Built graphics state snapshot map for ${textItemStates.length} text items`);

      // ── 2. Extract text using TextEngine (with state lookup) ─────────────
      // textItemStates[n] corresponds to the n-th text item from getTextContent()
      // (the ordering is the same in PDF.js's implementation).
      console.log('[PdfjsParser] Calling TextEngine to extract and merge text lines...');
      const textNodes = await TextEngine.extractText(
        this.page,
        pageHeight,
        textItemStates
      );
      console.log(`[PdfjsParser] Text extraction complete. Extracted ${textNodes.length} text lines`);

      // ── 3. Walk operator list for vectors and images ─────────────────────
      const vectorEngine = new VectorEngine(pageHeight);
      const pathNodes: PathNode[] = [];

      console.log('[PdfjsParser] Walking operator list for paths and images...');
      let pathCount = 0;
      let imgCount = 0;
      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const rawArgs = opList.argsArray[i] as any[];
        const args = getFlatArgs(rawArgs);

        // Update the main state machine
        applyStateOp(fn, args, state, this.page);

        // ── Path construction ops ───────────────────────────────────────
        if (fn === pdfjsLib.OPS.moveTo) {
          const pt = transformPoint(args[0], args[1], state.current.ctm);
          vectorEngine.moveTo(pt.x, pt.y);
        }
        else if (fn === pdfjsLib.OPS.lineTo) {
          const pt = transformPoint(args[0], args[1], state.current.ctm);
          vectorEngine.lineTo(pt.x, pt.y);
        }
        else if (fn === pdfjsLib.OPS.curveTo) {
          const cp1 = transformPoint(args[0], args[1], state.current.ctm);
          const cp2 = transformPoint(args[2], args[3], state.current.ctm);
          const pt = transformPoint(args[4], args[5], state.current.ctm);
          vectorEngine.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, pt.x, pt.y);
        }
        else if (fn === pdfjsLib.OPS.curveTo2) {
          const cp2 = transformPoint(args[0], args[1], state.current.ctm);
          const pt = transformPoint(args[2], args[3], state.current.ctm);
          vectorEngine.bezierCurveTo(cp2.x, cp2.y, pt.x, pt.y, pt.x, pt.y);
        }
        else if (fn === pdfjsLib.OPS.closePath || fn === pdfjsLib.OPS.closeStroke) {
          vectorEngine.closePath();
          if (fn === pdfjsLib.OPS.closeStroke) {
            const node = vectorEngine.createPathNode(true, false, state.current);
            if (node) {
              pathNodes.push(node);
              pathCount++;
            }
          }
        }
        else if (fn === pdfjsLib.OPS.rectangle) {
          // re operator: rect(x, y, width, height)
          const [rx, ry, rw, rh] = args;
          const p1 = transformPoint(rx, ry, state.current.ctm);
          const p2 = transformPoint(rx + rw, ry, state.current.ctm);
          const p3 = transformPoint(rx + rw, ry + rh, state.current.ctm);
          const p4 = transformPoint(rx, ry + rh, state.current.ctm);
          vectorEngine.moveTo(p1.x, p1.y);
          vectorEngine.lineTo(p2.x, p2.y);
          vectorEngine.lineTo(p3.x, p3.y);
          vectorEngine.lineTo(p4.x, p4.y);
          vectorEngine.closePath();
        }

        // ── Path painting ops ───────────────────────────────────────────
        else if (fn === pdfjsLib.OPS.fill || fn === pdfjsLib.OPS.eoFill) {
          const node = vectorEngine.createPathNode(false, true, state.current);
          if (node) {
            pathNodes.push(node);
            pathCount++;
          }
        }
        else if (fn === pdfjsLib.OPS.stroke) {
          const node = vectorEngine.createPathNode(true, false, state.current);
          if (node) {
            pathNodes.push(node);
            pathCount++;
          }
        }
        else if (fn === pdfjsLib.OPS.fillStroke || fn === pdfjsLib.OPS.eoFillStroke) {
          const node = vectorEngine.createPathNode(true, true, state.current);
          if (node) {
            pathNodes.push(node);
            pathCount++;
          }
        }
        else if (fn === pdfjsLib.OPS.closeFillStroke || fn === pdfjsLib.OPS.closeEOFillStroke) {
          vectorEngine.closePath();
          const node = vectorEngine.createPathNode(true, true, state.current);
          if (node) {
            pathNodes.push(node);
            pathCount++;
          }
        }
        else if (fn === pdfjsLib.OPS.endPath) {
          // n / W (clip path) — discard current path without painting
          vectorEngine.discardPath();
        }
        else if (fn === pdfjsLib.OPS.constructPath) {
          const paintFn = args[0];
          const pathList = args[1];

          if (Array.isArray(pathList)) {
            for (const pathData of pathList) {
              if (pathData && (pathData.length || typeof pathData.length === 'number')) {
                const arr = Array.from(pathData as any) as number[];
                let idx = 0;
                while (idx < arr.length) {
                  const cmd = arr[idx++];
                  if (cmd === 0) { // moveTo
                    const pt = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    vectorEngine.moveTo(pt.x, pt.y);
                  } else if (cmd === 1) { // lineTo
                    const pt = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    vectorEngine.lineTo(pt.x, pt.y);
                  } else if (cmd === 2) { // curveTo
                    const cp1 = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    const cp2 = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    const pt = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    vectorEngine.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, pt.x, pt.y);
                  } else if (cmd === 3) { // curveTo2
                    const cp2 = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    const pt = transformPoint(arr[idx++], arr[idx++], state.current.ctm);
                    vectorEngine.bezierCurveTo(cp2.x, cp2.y, pt.x, pt.y, pt.x, pt.y);
                  } else if (cmd === 4) { // closePath
                    vectorEngine.closePath();
                  } else if (cmd === 5) { // rectangle
                    const rx = arr[idx++];
                    const ry = arr[idx++];
                    const rw = arr[idx++];
                    const rh = arr[idx++];
                    const p1 = transformPoint(rx, ry, state.current.ctm);
                    const p2 = transformPoint(rx + rw, ry, state.current.ctm);
                    const p3 = transformPoint(rx + rw, ry + rh, state.current.ctm);
                    const p4 = transformPoint(rx, ry + rh, state.current.ctm);
                    vectorEngine.moveTo(p1.x, p1.y);
                    vectorEngine.lineTo(p2.x, p2.y);
                    vectorEngine.lineTo(p3.x, p3.y);
                    vectorEngine.lineTo(p4.x, p4.y);
                    vectorEngine.closePath();
                  }
                }
              }
            }
          }

          // Paint path
          if (paintFn === pdfjsLib.OPS.fill || paintFn === pdfjsLib.OPS.eoFill) {
            const node = vectorEngine.createPathNode(false, true, state.current);
            if (node) {
              pathNodes.push(node);
              pathCount++;
            }
          } else if (paintFn === pdfjsLib.OPS.stroke || paintFn === pdfjsLib.OPS.closeStroke) {
            const node = vectorEngine.createPathNode(true, false, state.current);
            if (node) {
              pathNodes.push(node);
              pathCount++;
            }
          } else if (
            paintFn === pdfjsLib.OPS.fillStroke || 
            paintFn === pdfjsLib.OPS.eoFillStroke ||
            paintFn === pdfjsLib.OPS.closeFillStroke || 
            paintFn === pdfjsLib.OPS.closeEOFillStroke
          ) {
            const node = vectorEngine.createPathNode(true, true, state.current);
            if (node) {
              pathNodes.push(node);
              pathCount++;
            }
          } else {
            vectorEngine.discardPath();
          }
        }

        // ── Image ops ────────────────────────────────────────────────────────
        else if (
          fn === pdfjsLib.OPS.paintImageXObject ||
          fn === pdfjsLib.OPS.paintInlineImageXObject ||
          fn === pdfjsLib.OPS.paintImageXObjectRepeat ||
          fn === pdfjsLib.OPS.paintImageMaskXObject
        ) {
          const imgName = args[0];
          console.log(`[PdfjsParser] Attempting to extract image/mask: ${imgName} (fn: ${fn})`);
          try {
            const imageNode = await ImageEngine.extractImage(
              this.page, imgName, state.current, pageHeight
            );
            if (imageNode) {
              nodes.push(imageNode);
              imgCount++;
              console.log(`[PdfjsParser] Successfully extracted image/mask: ${imgName} (ID: ${imageNode.id})`);
            } else {
              console.warn(`[PdfjsParser] Image extraction returned null for ${imgName}`);
            }
          } catch (imgErr) {
            console.error(`[PdfjsParser] Error extracting image/mask ${imgName}:`, imgErr);
          }
        }
      }
      console.log(`[PdfjsParser] Walk complete. Processed ${pathCount} paths, ${imgCount} images/masks`);

      // ── 4. Detect Tables ──────────────────────────────────────────────────
      let tableNodes: any[] = [];
      let usedPathIds = new Set<string>();
      let usedTextIds = new Set<string>();
      try {
        console.log('[PdfjsParser] Running TableEngine to detect tables...');
        const result = TableEngine.detectTables(pathNodes, textNodes as TextNode[]);
        tableNodes = result.tableNodes;
        usedPathIds = result.usedPathIds;
        usedTextIds = result.usedTextIds;
        console.log(`[PdfjsParser] Table detection completed. Found ${tableNodes.length} tables. Used paths: ${usedPathIds.size}, Used texts: ${usedTextIds.size}`);
      } catch (tableErr) {
        console.error('[PdfjsParser] Table detection failed:', tableErr);
      }

      // Emit all table nodes
      for (const tbl of tableNodes) {
        nodes.push(tbl);
      }

      // Emit all path nodes directly as shapes (excluding those used in tables)
      let regularPaths = 0;
      for (const p of pathNodes) {
        if (!usedPathIds.has(p.id)) {
          nodes.push(p);
          regularPaths++;
        }
      }
      console.log(`[PdfjsParser] Emitted ${regularPaths} regular paths (excluding table lines)`);

      // Emit all text nodes directly (excluding those used in tables)
      let regularTexts = 0;
      for (const t of textNodes) {
        if (!usedTextIds.has(t.id)) {
          nodes.push(t as TextNode);
          regularTexts++;
        }
      }
      console.log(`[PdfjsParser] Emitted ${regularTexts} regular text nodes (excluding table cells)`);

    } catch (e) {
      console.error('[PdfjsParser] Error parsing PDF page objects:', e);
    }

    console.log('[PdfjsParser] Extracted Scene Nodes (Raw JSON):', nodes);
    return nodes;
  }
}

function getFlatArgs(args: any[]): any[] {
  if (!args || args.length === 0) return [];
  if (args.length !== 1) return args;
  const first = args[0];
  if (first !== null && typeof first === 'object') {
    if ('0' in first) {
      const list: any[] = [];
      let i = 0;
      while (String(i) in first) {
        list.push((first as any)[String(i)]);
        i++;
      }
      return list;
    }
    if (Array.isArray(first)) {
      return first;
    }
    if ('length' in first && typeof (first as any).length === 'number') {
      return Array.from(first as any);
    }
  }
  return args;
}

function transformPoint(x: number, y: number, ctm: number[]): { x: number; y: number } {
  return {
    x: x * ctm[0] + y * ctm[2] + ctm[4],
    y: x * ctm[1] + y * ctm[3] + ctm[5],
  };
}

function getColorComponents(args: any[]): number[] {
  if (!args || args.length === 0) return [];
  const first = args[0];
  if (first !== null && typeof first === 'object' && 'length' in first && typeof (first as any).length === 'number') {
    return Array.from(first as any);
  }
  return args.filter(x => typeof x === 'number');
}

// ─── Graphics State Operator Dispatcher ──────────────────────────────────────

/**
 * Apply a single PDF operator to the graphics state.
 * Called for every operator during the pre-pass (to build textItemStates)
 * and during the main pass (for vector/image extraction).
 */
function applyStateOp(
  fn: number,
  args: any[],
  state: GraphicsState,
  _page: pdfjsLib.PDFPageProxy
): void {
  const OPS = pdfjsLib.OPS;

  // ── Stack ─────────────────────────────────────────────────────────────
  if (fn === OPS.save) state.save();
  else if (fn === OPS.restore) state.restore();

  // ── CTM ──────────────────────────────────────────────────────────────
  else if (fn === OPS.transform) {
    state.transform(args[0], args[1], args[2], args[3], args[4], args[5]);
  }

  // ── Fill color ────────────────────────────────────────────────────────
  else if (fn === OPS.setFillRGBColor) {
    if (typeof args[0] === 'string') {
      state.setFillColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setFillRGBColor(comps[0], comps[1], comps[2]);
    }
  }
  else if (fn === OPS.setFillGray) {
    if (typeof args[0] === 'string') {
      state.setFillColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setFillGray(comps[0]);
    }
  }
  else if (fn === OPS.setFillCMYKColor) {
    if (typeof args[0] === 'string') {
      state.setFillColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setFillCMYK(comps[0], comps[1], comps[2], comps[3]);
    }
  }
  else if (fn === OPS.setFillColor || fn === OPS.setFillColorN) {
    if (typeof args[0] === 'string') {
      state.setFillColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      if (comps.length > 0) {
        state.setFillColorComponents(comps);
      }
    }
  }

  // ── Stroke color ──────────────────────────────────────────────────────
  else if (fn === OPS.setStrokeRGBColor) {
    if (typeof args[0] === 'string') {
      state.setStrokeColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setStrokeRGBColor(comps[0], comps[1], comps[2]);
    }
  }
  else if (fn === OPS.setStrokeGray) {
    if (typeof args[0] === 'string') {
      state.setStrokeColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setStrokeGray(comps[0]);
    }
  }
  else if (fn === OPS.setStrokeCMYKColor) {
    if (typeof args[0] === 'string') {
      state.setStrokeColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      state.setStrokeCMYK(comps[0], comps[1], comps[2], comps[3]);
    }
  }
  else if (fn === OPS.setStrokeColor || fn === OPS.setStrokeColorN) {
    if (typeof args[0] === 'string') {
      state.setStrokeColorString(args[0]);
    } else {
      const comps = getColorComponents(args);
      if (comps.length > 0) {
        state.setStrokeColorComponents(comps);
      }
    }
  }

  // ── Color spaces ─────────────────────────────────────────────────────
  else if (fn === OPS.setFillColorSpace) {
    state.setFillColorSpace(args[0]);
  }
  else if (fn === OPS.setStrokeColorSpace) {
    state.setStrokeColorSpace(args[0]);
  }

  // ── Line width ────────────────────────────────────────────────────────
  else if (fn === OPS.setLineWidth) {
    state.setLineWidth(args[0]);
  }
  else if (fn === OPS.setLineCap) {
    state.setLineCap(args[0]);
  }
  else if (fn === OPS.setLineJoin) {
    state.setLineJoin(args[0]);
  }
  else if (fn === OPS.setMiterLimit) {
    state.setMiterLimit(args[0]);
  }
  else if (fn === OPS.setDash) {
    state.setLineDash(args[0], args[1]);
  }

  // ── Extended graphics state (opacity, blend mode) ─────────────────────
  else if (fn === OPS.setGState) {
    // args[0] is the name of the ExtGState dict; args[1] is the dict object
    // PDF.js resolves it and passes the parsed dict as the second arg
    const gstateDict = args[1] ?? args[0];
    if (gstateDict && typeof gstateDict === 'object') {
      state.applyExtGState(gstateDict);
    }
  }

  // ── Font ──────────────────────────────────────────────────────────────
  else if (fn === OPS.setFont) {
    state.setFont(args[0], args[1]);
  }

  // ── Text matrix ───────────────────────────────────────────────────────
  else if (fn === OPS.setTextMatrix) {
    state.setTextMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
  }
  else if (fn === OPS.moveText) {
    state.moveTextPosition(args[0], args[1]);
  }
}

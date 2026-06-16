import * as pdfjsLib from 'pdfjs-dist';
import type { TextNode, TextRun } from '../../types/SceneNode';
import type { GraphicsStateSnapshot } from '../../parser/GraphicsState';
import { nanoid } from 'nanoid';

import { getShapedPositions } from './WasmShaper';
import type { TextCluster } from './WasmShaper';
import { FontRegistry } from './FontRegistry';

// ─── Devanagari visual reorder fix ───────────────────────────────────────────

function normalizeExtractedText(text: string): string {
  let normalized = text.normalize('NFC').replace(/\u0000/g, '');

  // Correct the visual-to-logical ordering of the Devanagari short-i vowel sign (ि U+093F).
  // In PDF text extraction, because the U+093F glyph is visually drawn to the left of the
  // consonant cluster it modifies, sorting characters by X coordinate often positions U+093F
  // before the consonant cluster.
  // In Unicode, the vowel sign U+093F must follow the consonant/cluster it modifies.
  //
  // Devanagari consonant cluster regex pattern:
  // (?:[Consonant][optional Nukta][Halant])* [Consonant][optional Nukta]
  // Consonants: \u0915-\u0939, \u0958-\u095F
  // Nukta: \u093C
  // Halant: \u094D
  const clusterRegex = /\u093F((?:[\u0915-\u0939\u0958-\u095F]\u093C?\u094D)*[\u0915-\u0939\u0958-\u095F]\u093C?)/g;
  normalized = normalized.replace(clusterRegex, '$1\u093F');

  return normalized;
}

// ─── Font weight resolver ─────────────────────────────────────────────────────

/**
 * Infer CSS font-weight from the raw PDF font name.
 * PDF fonts often embed weight hints in the name:
 *   "AAAAAA+Arial-Bold"       → bold
 *   "g_d0_f2Bold"             → bold
 *   "TimesNewRoman,Bold"      → bold
 *   "Helvetica-Light"         → 300
 *   "Helvetica-Medium"        → 500
 *   "Helvetica-Black"         → 900
 */
export function resolveFontWeight(fontName: string): string {
  const lower = fontName.toLowerCase();
  if (/\bblack\b|ultrablack|extrabold|heavy/.test(lower)) return '900';
  if (/\bextrabold\b|\bultrabold\b/.test(lower)) return '800';
  if (/\bbold\b/.test(lower)) return 'bold';
  if (/\bsemibold\b|\bdemibold\b/.test(lower)) return '600';
  if (/\bmedium\b/.test(lower)) return '500';
  if (/\blight\b/.test(lower)) return '300';
  if (/\bthin\b|\bextralight\b|\bultralight\b/.test(lower)) return '100';
  return 'normal';
}

/**
 * Extract the clean family name from a raw PDF font key.
 * Raw examples: "ABCDEF+HelveticaNeue-Bold", "g_d0_f2", "Arial,Bold"
 */
function resolveFontFamily(fontName: string): string {
  // Strip 6-char subset prefix like "ABCDEF+"
  let name = fontName.replace(/^[A-Z]{6}\+/, '');
  // Strip ,Bold or -Bold suffix for the family portion
  name = name.replace(/[,+-](bold|italic|regular|light|medium|heavy|black|thin|condensed|expanded)/gi, '');
  // Strip raw g_dX_fY keys that are just internal PDF references
  if (/^g_d\d+_f\d+/.test(name)) return 'sans-serif';
  return name || 'sans-serif';
}

// ─── Watermark detection ──────────────────────────────────────────────────────

function detectWatermark(
  isWatermarkFromTools: boolean,
  opacity: number,
  rotation: number,
  fontSize: number
): boolean {
  const isLowOpacity = opacity < 0.5;
  const isRotated = Math.abs(rotation) > 8;
  const isLargeAndRotated = fontSize > 36 && isRotated;
  return isWatermarkFromTools || (isLowOpacity && isRotated) || isLargeAndRotated;
}

// ─── Main TextEngine ──────────────────────────────────────────────────────────

export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

export class TextEngine {
  /**
   * Extract text nodes from a PDF page.
   * @param page        The PDF.js page proxy
   * @param pageHeight  Native page height (for Y-flip)
   * @param getState    Callback that returns the graphics state at a given
   *                    operator index. If unavailable, a fallback default
   *                    state is used.
   */
  static async extractText(
    page: pdfjsLib.PDFPageProxy,
    pageHeight: number,
    textItemStates?: GraphicsStateSnapshot[]
  ): Promise<TextNode[]> {
    const nodes: TextNode[] = [];
    try {
      // 1. Fetch watermark annotations on the page
      const annotations = await page.getAnnotations().catch(() => []);
      const watermarkRects: number[][] = [];
      if (annotations) {
        for (const ann of annotations) {
          const isWatermarkAnn =
            ann.subtype === 'Watermark' ||
            ann.annotationType === 137 ||
            (pdfjsLib.AnnotationType && ann.annotationType === pdfjsLib.AnnotationType.WATERMARK);
          if (isWatermarkAnn && ann.rect) {
            watermarkRects.push(ann.rect);
          }
        }
      }

      const textContent = await page.getTextContent({
        disableNormalization: true,
        includeMarkedContent: true,
      } as any);

      // 2. Map items sequentially tracking marked content tags
      let activeTags: string[] = [];
      const parsedItems: any[] = [];
      let textItemIndex = 0;
      let pendingSpace = false;

      for (const item of textContent.items) {
        if ('type' in item) {
          // This is a TextMarkedContent
          const type = (item as any).type;
          const tag = (item as any).tag || '';
          if (type === 'beginMarkedContent' || type === 'beginMarkedContentProps') {
            activeTags.push(tag);
          } else if (type === 'endMarkedContent') {
            activeTags.pop();
          }
          continue;
        }

        const currentIdx = textItemIndex;
        textItemIndex++;

        if (!('str' in item)) {
          continue;
        }

        if (item.str === '') {
          continue;
        }

        if (!item.str.trim()) {
          pendingSpace = true;
          continue;
        }

        // Find the best matching graphics state snapshot globally based on coordinate distance
        let state: GraphicsStateSnapshot | null = null;
        if (textItemStates && textItemStates.length > 0) {
          let bestIdx = 0;
          let minDistance = Infinity;

          for (let s = 0; s < textItemStates.length; s++) {
            const snap = textItemStates[s];
            if (!snap) continue;

            // Compute page-space origin of snapshot
            const snapTransform = pdfjsLib.Util.transform(snap.ctm, snap.textMatrix);
            const snapX = snapTransform[4];
            const snapY = snapTransform[5];

            const itemX = item.transform[4];
            const itemY = item.transform[5];

            const dx = snapX - itemX;
            const dy = snapY - itemY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < minDistance) {
              minDistance = dist;
              bestIdx = s;
            }
            // If we find a very close coordinate match, stop searching
            if (dist < 0.1) {
              break;
            }
          }
          state = textItemStates[bestIdx] ?? null;
        }

        const transform = item.transform; // [a, b, c, d, e, f]
        const x = transform[4];

        // Font size = scale factor of the text matrix (magnitude of X basis vector)
        const inferredFontSize = Math.sqrt(
          transform[0] * transform[0] + transform[1] * transform[1]
        ) || 0;

        const fontSize = Math.max(
          item.height || 0,
          Math.abs(state?.fontSize ?? 0),
          inferredFontSize,
          12
        );

        // PDF text coordinates are BASELINE in bottom-up space.
        // Screen baseline = pageHeight - transform[5] (after Y-flip).
        // CSS `top` = top edge of element.
        // For most fonts, ascender ≈ 0.85 × fontSize above baseline.
        // So element top = baseline - fontSize * 0.85
        const baselineY = pageHeight - transform[5];
        const y = baselineY - fontSize * 0.85;

        // Rotation from the transform matrix.
        // PDF space has Y going UP; screen space has Y going DOWN.
        // A CCW angle in PDF becomes a CW angle in screen → negate.
        const rotation = -Math.atan2(transform[1], transform[0]) * (180 / Math.PI);

        const fillColor = state?.fillColor ?? '#000000';
        const fillOpacity = state?.fillOpacity ?? 1;
        const fontName = item.fontName ?? state?.fontName ?? '';

        // item.width can be 0 or unreasonably small for some Devanagari/complex-script runs in PDF.js.
        // If it is smaller than typical minimum character widths, fall back to estimated width.
        const minExpectedWidth = item.str.length * fontSize * 0.2;
        const estimatedWidth = (item.width > minExpectedWidth)
          ? item.width
          : item.str.length * fontSize * 0.55;

        // Detect if marked as watermark in marked content blocks
        const isWatermarkMarked = activeTags.some(tag =>
          /watermark/i.test(tag)
        );

        // Check intersection with watermark annotations
        const textPdfX1 = x;
        const textPdfX2 = x + estimatedWidth;
        const textPdfY1 = transform[5];
        const textPdfY2 = transform[5] + fontSize;

        let isOverlappingWatermarkAnn = false;
        for (const rect of watermarkRects) {
          const [rx1, ry1, rx2, ry2] = rect;
          const overlapX = textPdfX1 <= rx2 && textPdfX2 >= rx1;
          const overlapY = textPdfY1 <= ry2 && textPdfY2 >= ry1;
          if (overlapX && overlapY) {
            isOverlappingWatermarkAnn = true;
            break;
          }
        }

        const isWatermark = isWatermarkMarked || isOverlappingWatermarkAnn;

        parsedItems.push({
          str: item.str,
          x,
          y,
          baselineY,   // keep raw baseline for precise line-grouping
          fontSize,
          rotation,
          fillColor,
          fillOpacity,
          fontName,
          fontFamily: resolveFontFamily(fontName),
          fontWeight: resolveFontWeight(fontName),
          width: estimatedWidth,
          height: item.height || fontSize || 12,
          originalIndex: currentIdx,
          isWatermark,
          precededBySpace: pendingSpace,
        });
        pendingSpace = false;
      }

      if (parsedItems.length === 0) return [];

      // ── 2. Sort: top-to-bottom by baseline, then left-to-right by X ──────
      // Using baselineY for Y-grouping is more stable than y (which has the
      // ascender offset applied). Items on the same baseline = same PDF line.
      parsedItems.sort((a, b) => {
        // Same-line threshold: 35% of font size (tighter than before to avoid
        // merging separate table rows that happen to have close Y values)
        const sameLineThreshold = Math.max(a.fontSize, b.fontSize) * 0.35;
        if (Math.abs(a.baselineY - b.baselineY) < sameLineThreshold) {
          // Sort left-to-right by X so characters appear in reading order
          return a.x - b.x;
        }
        return a.baselineY - b.baselineY;
      });

      // ── 3. Group into visual lines and emit — each separate text block ─────
      const mergedLines: {
        str: string;
        x: number;
        y: number;
        baselineY: number;
        fontSize: number;
        fontFamily: string;
        fontWeight: string;
        fillColor: string;
        fillOpacity: number;
        rotation: number;
        width: number;
        height: number;
        runs: typeof parsedItems;
        isWatermark: boolean;
        fontName: string;
      }[] = [];

      let currentLine: typeof parsedItems[0] & { baselineY: number } | null = null;
      let lineMinX = 0;
      let lineMaxX = 0;
      let lineRuns: typeof parsedItems = [];

      for (const item of parsedItems) {
        if (!currentLine) {
          currentLine = { ...item };
          lineMinX = item.x;
          lineMaxX = item.x + item.width;
          lineRuns = [item];
          continue;
        }

        const sameLineThreshold = Math.max(item.fontSize, currentLine.fontSize) * 0.35;
        const sameLine = Math.abs(item.baselineY - currentLine.baselineY) < sameLineThreshold;
        const sameRotation = Math.abs(item.rotation - currentLine.rotation) < 1.0;

        // Horizontal gap: distance from right edge of current accumulation to
        // left edge of new item. Negative = overlap.
        const gapRight = item.x - lineMaxX;

        // Only merge if: same baseline line AND gap is within 65% of a font size
        // (i.e. a normal word space or kerning). Larger gaps → separate layer.
        const closeHorizontally = gapRight < currentLine.fontSize * 0.65;

        if (sameLine && closeHorizontally && sameRotation) {
          // Insert a space when there's an explicit preceding space or visible gap
          const needsSpace =
            !currentLine.str.endsWith(' ') &&
            !item.str.startsWith(' ') &&
            (item.precededBySpace || gapRight > currentLine.fontSize * 0.15);

          currentLine.str += (needsSpace ? ' ' : '') + item.str;
          lineMinX = Math.min(lineMinX, item.x);
          lineMaxX = Math.max(lineMaxX, item.x + item.width);
          currentLine.x = lineMinX;
          currentLine.width = lineMaxX - lineMinX;
          // Adopt bolder/larger font properties from the dominant run
          if (item.fontSize > currentLine.fontSize) {
            currentLine.fontWeight = item.fontWeight;
            currentLine.fontFamily = item.fontFamily;
            currentLine.fontSize = item.fontSize;
          }
          if (item.isWatermark) {
            currentLine.isWatermark = true;
          }
          lineRuns.push(item);
        } else {
          mergedLines.push({
            str: currentLine.str,
            x: currentLine.x,
            y: currentLine.y,
            baselineY: currentLine.baselineY,
            fontSize: currentLine.fontSize,
            fontFamily: currentLine.fontFamily,
            fontWeight: currentLine.fontWeight,
            fillColor: currentLine.fillColor,
            fillOpacity: currentLine.fillOpacity,
            rotation: currentLine.rotation,
            width: currentLine.width,
            height: currentLine.height,
            runs: [...lineRuns],
            isWatermark: currentLine.isWatermark || lineRuns.some(r => r.isWatermark),
            fontName: currentLine.fontName,
          });
          currentLine = { ...item };
          lineMinX = item.x;
          lineMaxX = item.x + item.width;
          lineRuns = [item];
        }
      }

      if (currentLine) {
        mergedLines.push({
          str: currentLine.str,
          x: currentLine.x,
          y: currentLine.y,
          baselineY: currentLine.baselineY,
          fontSize: currentLine.fontSize,
          fontFamily: currentLine.fontFamily,
          fontWeight: currentLine.fontWeight,
          fillColor: currentLine.fillColor,
          fillOpacity: currentLine.fillOpacity,
          rotation: currentLine.rotation,
          width: currentLine.width,
          height: currentLine.height,
          runs: [...lineRuns],
          isWatermark: currentLine.isWatermark || lineRuns.some(r => r.isWatermark),
          fontName: currentLine.fontName,
        });
      }


      // ── 4. Convert merged lines to TextNodes ─────────────────────────────
      for (const line of mergedLines) {
        const correctedStr = normalizeExtractedText(line.str);
        const isWatermark = detectWatermark(
          line.isWatermark,
          line.fillOpacity,
          line.rotation,
          line.fontSize
        );

        let fontChecksum: string | undefined = undefined;
        let originalFontName: string | undefined = undefined;

        const dominantFontName = line.fontName;
        if (dominantFontName && page.commonObjs.has(dominantFontName)) {
          const f = page.commonObjs.get(dominantFontName);
          if (f && f.data) {
            const fData = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : f.data;
            try {
              fontChecksum = await FontRegistry.computeSha256(fData);
              originalFontName = f.name;
              FontRegistry.register(fontChecksum, f.name, fData, f.mimetype);

              if (typeof window !== 'undefined' && typeof FontFace !== 'undefined') {
                const fontKey = `pdf-font-${fontChecksum}`;
                const cleanFamily = f.name.replace(/^[A-Z]{6}\+/, '');

                try {
                  const fFace1 = new FontFace(fontKey, f.data.buffer as ArrayBuffer);
                  await fFace1.load();
                  (document.fonts as any).add(fFace1);

                  const fFace2 = new FontFace(cleanFamily, f.data.buffer as ArrayBuffer);
                  await fFace2.load();
                  (document.fonts as any).add(fFace2);
                } catch (loadErr) {
                  // ignore if failed or already loaded
                }
              }
            } catch (hashErr) {
              console.warn('Failed to hash or register font:', hashErr);
            }
          }
        }

        // For complex scripts (Devanagari, Arabic, Hebrew) or bidirectional text,
        // run HarfBuzz to get per-cluster x positions so HTML spans are placed
        // correctly. Latin/ASCII text skips this for performance.
        const needsShaping =
          /[\u0900-\u097F\u0600-\u06FF\u0590-\u05FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\uFB1D-\uFB4F]/.test(correctedStr);

        let shapedPositions: TextCluster[] | undefined = undefined;
        if (needsShaping) {
          try {
            const result = await getShapedPositions(correctedStr, line.fontSize, fontChecksum, originalFontName);
            shapedPositions = result ?? undefined;
          } catch (shapeErr) {
            console.warn('[TextEngine] getShapedPositions failed, using CSS spans:', shapeErr);
          }
        }

        // Build per-run rich data
        const runs: TextRun[] = line.runs.map(run => ({
          str: run.str,
          fontSize: run.fontSize,
          fontFamily: run.fontFamily,
          fontWeight: run.fontWeight,
          color: run.fillColor,
          opacity: run.fillOpacity,
          x: run.x,
          y: run.y,
          rotation: run.rotation,
        }));

        const textNode: TextNode = {
          id: nanoid(),
          name: correctedStr.length > 30 ? correctedStr.substring(0, 30) + '...' : correctedStr,
          type: 'text',
          transform: {
            a: Math.cos((line.rotation * Math.PI) / 180),
            b: Math.sin((line.rotation * Math.PI) / 180),
            c: -Math.sin((line.rotation * Math.PI) / 180),
            d: Math.cos((line.rotation * Math.PI) / 180),
            e: line.x,
            f: line.y,
          },
          opacity: line.fillOpacity,
          blendMode: 'source-over',
          visible: true,
          locked: false,
          geometry: {
            text: correctedStr,
            fontSize: line.fontSize,
            fontFamily: originalFontName ? originalFontName.replace(/^[A-Z]{6}\+/, '') : line.fontFamily,
            fontWeight: line.fontWeight,
            color: line.fillColor,
            opacity: line.fillOpacity,
            rotation: line.rotation,
            isWatermark,
            runs,
            shapedPositions,
            fontChecksum,
            fontName: originalFontName || line.fontName,
          },
          style: {
            fillColor: line.fillColor,
            opacity: line.fillOpacity,
          },
        };
        nodes.push(textNode);
      }
    } catch (e) {
      console.error('TextEngine: Error extracting text', e);
    }
    return nodes;
  }
}

import type { PathNode, TextNode, TableNode, TableCell, TableData } from '../../types/SceneNode';
import type { PathSegment } from '../../types/SceneNode';
import { nanoid } from 'nanoid';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LineSegment {
  x1: number; y1: number;
  x2: number; y2: number;
}

interface GridRegion {
  x: number; y: number;
  width: number; height: number;
  hLines: number[];   // sorted Y positions of horizontal lines (screen space)
  vLines: number[];   // sorted X positions of vertical lines (screen space)
}

// ─────────────────────────────────────────────────────────────────────────────
// TableEngine
// ─────────────────────────────────────────────────────────────────────────────

export class TableEngine {
  /**
   * Analyse the page's path nodes and text nodes to find table structures.
   *
   * Returns:
   *   - tableNodes   – TableNode[] ready for scene graph insertion
   *   - usedPathIds  – IDs of PathNodes consumed as table borders
   *   - usedTextIds  – IDs of TextNodes consumed as cell content
   */
  static detectTables(
    pathNodes: PathNode[],
    textNodes: TextNode[]
  ): {
    tableNodes: TableNode[];
    usedPathIds: Set<string>;
    usedTextIds: Set<string>;
  } {
    // ── 1. Extract all line segments from path nodes ─────────────────────────
    const hLines: LineSegment[] = [];
    const vLines: LineSegment[] = [];
    const pathLineMap = new Map<string, LineSegment[]>(); // pathId → segments

    for (const pathNode of pathNodes) {
      const segs = extractLineSegments(pathNode.geometry.segments);
      pathLineMap.set(pathNode.id, segs);

      for (const seg of segs) {
        const dx = Math.abs(seg.x2 - seg.x1);
        const dy = Math.abs(seg.y2 - seg.y1);
        // Horizontal line: very small Δy, meaningful Δx
        if (dy < 3 && dx > 10) hLines.push(normalizeSegment(seg));
        // Vertical line: very small Δx, meaningful Δy
        if (dx < 3 && dy > 5) vLines.push(normalizeSegment(seg));
      }
    }

    if (hLines.length < 2 || vLines.length < 2) {
      return { tableNodes: [], usedPathIds: new Set(), usedTextIds: new Set() };
    }

    // ── 2. Cluster lines into grid coordinates ────────────────────────────────
    const hClusters = clusterValues(hLines.map(l => (l.y1 + l.y2) / 2), 4);
    const vClusters = clusterValues(vLines.map(l => (l.x1 + l.x2) / 2), 4);

    if (hClusters.length < 2 || vClusters.length < 2) {
      return { tableNodes: [], usedPathIds: new Set(), usedTextIds: new Set() };
    }

    // ── 3. Find connected grid sub-regions ───────────────────────────────────
    const regions = findGridRegions(hClusters, vClusters, hLines, vLines);

    const tableNodes: TableNode[] = [];
    const usedPathIds = new Set<string>();
    const usedTextIds = new Set<string>();

    for (const region of regions) {
      if (region.hLines.length < 2 || region.vLines.length < 2) continue;

      // ── 4. Build cells from grid intersections ────────────────────────────
      const cells: TableCell[] = [];
      const rows = region.hLines.length - 1;
      const cols = region.vLines.length - 1;
      const rowHeights: number[] = [];
      const colWidths: number[] = [];

      for (let r = 0; r < rows; r++) {
        rowHeights.push(region.hLines[r + 1] - region.hLines[r]);
      }
      for (let c = 0; c < cols; c++) {
        colWidths.push(region.vLines[c + 1] - region.vLines[c]);
      }

      // ── 5. Assign text nodes to cells ─────────────────────────────────────
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cellX   = region.vLines[c];
          const cellY   = region.hLines[r];
          const cellW   = region.vLines[c + 1] - cellX;
          const cellH   = region.hLines[r + 1] - cellY;
          const padding = 3;

          // Collect all text items whose baseline falls inside this cell
          const cellTexts = textNodes.filter(tn => {
            if (usedTextIds.has(tn.id)) return false;
            const tx = tn.transform.e;
            const ty = tn.transform.f;  // top-left y of text layer
            const fontSize = tn.geometry.fontSize;
            const textBaseline = ty + fontSize * 0.85; // approx baseline
            return (
              tx >= cellX - padding &&
              tx < region.vLines[c + 1] + padding &&
              textBaseline >= cellY - padding &&
              textBaseline < region.hLines[r + 1] + padding
            );
          });

          const text = cellTexts.map(tn => tn.geometry.text).join(' ').trim();

          // Detect text alignment from X position within cell
          const midCell = cellX + cellW / 2;
          const textX = cellTexts[0]?.transform.e ?? cellX;
          let textAlign: 'left' | 'center' | 'right' = 'left';
          if (Math.abs(textX - midCell) < cellW * 0.2) textAlign = 'center';
          else if (textX > cellX + cellW * 0.6) textAlign = 'right';

          // Mark used text nodes
          for (const tn of cellTexts) usedTextIds.add(tn.id);

          cells.push({
            row: r,
            col: c,
            x: cellX,
            y: cellY,
            width: cellW,
            height: cellH,
            text,
            fontSize: cellTexts[0]?.geometry.fontSize ?? 11,
            fontWeight: cellTexts[0]?.geometry.fontWeight ?? 'normal',
            fontFamily: cellTexts[0]?.geometry.fontFamily ?? 'sans-serif',
            color: cellTexts[0]?.geometry.color ?? '#000000',
            textAlign,
          });
        }
      }

      // Mark path nodes whose lines contributed to this table as "used"
      for (const [pid, segs] of pathLineMap.entries()) {
        const inRegion = segs.some(s =>
          isInRegion(s, region)
        );
        if (inRegion) usedPathIds.add(pid);
      }

      const tableData: TableData = {
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
        rows,
        cols,
        cells,
        rowHeights,
        colWidths,
      };

      tableNodes.push({
        id: nanoid(),
        name: `Table (${rows}×${cols})`,
        type: 'table',
        tableData,
        transform: { a: 1, b: 0, c: 0, d: 1, e: region.x, f: region.y },
        opacity: 1,
        blendMode: 'source-over',
        visible: true,
        locked: false,
      });
    }

    return { tableNodes, usedPathIds, usedTextIds };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractLineSegments(segments: PathSegment[]): LineSegment[] {
  const lines: LineSegment[] = [];
  let cx = 0, cy = 0;
  for (const seg of segments) {
    if (seg.type === 'moveTo') {
      cx = seg.points[0].x;
      cy = seg.points[0].y;
    } else if (seg.type === 'lineTo') {
      lines.push({ x1: cx, y1: cy, x2: seg.points[0].x, y2: seg.points[0].y });
      cx = seg.points[0].x;
      cy = seg.points[0].y;
    }
  }
  return lines;
}

/** Ensure x1 ≤ x2, y1 ≤ y2 */
function normalizeSegment(s: LineSegment): LineSegment {
  return {
    x1: Math.min(s.x1, s.x2), y1: Math.min(s.y1, s.y2),
    x2: Math.max(s.x1, s.x2), y2: Math.max(s.y1, s.y2),
  };
}

/**
 * Cluster an array of numeric values into groups within `tolerance` of each other.
 * Returns the centroid of each cluster, sorted ascending.
 */
function clusterValues(values: number[], tolerance: number): number[] {
  if (values.length === 0) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const clusters: number[][] = [[sorted[0]]];

  for (let i = 1; i < sorted.length; i++) {
    const last = clusters[clusters.length - 1];
    const clusterMid = last.reduce((s, v) => s + v, 0) / last.length;
    if (Math.abs(sorted[i] - clusterMid) <= tolerance) {
      last.push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }

  return clusters.map(c => c.reduce((s, v) => s + v, 0) / c.length).sort((a, b) => a - b);
}

/**
 * Given all horizontal (Y) and vertical (X) cluster centroids,
 * find rectangular sub-regions where both exist.
 */
function findGridRegions(
  allHCenters: number[],
  allVCenters: number[],
  hLines: LineSegment[],
  vLines: LineSegment[]
): GridRegion[] {
  // Build connectivity: for each h-line, what x range does it span?
  // We want to find a subset of h-centers and v-centers that form a connected grid.
  // Simple approach: treat all as one region if they form a sensible bounding box.

  // Group horizontal lines by their y-cluster
  const hByCluster = new Map<number, LineSegment[]>();
  for (const hl of hLines) {
    const cy = (hl.y1 + hl.y2) / 2;
    let bestCluster = allHCenters[0];
    let bestDist = Math.abs(cy - allHCenters[0]);
    for (const c of allHCenters) {
      const d = Math.abs(cy - c);
      if (d < bestDist) { bestDist = d; bestCluster = c; }
    }
    if (bestDist < 6) {
      if (!hByCluster.has(bestCluster)) hByCluster.set(bestCluster, []);
      hByCluster.get(bestCluster)!.push(hl);
    }
  }

  const vByCluster = new Map<number, LineSegment[]>();
  for (const vl of vLines) {
    const cx = (vl.x1 + vl.x2) / 2;
    let bestCluster = allVCenters[0];
    let bestDist = Math.abs(cx - allVCenters[0]);
    for (const c of allVCenters) {
      const d = Math.abs(cx - c);
      if (d < bestDist) { bestDist = d; bestCluster = c; }
    }
    if (bestDist < 6) {
      if (!vByCluster.has(bestCluster)) vByCluster.set(bestCluster, []);
      vByCluster.get(bestCluster)!.push(vl);
    }
  }

  // Find bounding box of ALL lines
  const allHY = [...hByCluster.keys()].sort((a, b) => a - b);
  const allVX = [...vByCluster.keys()].sort((a, b) => a - b);

  if (allHY.length < 2 || allVX.length < 2) return [];

  const minX = Math.min(...allVX);
  const maxX = Math.max(...allVX);
  const minY = Math.min(...allHY);
  const maxY = Math.max(...allHY);

  // Filter h-lines to those that span at least 40% of the table width
  const tableW = maxX - minX;
  const qualifiedH = allHY.filter(y => {
    const segs = hByCluster.get(y) ?? [];
    const maxLen = Math.max(...segs.map(s => s.x2 - s.x1));
    return maxLen >= tableW * 0.35;
  });

  // Filter v-lines to those that span at least 30% of the table height
  const tableH = maxY - minY;
  const qualifiedV = allVX.filter(x => {
    const segs = vByCluster.get(x) ?? [];
    const maxLen = Math.max(...segs.map(s => s.y2 - s.y1));
    return maxLen >= tableH * 0.25;
  });

  if (qualifiedH.length < 2 || qualifiedV.length < 2) return [];

  return [{
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    hLines: qualifiedH.sort((a, b) => a - b),
    vLines: qualifiedV.sort((a, b) => a - b),
  }];
}

function isInRegion(seg: LineSegment, region: GridRegion): boolean {
  const cx = (seg.x1 + seg.x2) / 2;
  const cy = (seg.y1 + seg.y2) / 2;
  return (
    cx >= region.x - 5 && cx <= region.x + region.width  + 5 &&
    cy >= region.y - 5 && cy <= region.y + region.height + 5
  );
}

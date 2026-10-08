/**
 * Perspective Warp — mesh data model.
 *
 * Rules:
 *  - Vertices are the source of truth. Edges and faces reference vertices by stable ID.
 *  - Layout Mode changes topology (add/remove/connect).
 *  - Warp Mode changes vertex positions only.
 *  - Shared vertices must remain shared to prevent tearing.
 */

/* ------------------------------------------------------------------ */
/*  Stable IDs                                                         */
/* ------------------------------------------------------------------ */

let _vid = 0;
let _eid = 0;
let _fid = 0;

export const warpVertexId = () => `wv_${++_vid}`;
export const warpEdgeId   = () => `we_${++_eid}`;
export const warpFaceId   = () => `wf_${++_fid}`;

/* ------------------------------------------------------------------ */
/*  Core types                                                         */
/* ------------------------------------------------------------------ */

export interface WarpPoint {
  x: number;
  y: number;
}

export interface WarpVertex {
  id: string;
  x: number;
  y: number;
  selected: boolean;
}

export interface WarpEdge {
  id: string;
  startVertexId: string;
  endVertexId: string;
  selected: boolean;
}

export interface WarpFace {
  id: string;
  vertexIds: [string, string, string, string];
  selected: boolean;
}

export interface WarpMesh {
  vertices: WarpVertex[];
  edges: WarpEdge[];
  faces: WarpFace[];
}

/* ------------------------------------------------------------------ */
/*  Selection state                                                    */
/* ------------------------------------------------------------------ */

export interface WarpSelection {
  vertexIds: Set<string>;
  edgeIds: Set<string>;
  faceIds: Set<string>;
}

export function emptySelection(): WarpSelection {
  return { vertexIds: new Set(), edgeIds: new Set(), faceIds: new Set() };
}

/* ------------------------------------------------------------------ */
/*  Mesh creation / mutation                                           */
/* ------------------------------------------------------------------ */

export function createMesh(): WarpMesh {
  return { vertices: [], edges: [], faces: [] };
}

export function addVertex(mesh: WarpMesh, x: number, y: number, id?: string): WarpVertex {
  const v: WarpVertex = { id: id ?? warpVertexId(), x, y, selected: false };
  mesh.vertices.push(v);
  return v;
}

export function removeVertex(mesh: WarpMesh, vertexId: string): void {
  mesh.vertices = mesh.vertices.filter(v => v.id !== vertexId);
  mesh.edges = mesh.edges.filter(e => e.startVertexId !== vertexId && e.endVertexId !== vertexId);
  mesh.faces = mesh.faces.filter(f => !f.vertexIds.includes(vertexId));
}

export function findVertex(mesh: WarpMesh, id: string): WarpVertex | undefined {
  return mesh.vertices.find(v => v.id === id);
}

export function findEdge(mesh: WarpMesh, id: string): WarpEdge | undefined {
  return mesh.edges.find(e => e.id === id);
}

export function findFace(mesh: WarpMesh, id: string): WarpFace | undefined {
  return mesh.faces.find(f => f.id === id);
}

/* ------------------------------------------------------------------ */
/*  Edge helpers                                                       */
/* ------------------------------------------------------------------ */

export function edgeKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

export function connectVertices(
  mesh: WarpMesh,
  aId: string,
  bId: string,
  id?: string
): WarpEdge | null {
  if (aId === bId) return null;
  const a = findVertex(mesh, aId);
  const b = findVertex(mesh, bId);
  if (!a || !b) return null;

  const key = edgeKey(aId, bId);
  if (mesh.edges.some(e => edgeKey(e.startVertexId, e.endVertexId) === key)) return null;

  const edge: WarpEdge = { id: id ?? warpEdgeId(), startVertexId: aId, endVertexId: bId, selected: false };
  mesh.edges.push(edge);
  return edge;
}

export function disconnectVertices(mesh: WarpMesh, edgeId: string): void {
  mesh.edges = mesh.edges.filter(e => e.id !== edgeId);
}

/* ------------------------------------------------------------------ */
/*  Face helpers                                                       */
/* ------------------------------------------------------------------ */

export function addFace(
  mesh: WarpMesh,
  vertexIds: [string, string, string, string],
  id?: string
): WarpFace | null {
  const unique = new Set(vertexIds);
  if (unique.size !== 4) return null;

  for (const vId of vertexIds) {
    if (!findVertex(mesh, vId)) return null;
  }

  const pts = vertexIds.map(id => findVertex(mesh, id)!);
  const area = quadArea(pts);
  if (area < 0.5) return null;

  const key = [...vertexIds].sort().join(',');
  if (mesh.faces.some(f => [...f.vertexIds].sort().join(',') === key)) return null;

  const face: WarpFace = { id: id ?? warpFaceId(), vertexIds, selected: false };
  mesh.faces.push(face);
  return face;
}

export function removeFace(mesh: WarpMesh, faceId: string): void {
  mesh.faces = mesh.faces.filter(f => f.id !== faceId);
}

/* ------------------------------------------------------------------ */
/*  Snap / merge helpers                                               */
/* ------------------------------------------------------------------ */

export const SNAP_RADIUS = 8;

export function mergeVertices(mesh: WarpMesh, targetId: string, sourceId: string): void {
  if (targetId === sourceId) return;
  const target = findVertex(mesh, targetId);
  const source = findVertex(mesh, sourceId);
  if (!target || !source) return;

  mesh.edges = mesh.edges.map(e => {
    if (e.startVertexId === sourceId) return { ...e, startVertexId: targetId };
    if (e.endVertexId === sourceId) return { ...e, endVertexId: targetId };
    return e;
  });

  mesh.faces = mesh.faces.map(f => {
    const vids = f.vertexIds.map(vid => vid === sourceId ? targetId : vid) as [string, string, string, string];
    const unique = [...new Set(vids)];
    if (unique.length < 3) return null;
    while (unique.length < 4) unique.push(unique[unique.length - 1]);
    return { ...f, vertexIds: unique as [string, string, string, string] };
  }).filter((f): f is WarpFace => f !== null);

  mesh.vertices = mesh.vertices.filter(v => v.id !== sourceId);
}

export function findClosestVertex(mesh: WarpMesh, pt: { x: number; y: number }, excludeId: string | null = null, snapRadius: number = SNAP_RADIUS): { vertex: WarpVertex; dist: number } | null {
  let best: { vertex: WarpVertex; dist: number } | null = null;
  for (const v of mesh.vertices) {
    if (excludeId && v.id === excludeId) continue;
    const d = Math.hypot(v.x - pt.x, v.y - pt.y);
    if (!best || d < best.dist) best = { vertex: v, dist: d };
  }
  if (best && best.dist <= snapRadius) return best;
  return null;
}

export function tryMergeTrianglesToQuad(mesh: WarpMesh, faceIdA: string, faceIdB: string): WarpFace | null {
  const fa = findFace(mesh, faceIdA);
  const fb = findFace(mesh, faceIdB);
  if (!fa || !fb) return null;

  const aSet = new Set(fa.vertexIds);
  const bSet = new Set(fb.vertexIds);
  if (aSet.size !== 3 || bSet.size !== 3) return null;

  const shared = [...aSet].filter(v => bSet.has(v));
  if (shared.length !== 2) return null;

  const aOnly = fa.vertexIds.filter(v => !shared.includes(v))[0];
  const bOnly = fb.vertexIds.filter(v => !shared.includes(v))[0];
  const quad = [shared[0], aOnly, shared[1], bOnly] as [string, string, string, string];

  removeFace(mesh, faceIdA);
  removeFace(mesh, faceIdB);
  return addFace(mesh, quad);
}

export function facesAreAdjacent(mesh: WarpMesh, faceIdA: string, faceIdB: string): boolean {
  const fa = findFace(mesh, faceIdA);
  const fb = findFace(mesh, faceIdB);
  if (!fa || !fb) return false;
  const aEdges = new Set<string>();
  for (let i = 0; i < fa.vertexIds.length; i++) {
    const a = fa.vertexIds[i];
    const b = fa.vertexIds[(i + 1) % fa.vertexIds.length];
    aEdges.add([a, b].sort().join(':'));
  }
  for (let i = 0; i < fb.vertexIds.length; i++) {
    const a = fb.vertexIds[i];
    const b = fb.vertexIds[(i + 1) % fb.vertexIds.length];
    if (aEdges.has([a, b].sort().join(':'))) return true;
  }
  return false;
}

export function faceVertices(mesh: WarpMesh, face: WarpFace): WarpVertex[] {
  return face.vertexIds.map(id => findVertex(mesh, id)).filter((v): v is WarpVertex => !!v);
}

export function facePoints(mesh: WarpMesh, face: WarpFace): { x: number; y: number }[] {
  return faceVertices(mesh, face).map(v => ({ x: v.x, y: v.y }));
}

/* ------------------------------------------------------------------ */
/*  Selection helpers                                                  */
/* ------------------------------------------------------------------ */

export function clearSelection(sel: WarpSelection): void {
  sel.vertexIds.clear();
  sel.edgeIds.clear();
  sel.faceIds.clear();
}

export function meshClearSelection(sel: any): void {
  sel.vertexIds = [];
  sel.edgeIds = [];
  sel.faceIds = [];
}

export function selectVerticesInRect(mesh: WarpMesh, sel: WarpSelection, x: number, y: number, w: number, h: number, additive = false): void {
  if (!additive) { sel.faceIds.clear(); sel.vertexIds.clear(); sel.edgeIds.clear(); }
  for (const v of mesh.vertices) {
    if (v.x >= x && v.x <= x + w && v.y >= y && v.y <= y + h) {
      sel.vertexIds.add(v.id);
    }
  }
}

export function selectFacesInRect(mesh: WarpMesh, sel: WarpSelection, x: number, y: number, w: number, h: number, additive = false): void {
  if (!additive) { sel.faceIds.clear(); sel.vertexIds.clear(); sel.edgeIds.clear(); }
  for (const face of mesh.faces) {
    const pts = faceVertices(mesh, face);
    const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
    const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
    if (cx >= x && cx <= x + w && cy >= y && cy <= y + h) {
      sel.faceIds.add(face.id);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Geometry utilities                                                 */
/* ------------------------------------------------------------------ */

function quadArea(pts: WarpVertex[]): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

export function quadBoundingBox(pts: { x: number; y: number }[]): { x: number; y: number; w: number; h: number } {
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function centroid(pts: { x: number; y: number }[]): { x: number; y: number } {
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
  };
}

export function scalePoints(pts: { x: number; y: number }[], pivot: { x: number; y: number }, sx: number, sy: number): { x: number; y: number }[] {
  return pts.map(p => ({
    x: pivot.x + (p.x - pivot.x) * sx,
    y: pivot.y + (p.y - pivot.y) * sy,
  }));
}

export function rotatePoints(pts: { x: number; y: number }[], pivot: { x: number; y: number }, angle: number): { x: number; y: number }[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return pts.map(p => ({
    x: pivot.x + (p.x - pivot.x) * cos - (p.y - pivot.y) * sin,
    y: pivot.y + (p.x - pivot.x) * sin + (p.y - pivot.y) * cos,
  }));
}

export function skewPoints(pts: { x: number; y: number }[], pivot: { x: number; y: number }, sx: number, sy: number): { x: number; y: number }[] {
  return pts.map(p => ({
    x: p.x + (p.y - pivot.y) * sx,
    y: p.y + (p.x - pivot.x) * sy,
  }));
}

/* ------------------------------------------------------------------ */
/*  Default mesh for a layer                                           */
/* ------------------------------------------------------------------ */

export function buildDefaultMesh(width: number, height: number): WarpMesh {
  const mesh = createMesh();
  const cols = 4;
  const rows = 4;

  const grid: WarpVertex[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1)) * width;
      const y = (r / (rows - 1)) * height;
      grid[r][c] = addVertex(mesh, x, y);
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      connectVertices(mesh, grid[r][c].id, grid[r][c + 1].id);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols; c++) {
      connectVertices(mesh, grid[r][c].id, grid[r + 1][c].id);
    }
  }

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      addFace(mesh, [grid[r][c].id, grid[r][c + 1].id, grid[r + 1][c + 1].id, grid[r + 1][c].id]);
    }
  }

  return mesh;
}

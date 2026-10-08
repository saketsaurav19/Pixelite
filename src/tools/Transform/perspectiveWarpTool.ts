import type { ToolModule } from '../types';
import { toolState } from '../toolState';
import { useStore } from '../../store/useStore';
import type { WarpFace, WarpVertex } from '../../utils/warpMesh';
import {
  type WarpMesh,
  buildDefaultMesh, addVertex, connectVertices, disconnectVertices,
  addFace, removeFace, removeVertex,
  emptySelection, selectVerticesInRect, selectFacesInRect,
  clearSelection, centroid,
  scalePoints, rotatePoints, skewPoints,
  findClosestVertex, mergeVertices, tryMergeTrianglesToQuad, facesAreAdjacent, SNAP_RADIUS,
} from '../../utils/warpMesh';
import type { Point } from '../../components/Canvas/types';

/* ------------------------------------------------------------------ */
/*  Self-contained PW state lives on toolState — no Zustand needed    */
/* ------------------------------------------------------------------ */

type PwMode = 'layout' | 'warp';
type PwOp = 'select' | 'move' | 'scale' | 'rotate' | 'skew' | 'perspective' | 'add_vertex' | 'connect' | 'create_plane';

interface PWArraySelection {
  vertexIds: string[];
  edgeIds: string[];
  faceIds: string[];
}

function pwEnsureState() {
  if (!(toolState as any)._pwMode) (toolState as any)._pwMode = 'layout';
  if (!(toolState as any)._pwOp) (toolState as any)._pwOp = 'select';
  if (!(toolState as any)._pwMesh) (toolState as any)._pwMesh = null;
  if (!(toolState as any)._pwSelection) (toolState as any)._pwSelection = emptySelection();
  if (!(toolState as any)._pwSnapEnabled) (toolState as any)._pwSnapEnabled = true;
}

pwEnsureState();

export const pwGetMode = (): PwMode => (toolState as any)._pwMode as PwMode;
export const pwSetMode = (m: PwMode) => { (toolState as any)._pwMode = m; };

export const pwGetOp = (): PwOp => (toolState as any)._pwOp as PwOp;
export const pwSetOp = (o: PwOp) => { (toolState as any)._pwOp = o; };

export const pwGetSnap = (): boolean => (toolState as any)._pwSnapEnabled !== false;
export const pwToggleSnap = () => { (toolState as any)._pwSnapEnabled = !(toolState as any)._pwSnapEnabled; };

export const pwGetMesh = (): WarpMesh | null => (toolState as any)._pwMesh as WarpMesh | null;
export const pwSetMesh = (m: WarpMesh) => { (toolState as any)._pwMesh = JSON.parse(JSON.stringify(m)); };

export const pwGetSelection = (): PWArraySelection => {
  const s = (toolState as any)._pwSelection || emptySelection();
  return {
    vertexIds: [...(s.vertexIds || [])],
    edgeIds: [...(s.edgeIds || [])],
    faceIds: [...(s.faceIds || [])],
  };
};
export const pwSetSelection = (s: PWArraySelection) => {
  const sel = (toolState as any)._pwSelection || emptySelection();
  sel.vertexIds = s.vertexIds;
  sel.edgeIds = s.edgeIds;
  sel.faceIds = s.faceIds;
  (toolState as any)._pwSelection = sel;
};
export const pwClearSelection = () => {
  const sel = (toolState as any)._pwSelection || emptySelection();
  clearSelection(sel);
  (toolState as any)._pwSelection = sel;
};

export const pwResetMesh = (layer: any) => {
  if (!layer) return;
  const w = Math.max(1, layer.width || 100);
  const h = Math.max(1, layer.height || 100);
  const mesh = buildDefaultMesh(w, h);
  pwSetMesh(mesh);
  pwClearSelection();
  (toolState as any)._pwDrag = null;
  (toolState as any)._pwRectEnd = null;
};

export const pwSaveToLayer = (layer: any) => {
  if (!layer) return;
  const mesh = pwGetMesh();
  const sel = (toolState as any)._pwSelection || emptySelection();
  if (mesh) {
    useStore.getState().updateLayer(layer.id, {
      warpMesh: {
        vertices: mesh.vertices.map(v => ({ ...v })),
        edges: mesh.edges.map(e => ({ ...e })),
        faces: mesh.faces.map(f => ({ ...f })),
      },
      warpMeshSelection: {
        vertexIds: [...(sel.vertexIds || [])],
        edgeIds: [...(sel.edgeIds || [])],
        faceIds: [...(sel.faceIds || [])],
      },
      warpMeshRest: JSON.parse(JSON.stringify(mesh)),
    });
  }
};

/* ------------------------------------------------------------------ */
/*  Tool Module                                                        */
/* ------------------------------------------------------------------ */

export const perspectiveWarpTool: ToolModule = {
  id: 'perspective_warp',

  start: ({ activeLayerId, layers, setIsInteracting }) => {
    setIsInteracting(true);
    const layer = layers.find((l: any) => l.id === activeLayerId);
    if (!layer) return;

    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    if (canvas) {
      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const copyCtx = copy.getContext('2d');
      if (copyCtx) {
        copyCtx.drawImage(canvas, 0, 0);
        toolState.transformOriginalCanvas = copy;
      }
    }

    pwEnsureState();
    const mesh = buildDefaultMesh(Math.max(1, layer.width || 100), Math.max(1, layer.height || 100));
    pwSetMesh(mesh);
    pwClearSelection();
    (toolState as any)._pwDrag = null;
    (toolState as any)._pwRectEnd = null;
  },

  move: ({ coords, lastPoint, activeLayerId, layers, isShift }) => {
    const mesh = pwGetMesh();
    if (!mesh) return;

    const drag = (toolState as any)._pwDrag;
    if (!drag) return;

    if (drag.type === 'rectangle') {
      const layer = layers.find((l: any) => l.id === activeLayerId);
      const layerX = layer?.position?.x || 0;
      const layerY = layer?.position?.y || 0;
      (toolState as any)._pwRectEnd = { x: coords.x - layerX, y: coords.y - layerY };
      return;
    }

    const lp = lastPoint;
    if (!lp) return;

    const dx = coords.x - lp.x;
    const dy = coords.y - lp.y;

    if (drag.type === 'vertex') {
      const vertexIds = drag.vertexIds as string[];
      const snapEnabled = pwGetSnap();
      for (const id of vertexIds) {
        const v = mesh.vertices.find((vv: WarpVertex) => vv.id === id);
        if (!v) continue;
        v.x += dx;
        v.y += dy;
        if (snapEnabled) {
          const hit = findClosestVertex(mesh, { x: v.x, y: v.y }, id, SNAP_RADIUS);
          if (hit) {
            v.x = hit.vertex.x;
            v.y = hit.vertex.y;
          }
        }
      }
    } else if (drag.type === 'face') {
      const faceIds = drag.faceIds as string[];
      const movedVerts = new Set<string>();
      for (const fid of faceIds) {
        const face = mesh.faces.find((ff: WarpFace) => ff.id === fid);
        if (face) {
          for (const vid of face.vertexIds) movedVerts.add(vid);
        }
      }
      for (const vid of movedVerts) {
        const v = mesh.vertices.find((vv: WarpVertex) => vv.id === vid);
        if (v) { v.x += dx; v.y += dy; }
      }
    } else if (drag.type === 'transform') {
      const sel = pwGetSelection();
      const vertexIds = [...(sel.vertexIds || [])];
      if (vertexIds.length === 0) return;

      const verts = vertexIds.map((id: string) => mesh.vertices.find((v: WarpVertex) => v.id === id)!).filter(Boolean);
      if (verts.length === 0) return;

      const pts = verts.map(v => ({ x: v.x, y: v.y }));
      const pivot = drag.pivot || centroid(pts);
      const localCoords = coords;
      const origin = drag.origin;

      let result: { x: number; y: number }[] = pts;
      if (drag.operation === 'scale') {
        const ox = origin.x - pivot.x || 1;
        const oy = origin.y - pivot.y || 1;
        const nsx = 1 + (localCoords.x - pivot.x) / ox;
        const nsy = 1 + (localCoords.y - pivot.y) / oy;
        const sx = isShift ? Math.max(nsx, nsy) : nsx;
        const sy = isShift ? Math.max(nsx, nsy) : nsy;
        result = scalePoints(pts, pivot, sx, sy);
      } else if (drag.operation === 'rotate') {
        const angle = Math.atan2(localCoords.y - pivot.y, localCoords.x - pivot.x) - drag.startAngle;
        result = rotatePoints(pts, pivot, angle);
      } else if (drag.operation === 'skew') {
        const skx = (localCoords.x - pivot.x) * 0.008;
        const sky = (localCoords.y - pivot.y) * 0.008;
        result = skewPoints(pts, pivot, skx, sky);
      }

      for (let i = 0; i < verts.length; i++) {
        verts[i].x = result[i].x;
        verts[i].y = result[i].y;
      }
    }

    pwSetMesh(mesh);
  },

  end: () => {
    const state = useStore.getState();
    const layer = state.layers.find((l: any) => l.id === state.activeLayerId);
    if (!layer) return;
    const mesh = pwGetMesh();

    if ((toolState as any)._pwDrag?.type === 'rectangle' && (toolState as any)._pwRectEnd) {
      const start = (toolState as any)._pwDrag.start;
      const end = (toolState as any)._pwRectEnd;
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      const sel = (toolState as any)._pwSelection || emptySelection();

      if (w > 3 && h > 3 && mesh) {
        const mode = pwGetMode();
        const op = pwGetOp();

        if (mode === 'layout' && op === 'create_plane') {
          const ids: [string, string, string, string] = [
            addVertex(mesh, x, y).id,
            addVertex(mesh, x + w, y).id,
            addVertex(mesh, x + w, y + h).id,
            addVertex(mesh, x, y + h).id,
          ];
          connectVertices(mesh, ids[0], ids[1]);
          connectVertices(mesh, ids[1], ids[2]);
          connectVertices(mesh, ids[2], ids[3]);
          connectVertices(mesh, ids[3], ids[0]);
          const face = addFace(mesh, ids);
          if (face) {
            snapNewFaceToMesh(mesh, face);
            pwClearSelection();
            pwSetSelection({ vertexIds: [], edgeIds: [], faceIds: [face.id] });
            pwSetMesh(mesh);
            autoMergeTriangles(mesh, layer);
          }
        } else if (mode === 'layout') {
          selectVerticesInRect(mesh, sel as any, x, y, w, h, (toolState as any)._pwAdditive);
        } else {
          selectFacesInRect(mesh, sel as any, x, y, w, h, (toolState as any)._pwAdditive);
        }
        pwSetSelection({
          vertexIds: [...((sel as any).vertexIds || [])],
          edgeIds: [...((sel as any).edgeIds || [])],
          faceIds: [...((sel as any).faceIds || [])],
        });
      }

      delete (toolState as any)._pwRectEnd;
    }

    if ((toolState as any)._pwDrag && layer.warpMesh) {
      useStore.getState().recordHistory?.('Warp Edit');
    }

    if ((toolState as any)._pwDrag?.type === 'vertex' && layer.warpMesh) {
      const curMesh = pwGetMesh();
      if (curMesh) autoMergeTriangles(curMesh, layer);
    }

    (toolState as any)._pwDrag = null;
  },

  doubleClick: ({ activeLayerId: _activeLayerId, layers: _layers }) => {
    if (!pwGetMesh()) return;

    if ((toolState as any)._pwDrag?.type === 'none') {
      pwClearSelection();
    }
  },
};

/* ------------------------------------------------------------------ */
/*  Mesh interaction helpers                                           */
/* ------------------------------------------------------------------ */

export const pwStartVertexDrag = (vertexId: string, additive = false) => {
  if (!pwGetMesh()) return;

  const arrSel = pwGetSelection();

  if (!additive) {
    arrSel.vertexIds = [];
    arrSel.edgeIds = [];
    arrSel.faceIds = [];
  }
  if (!arrSel.vertexIds.includes(vertexId)) arrSel.vertexIds.push(vertexId);
  pwSetSelection(arrSel);

  (toolState as any)._pwDrag = { type: 'vertex', vertexIds: [...arrSel.vertexIds], snap: pwGetSnap() };
};

export const pwStartFaceDrag = (faceId: string, additive = false) => {
  const arrSel = pwGetSelection();

  if (!additive) {
    arrSel.vertexIds = [];
    arrSel.edgeIds = [];
    arrSel.faceIds = [];
  }
  if (!arrSel.faceIds.includes(faceId)) arrSel.faceIds.push(faceId);
  pwSetSelection(arrSel);

  (toolState as any)._pwDrag = { type: 'face', faceIds: [...arrSel.faceIds] };
};

export const pwStartTransformDrag = (operation: 'scale' | 'rotate' | 'skew' | 'perspective') => {
  const mesh = pwGetMesh();
  if (!mesh) return;

  const sel = pwGetSelection();
  const vertexIds = [...(sel.vertexIds || [])];

  if (vertexIds.length === 0) return;

  const verts = vertexIds.map((id: string) => mesh.vertices.find((v: WarpVertex) => v.id === id)!).filter(Boolean);
  const pts = verts.map(v => ({ x: v.x, y: v.y }));
  const pivot = centroid(pts);

  (toolState as any)._pwDrag = {
    type: 'transform',
    operation,
    vertexIds,
    pivot,
    origin: { ...(useStore.getState().lastPointerPos ?? pivot) },
    startAngle: Math.atan2(
      (useStore.getState().lastPointerPos?.y ?? pivot.y) - pivot.y,
      (useStore.getState().lastPointerPos?.x ?? pivot.x) - pivot.x
    ),
  };
};

export const pwStartRectSelect = (start: Point, additive = false) => {
  (toolState as any)._pwDrag = { type: 'rectangle', start: { ...start } };
  (toolState as any)._pwAdditive = additive;
  (toolState as any)._pwRectEnd = null;
};

export const pwAddVertex = (x: number, y: number) => {
  const mesh = pwGetMesh();
  if (!mesh) return null;

  const v = addVertex(mesh, x, y);
  pwSetMesh(mesh);
  return v;
};

export const pwDeleteSelected = () => {
  const mesh = pwGetMesh();
  if (!mesh) return;

  const sel = pwGetSelection();

  for (const fid of [...(sel.faceIds || [])]) removeFace(mesh, fid);
  for (const eid of [...(sel.edgeIds || [])]) disconnectVertices(mesh, eid);
  for (const vid of [...(sel.vertexIds || [])]) removeVertex(mesh, vid);

  pwClearSelection();
  pwSetMesh(mesh);
};

export const pwConnectSelected = () => {
  const mesh = pwGetMesh();
  if (!mesh) return;

  const sel = pwGetSelection();
  const ids = [...(sel.vertexIds || [])];
  if (ids.length < 2) return;

  let connected = 0;
  for (let i = 0; i < ids.length - 1; i++) {
    const edge = connectVertices(mesh, ids[i], ids[i + 1]);
    if (edge) connected++;
  }

  if (connected > 0) {
    pwSetMesh(mesh);
  }
};

export const pwCreateFaceFromSelection = () => {
  const mesh = pwGetMesh();
  if (!mesh) return null;

  const sel = pwGetSelection();
  const ids = [...(sel.vertexIds || [])];
  if (ids.length !== 4) return null;

  const face = addFace(mesh, [ids[0], ids[1], ids[2], ids[3]] as [string, string, string, string]);
  if (face) {
    pwClearSelection();
    pwSetSelection({ vertexIds: [], edgeIds: [], faceIds: [face.id] });
    pwSetMesh(mesh);
  }
  return face;
};

/* ------------------------------------------------------------------ */
/*  Snap / merge helpers                                              */
/* ------------------------------------------------------------------ */

function snapNewFaceToMesh(mesh: WarpMesh, face: WarpFace) {
  for (const vid of face.vertexIds) {
    const v = mesh.vertices.find(vv => vv.id === vid);
    if (!v) continue;
    const hit = findClosestVertex(mesh, { x: v.x, y: v.y }, vid, SNAP_RADIUS);
    if (hit) {
      mergeVertices(mesh, hit.vertex.id, vid);
    }
  }
}

function autoMergeTriangles(mesh: WarpMesh, _layer: any) {
  let merged = true;
  let iterations = 0;
  while (merged && iterations < 50) {
    merged = false;
    iterations++;
    const triFaces = mesh.faces.filter(f => new Set(f.vertexIds).size === 3);
    for (let i = 0; i < triFaces.length && !merged; i++) {
      for (let j = i + 1; j < triFaces.length && !merged; j++) {
        if (facesAreAdjacent(mesh, triFaces[i].id, triFaces[j].id)) {
          const quad = tryMergeTrianglesToQuad(mesh, triFaces[i].id, triFaces[j].id);
          if (quad) {
            merged = true;
            break;
          }
        }
      }
    }
  }
  if (iterations > 1) {
    pwSetMesh(mesh);
  }
}

export const pwSnapMergeSelected = () => {
  const mesh = pwGetMesh();
  if (!mesh) return;
  const sel = pwGetSelection();
  const vertexIds = [...(sel.vertexIds || [])];

  if (vertexIds.length < 2) return;

  const targetId = vertexIds[0];
  for (let i = 1; i < vertexIds.length; i++) {
    mergeVertices(mesh, targetId, vertexIds[i]);
  }

  pwClearSelection();
  pwSetSelection({ vertexIds: [targetId], edgeIds: [], faceIds: [] });
  pwSetMesh(mesh);
};

export const pwMergeAdjacentTriangles = () => {
  const mesh = pwGetMesh();
  if (!mesh) return;
  autoMergeTriangles(mesh, null as any);
};

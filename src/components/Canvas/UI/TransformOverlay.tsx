import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Point } from '../types';
import { stopOverlayEvent } from '../Core/eventUtils';
import { toolState } from '../../../tools/toolState';
import { useStore } from '../../../store/useStore';
import { usePuppetWarp } from '../../../tools/Transform/usePuppetWarp';
import {
  type WarpVertex, facePoints, meshClearSelection, SNAP_RADIUS,
} from '../../../utils/warpMesh';
import {
  pwGetMesh, pwGetSelection, pwGetMode, pwSetMode, pwGetOp, pwSetOp,
  pwStartVertexDrag, pwStartFaceDrag, pwStartRectSelect, pwStartTransformDrag,
  pwAddVertex, pwDeleteSelected, pwConnectSelected, pwCreateFaceFromSelection,
  pwResetMesh, pwClearSelection, pwSetMesh, pwGetSnap,
} from '../../../tools/Transform/perspectiveWarpTool';
import { buildDefaultMesh } from '../../../utils/warpMesh';

interface TransformOverlayProps {
  activeLayerId: string;
  layers: any[];
  documentSize: { w: number; h: number };
  zoom: number;
  canvasOffset: { x: number; y: number };
  canvasRotation: number;
  findLayerAbsoluteRect: (id: string, layers: any[]) => any;
  setActiveCropHandle: (handle: string | null) => void;
  setIsInteracting: (val: boolean) => void;
  getCoordinates: (clientX: number, clientY: number) => Point | null;
  lastPointRef: React.MutableRefObject<Point | null>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TransformOverlay: React.FC<TransformOverlayProps> = ({
  activeLayerId,
  layers,
  documentSize,
  zoom,
  canvasOffset,
  canvasRotation,
  findLayerAbsoluteRect,
  setActiveCropHandle,
  setIsInteracting,
  getCoordinates,
  lastPointRef,
  onConfirm,
  onCancel,
}) => {
  const rect = findLayerAbsoluteRect(activeLayerId, layers);
  if (!rect) return null;

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isWarped = activeLayer && activeLayer.type === 'text' && activeLayer.textWarp && activeLayer.textWarp.style !== 'None';

  let w = rect.w || documentSize.w;
  let h = rect.h || documentSize.h;
  let x = rect.x;
  let y = rect.y;

  if (isWarped) {
    const padX = Math.round(w * 0.3) + 20;
    const padY = Math.round(h * 0.8) + 20;
    w = w + 2 * padX;
    h = h + 2 * padY;
    x = x - padX;
    y = y - padY;
  }

  const mode = useStore(state => state.transformMode);
  const updateLayer = useStore(state => state.updateLayer);
  const activeTool = useStore(state => state.activeTool);
  const puppetShowMesh = useStore(state => state.puppetShowMesh);
  const corners = activeLayer?.corners;
  const warpGrid = activeLayer?.warpGrid;

  const pw = usePuppetWarp({
    activeLayerId,
    layer: activeLayer,
    transformMode: mode,
    activeTool,
    updateLayer,
    getCoordinates,
    zoom,
  });

  /* ================================================================== */
  /*  Puppet warp mesh contrast — adapt stroke to background luminance   */
  /* ================================================================== */
  const [meshOnDark, setMeshOnDark] = useState(true); // true = background is dark -> use light mesh
  useEffect(() => {
    const url = activeLayer?.dataUrl;
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      try {
        const S = 32;
        const c = document.createElement('canvas');
        c.width = S;
        c.height = S;
        const cx = c.getContext('2d');
        if (!cx) return;
        cx.drawImage(img, 0, 0, S, S);
        const data = cx.getImageData(0, 0, S, S).data;
        let sum = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 16) continue; // ignore transparent pixels
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          sum += lum;
          count++;
        }
        const avg = count ? sum / count : 0;
        // near black background -> render light mesh; near white -> dark mesh
        setMeshOnDark(avg < 128);
      } catch {
        /* ignore cross-origin / parse errors, keep default */
      }
    };
    img.src = url;
  }, [activeLayer?.dataUrl]);

  const meshStroke = meshOnDark ? 'rgba(255, 255, 255, 0.75)' : 'rgba(0, 0, 0, 0.75)';

  /* ================================================================== */
  /*  Perspective Warp — self-contained state via React hooks           */
  /* ================================================================== */

  const pwMode = pwGetMode();
  const pwOp = pwGetOp();
  const layerX = activeLayer?.position?.x || 0;
  const layerY = activeLayer?.position?.y || 0;

  // Sync when the active layer changes — rebuild mesh for the new layer size.
  const prevLayerIdRef = useRef(activeLayerId);
  useEffect(() => {
    if (prevLayerIdRef.current !== activeLayerId) {
      prevLayerIdRef.current = activeLayerId;
      const layer = layers.find((l: any) => l.id === activeLayerId);
      if (layer) {
        pwResetMesh(layer);
      }
    }
  }, [activeLayerId, layers]);

  // When entering Create Plane mode, always clear mesh and selection so old
  // selections never block drawing a new rectangle.
  const prevCreatePlaneRef = useRef(false);
  useEffect(() => {
    if (pwMode === 'layout' && pwOp === 'create_plane') {
      if (!prevCreatePlaneRef.current) {
        prevCreatePlaneRef.current = true;
        const layer = layers.find((l: any) => l.id === activeLayerId);
        if (layer) {
          const empty = { vertices: [], edges: [], faces: [] };
          pwResetMesh(layer);
          // Also clear layer-stored selection
          updateLayer(layer.id, {
            warpMesh: JSON.parse(JSON.stringify(empty)),
            warpMeshSelection: { vertexIds: [], edgeIds: [], faceIds: [] },
          });
        }
      }
    } else {
      prevCreatePlaneRef.current = false;
    }
  }, [pwMode, pwOp, activeLayerId, layers, updateLayer]);

  // Reset when switching away from perspective_warp tool entirely.
  const prevToolRef = useRef(activeTool);
  useEffect(() => {
    if (activeTool !== 'perspective_warp' && prevToolRef.current === 'perspective_warp') {
      pwResetMesh(activeLayer);
      pwClearSelection();
      if (activeLayer) {
        updateLayer(activeLayer.id, {
          warpMesh: { vertices: [], edges: [], faces: [] },
          warpMeshSelection: { vertexIds: [], edgeIds: [], faceIds: [] },
        });
      }
    }
    prevToolRef.current = activeTool;
  }, [activeTool, activeLayer, updateLayer]);

  // Build a fresh mesh from layer dimensions if the mesh is empty and we're
  // not in create_plane mode.
  const mesh = pwGetMesh();
  const [, setLocalMeshTick] = useState(0);
  useEffect(() => {
    if (!mesh || mesh.vertices.length === 0) {
      if (pwOp !== 'create_plane' && activeLayer) {
        const w = Math.max(1, activeLayer.width || 100);
        const h = Math.max(1, activeLayer.height || 100);
        const newMesh = buildDefaultMesh(w, h);
        pwSetMesh(newMesh);
        pwResetMesh(activeLayer);
        setLocalMeshTick(t => t + 1);
      }
    }
  }, [mesh?.vertices?.length, pwOp, activeLayer]);

  const currentMesh = pwGetMesh();

  const sel = pwGetSelection();

  // Convert to canvas space for rendering
  const canvasVerts = currentMesh ? currentMesh.vertices.map(v => ({ id: v.id, x: v.x + layerX, y: v.y + layerY, selected: v.selected })) : [];
  const canvasSelIds = new Set([...(sel?.vertexIds || []), ...(sel?.edgeIds || []), ...(sel?.faceIds || [])]);

  // Compute bounds for info label
  let xs: number[] = [];
  let ys: number[] = [];
  if (canvasVerts.length) {
    xs = canvasVerts.map(v => v.x);
    ys = canvasVerts.map(v => v.y);
  }
  const pwXMin = xs.length ? Math.min(...xs) : 0;
  const pwYMin = ys.length ? Math.min(...ys) : 0;
  const pwYMax = ys.length ? Math.max(...ys) : 0;

  const vertMap = new Map<string, WarpVertex>();
  if (currentMesh) {
    for (const v of currentMesh.vertices) vertMap.set(v.id, v);
  }

  const onCanvasDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    stopOverlayEvent(e);
    const isTouch = 'touches' in e;
    const clientX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    const c = getCoordinates(clientX, clientY);
    if (!c) return;

    const local = { x: c.x - layerX, y: c.y - layerY };

    const hitR = 10 / (zoom || 1);
    let hitVertex: WarpVertex | undefined;
    if (currentMesh) {
      for (const v of currentMesh.vertices) {
        if (Math.hypot(v.x - local.x, v.y - local.y) <= hitR) { hitVertex = v; break; }
      }
    }

    const additive = (e as any).shiftKey || (e as any).ctrlKey || (e as any).metaKey;

    if (!currentMesh) {
      if (pwOp === 'create_plane') {
        meshClearSelection(sel);
        pwStartRectSelect(local, additive);
        setIsInteracting(true);
      }
      return;
    }

    if (pwMode === 'layout') {
      if (pwOp === 'add_vertex') {
        const v = pwAddVertex(local.x, local.y);
        if (v) pwStartVertexDrag(v.id, additive);
      } else if (pwOp === 'create_plane') {
        meshClearSelection(sel);
        pwStartRectSelect(local, additive);
      } else if (hitVertex) {
        if (pwOp === 'connect') {
          const selNow = pwGetSelection();
          const vids = selNow.vertexIds || [];
          if (vids.length === 1) {
            pwConnectSelected();
            meshClearSelection(selNow);
            pwStartVertexDrag(hitVertex.id, additive);
          } else {
            meshClearSelection(selNow);
            pwStartVertexDrag(hitVertex.id, additive);
          }
        } else {
          pwStartVertexDrag(hitVertex.id, additive);
        }
      } else {
        pwStartRectSelect(local, additive);
      }
    } else {
      // Warp mode
      if (hitVertex) {
        if (pwOp === 'select') {
          pwStartVertexDrag(hitVertex.id, additive);
        } else {
          pwStartVertexDrag(hitVertex.id, false);
          pwStartTransformDrag(pwOp as any);
        }
      } else if (currentMesh) {
        const insideFace = currentMesh.faces.find(f => {
          const pts = facePoints(currentMesh, f).map(p => ({ ...p, x: p.x + layerX, y: p.y + layerY }));
          return pointInQuad(local, pts);
        });
        if (insideFace) {
          if (pwOp === 'select') {
            pwStartFaceDrag(insideFace.id, additive);
          } else {
            pwStartFaceDrag(insideFace.id, false);
            pwStartTransformDrag(pwOp as any);
          }
        } else if (pwOp === 'select') {
          pwStartRectSelect(local, additive);
        }
      }
    }
    lastPointRef.current = c;
    setIsInteracting(true);
  }, [getCoordinates, layerX, layerY, currentMesh, pwMode, pwOp, zoom, setIsInteracting, lastPointRef]);

  function pointInQuad(pt: { x: number; y: number }, quad: { x: number; y: number }[]) {
    let inside = false;
    for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
      if (((quad[i].y > pt.y) !== (quad[j].y > pt.y)) &&
        (pt.x < (quad[j].x - quad[i].x) * (pt.y - quad[i].y) / (quad[j].y - quad[i].y) + quad[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  }

  const handleMouseDown = (handle: string) => (e: React.MouseEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.clientX, e.clientY);
    if (c) {
      lastPointRef.current = c;
      toolState._transformStartCoords = { ...c };
    }
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      let startW = layer.width || documentSize.w;
      let startH = layer.height || documentSize.h;
      let startX = layer.position?.x || 0;
      let startY = layer.position?.y || 0;
      if (isWarped) {
        const padX = Math.round(startW * 0.3) + 20;
        const padY = Math.round(startH * 0.8) + 20;
        startW = startW + 2 * padX;
        startH = startH + 2 * padY;
        startX = startX - padX;
        startY = startY - padY;
      }
      toolState._transformStartLayerPos = { x: startX, y: startY };
      toolState._transformStartLayerSize = { w: startW, h: startH };
      toolState._transformStartLayerRotation = layer.rotation || 0;
      toolState._transformStartCornersList = layer.corners ? layer.corners.map((p: any) => ({ ...p })) : undefined;
      if (mode === 'warp' && layer.warpGrid) {
        toolState._warpStartGrid = layer.warpGrid.map((point: any) => ({ ...point }));
        toolState._warpActivePointIdx = Number(handle.replace('warp-', ''));
      }
    }
    toolState._transformActiveHandle = handle;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  const handleTouchStart = (handle: string) => (e: React.TouchEvent) => {
    stopOverlayEvent(e);
    const c = getCoordinates(e.touches[0].clientX, e.touches[0].clientY);
    if (c) {
      lastPointRef.current = c;
      toolState._transformStartCoords = { ...c };
    }
    const layer = layers.find(l => l.id === activeLayerId);
    if (layer) {
      let startW = layer.width || documentSize.w;
      let startH = layer.height || documentSize.h;
      let startX = layer.position?.x || 0;
      let startY = layer.position?.y || 0;
      if (isWarped) {
        const padX = Math.round(startW * 0.3) + 20;
        const padY = Math.round(startH * 0.8) + 20;
        startW = startW + 2 * padX;
        startH = startH + 2 * padY;
        startX = startX - padX;
        startY = startY - padY;
      }
      toolState._transformStartLayerPos = { x: startX, y: startY };
      toolState._transformStartLayerSize = { w: startW, h: startH };
      toolState._transformStartLayerRotation = layer.rotation || 0;
      toolState._transformStartCornersList = layer.corners ? layer.corners.map((p: any) => ({ ...p })) : undefined;
      if (mode === 'warp' && layer.warpGrid) {
        toolState._warpStartGrid = layer.warpGrid.map((point: any) => ({ ...point }));
        toolState._warpActivePointIdx = Number(handle.replace('warp-', ''));
      }
    }
    toolState._transformActiveHandle = handle;
    setActiveCropHandle(handle);
    setIsInteracting(true);
  };

  // Determine bounds of current transformed layout to position the confirmation actions bar
  if (corners) {
    xs = corners.map((p: { x: number; y: number }) => p.x);
    ys = corners.map((p: { x: number; y: number }) => p.y);
  } else if (warpGrid) {
    xs = warpGrid.map((p: { x: number; y: number }) => p.x);
    ys = warpGrid.map((p: { x: number; y: number }) => p.y);
  } else {
    const lx = rect.x;
    const ly = rect.y;
    const lw = w;
    const lh = h;
    const lr = rect.rotation || 0;
    const theta = (lr * Math.PI) / 180;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    const localCorners = [
      { x: 0, y: 0 },
      { x: lw, y: 0 },
      { x: lw, y: lh },
      { x: 0, y: lh }
    ];
    const rotatedCorners = localCorners.map(p => ({
      x: lx + p.x * cosT - p.y * sinT,
      y: ly + p.x * sinT + p.y * cosT
    }));

    xs = rotatedCorners.map(p => p.x);
    ys = rotatedCorners.map(p => p.y);
  }

  const xMin = xs.length > 0 ? Math.min(...xs) : rect.x;
  const xMax = xs.length > 0 ? Math.max(...xs) : rect.x + w;
  const yMax = ys.length > 0 ? Math.max(...ys) : rect.y + h;

  const isDeformed = ['skew', 'distort', 'perspective', 'warp', 'puppet'].includes(mode);

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${documentSize.w}px`,
        height: `${documentSize.h}px`,
        transform: `translate(-50%, -50%) scale(1) translate(${canvasOffset.x}px, ${canvasOffset.y}px) rotate(${canvasRotation}deg)`,
        transformOrigin: 'center center',
        zIndex: 1500,
      }}
    >
      {/* 1. Warp mesh overlay (4x4 grid) */}
      {mode === 'warp' && warpGrid && warpGrid.length === 16 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            {Array.from({ length: 4 }).map((_, r) => (
              <path
                key={`h-line-${r}`}
                d={`M ${warpGrid[r * 4].x},${warpGrid[r * 4].y} L ${warpGrid[r * 4 + 1].x},${warpGrid[r * 4 + 1].y} L ${warpGrid[r * 4 + 2].x},${warpGrid[r * 4 + 2].y} L ${warpGrid[r * 4 + 3].x},${warpGrid[r * 4 + 3].y}`}
                fill="none"
                stroke="#0078d4"
                strokeWidth={1.5 / zoom}
              />
            ))}
            {Array.from({ length: 4 }).map((_, c) => (
              <path
                key={`v-line-${c}`}
                d={`M ${warpGrid[c].x},${warpGrid[c].y} L ${warpGrid[4 + c].x},${warpGrid[4 + c].y} L ${warpGrid[8 + c].x},${warpGrid[8 + c].y} L ${warpGrid[12 + c].x},${warpGrid[12 + c].y}`}
                fill="none"
                stroke="#0078d4"
                strokeWidth={1.5 / zoom}
              />
            ))}
          </svg>

          {warpGrid.map((point: { x: number; y: number }, idx: number) => (
            <div
              key={`warp-pt-${idx}`}
              onMouseDown={handleMouseDown(`warp-${idx}`)}
              onTouchStart={handleTouchStart(`warp-${idx}`)}
              style={{
                position: 'absolute',
                left: `${point.x}px`,
                top: `${point.y}px`,
                width: `${12 / zoom}px`,
                height: `${12 / zoom}px`,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: 10005
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Puppet Warp: Delaunay triangulation mesh with pins */}
      {mode === 'puppet' && (() => {
        const meshPoints = activeLayer?.warpGrid || activeLayer?.puppetRestPoints || [];
        const layerX = activeLayer?.position?.x || 0;
        const layerY = activeLayer?.position?.y || 0;

        const canvasMesh = meshPoints.map((p: any) => ({
          x: p.x + layerX,
          y: p.y + layerY
        }));

        const canvasPins = (activeLayer?.puppetPins || []).map((p: any) => ({
          x: p.x + layerX,
          y: p.y + layerY
        }));

        const triangles = activeLayer?.puppetTriangles || pw.triangles;

        // Pin visual sizes (scale-corrected)
        const pinR = 10 / zoom;       // head radius
        const needleLen = 14 / zoom;  // needle length below head
        const needleW = 2.5 / zoom;

        return (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <svg
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'all' }}
              onMouseDown={pw.beginPinDrag}
            >
              {/* invisible full-area click catcher for adding pins */}
              <rect
                width="100%"
                height="100%"
                fill="rgba(0,0,0,0.001)"
                style={{ pointerEvents: 'all', cursor: 'crosshair' }}
                onMouseDown={pw.beginPinDrag}
              />

              {/* Mesh triangles */}
              {puppetShowMesh && triangles.length > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  {Array.from({ length: Math.floor(triangles.length / 3) }).map((_, i) => {
                    const i0 = triangles[i * 3];
                    const i1 = triangles[i * 3 + 1];
                    const i2 = triangles[i * 3 + 2];
                    const p0 = canvasMesh[i0];
                    const p1 = canvasMesh[i1];
                    const p2 = canvasMesh[i2];
                    if (!p0 || !p1 || !p2) return null;
                    return (
                      <polygon
                        key={`tri-${i}`}
                        points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                        fill="rgba(40, 130, 240, 0.08)"
                        stroke={meshStroke}
                        strokeWidth={1 / zoom}
                      />
                    );
                  })}
                </g>
              )}

              {/* Pins rendered as thumbtacks in SVG */}
              {canvasPins.map((point: any, idx: number) => {
                const isActive = pw.activePin === idx;
                const headColor = isActive ? '#4fc3f7' : '#ffe082';
                const strokeColor = isActive ? '#0288d1' : '#8d6e00';
                return (
                  <g
                    key={`puppet-pin-${idx}`}
                    style={{ cursor: 'grab', pointerEvents: 'all' }}
                    onMouseDown={(e) => { e.stopPropagation(); pw.beginPinDrag(e, idx); }}
                    onTouchStart={(e) => { e.stopPropagation(); pw.beginPinDrag(e, idx); }}
                    onDoubleClick={(e) => { e.stopPropagation(); pw.removePin(idx)(); }}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); pw.removePin(idx)(); }}
                  >
                    {/* Outer ring for active state */}
                    {isActive && (
                      <circle
                        cx={point.x}
                        cy={point.y - needleLen * 0.4}
                        r={pinR + 5 / zoom}
                        fill="none"
                        stroke="rgba(79, 195, 247, 0.55)"
                        strokeWidth={2 / zoom}
                      />
                    )}
                    {/* Needle (line from head down) */}
                    <line
                      x1={point.x}
                      y1={point.y - needleLen * 0.4}
                      x2={point.x}
                      y2={point.y + needleLen * 0.6}
                      stroke={strokeColor}
                      strokeWidth={needleW}
                      strokeLinecap="round"
                    />
                    {/* Pin head circle */}
                    <circle
                      cx={point.x}
                      cy={point.y - needleLen * 0.4}
                      r={pinR}
                      fill={headColor}
                      stroke={strokeColor}
                      strokeWidth={1.5 / zoom}
                    />
                    {/* Center dot */}
                    <circle
                      cx={point.x}
                      cy={point.y - needleLen * 0.4}
                      r={3 / zoom}
                      fill={strokeColor}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Hint tooltip below layer */}
            <div style={{
              position: 'absolute',
              left: `${xMin}px`,
              top: `${yMax + 14 / zoom}px`,
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(0,0,0,0.60)',
              borderRadius: 4,
              padding: `${3 / zoom}px ${8 / zoom}px`,
              fontSize: `${11 / zoom}px`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              backdropFilter: 'blur(4px)',
            }}>
              Click to add pin • Drag to deform • Double-click or Right-click pin to remove
            </div>
          </div>
        );
      })()}

      {/* 3. Perspective Warp Mesh Overlay */}
      {activeTool === 'perspective_warp' && (() => {
        if (!currentMesh) return null;

        // Draw edges
        const edgeEls = currentMesh.edges.map(edge => {
          const a = vertMap.get(edge.startVertexId);
          const b = vertMap.get(edge.endVertexId);
          if (!a || !b) return null;
          const isSel = canvasSelIds.has(edge.id);
          return (
            <line key={edge.id}
              x1={a.x + layerX} y1={a.y + layerY}
              x2={b.x + layerX} y2={b.y + layerY}
              stroke={isSel ? '#0078d4' : 'rgba(255,255,255,0.5)'}
              strokeWidth={(isSel ? 2.5 : 1.2) / zoom}
            />
          );
        });

        // Draw faces (subtle fill)
        const faceEls = currentMesh.faces.map(face => {
          const pts = facePoints(currentMesh, face);
          const isSel = canvasSelIds.has(face.id);
          if (pts.length < 3) return null;
          return (
            <polygon key={face.id}
              points={pts.map(p => `${p.x + layerX},${p.y + layerY}`).join(' ')}
              fill={isSel ? 'rgba(0, 120, 212, 0.12)' : 'rgba(255, 255, 255, 0.03)'}
              stroke="none"
            />
          );
        });

        // Rectangle being drawn
        const rectEl = (() => {
          const drag = (toolState as any)._pwDrag;
          const rectEnd = (toolState as any)._pwRectEnd;
          if (drag?.type !== 'rectangle' || !rectEnd) return null;
          const s = drag.start as { x: number; y: number };
          const e = rectEnd as { x: number; y: number };
          const rx = Math.min(s.x, e.x) + layerX;
          const ry = Math.min(s.y, e.y) + layerY;
          const rw = Math.abs(e.x - s.x);
          const rh = Math.abs(e.y - s.y);
          return (
            <rect
              x={rx} y={ry}
              width={rw} height={rh}
              fill="rgba(0, 120, 212, 0.08)"
              stroke="#0078d4"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom} ${2 / zoom}`}
              vectorEffect="non-scaling-stroke"
            />
          );
        })();

        // Snap indicators
        const snapEls = (() => {
          const drag = (toolState as any)._pwDrag;
          if (drag?.type !== 'vertex' || pwGetSnap() === false) return null;
          const mesh = currentMesh;
          const draggedIds = (drag.vertexIds || []) as string[];
          if (!mesh || draggedIds.length === 0) return null;
          const items: { x: number; y: number }[] = [];
          for (const vid of draggedIds) {
            const v = mesh.vertices.find((vv: any) => vv.id === vid);
            if (!v) continue;
            const hit = mesh.vertices.find((vv: any) => vv.id !== vid && Math.hypot(vv.x - v.x, vv.y - v.y) <= SNAP_RADIUS);
            if (hit) items.push({ x: hit.x, y: hit.y });
          }
          if (items.length === 0) return null;
          return (
            <g>
              {items.map((pt, i) => (
                <line key={i}
                  x1={pt.x + layerX} y1={pt.y + layerY}
                  x2={pt.x + layerX} y2={pt.y + layerY}
                  stroke="#00ff88" strokeWidth={2 / zoom}
                  strokeDasharray={`${3 / zoom} ${2 / zoom}`}
                />
              ))}
            </g>
          );
        })();

        // Draw vertices
        const vertEls = canvasVerts.map(v => {
          const isSel = v.selected || canvasSelIds.has(v.id);
          return (
            <circle key={v.id}
              cx={v.x} cy={v.y}
              r={(isSel ? 5 : 3.5) / zoom}
              fill={isSel ? '#0078d4' : '#ffffff'}
              stroke={isSel ? '#0078d4' : 'rgba(0,0,0,0.4)'}
              strokeWidth={(isSel ? 2 : 1) / zoom}
            />
          );
        });

        // Toolbar buttons
        const layoutButtons = pwMode === 'layout' ? (
          <>
            <button onClick={() => pwSetOp('add_vertex')}
              style={{ background: pwOp === 'add_vertex' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>+ Vertex</button>
            <button onClick={() => pwSetOp('connect')}
              style={{ background: pwOp === 'connect' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Connect</button>
            <button onClick={() => pwCreateFaceFromSelection()}
              style={{ background: '#2d7d2d', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Face</button>
            <button onClick={() => pwDeleteSelected()}
              style={{ background: '#a02c2c', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Del</button>
          </>
        ) : (
          <>
            <button onClick={() => pwSetOp('select')}
              style={{ background: pwOp === 'select' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Select</button>
            <button onClick={() => pwSetOp('move')}
              style={{ background: pwOp === 'move' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Move</button>
            <button onClick={() => pwSetOp('scale')}
              style={{ background: pwOp === 'scale' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Scale</button>
            <button onClick={() => pwSetOp('rotate')}
              style={{ background: pwOp === 'rotate' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Rotate</button>
            <button onClick={() => pwSetOp('perspective')}
              style={{ background: pwOp === 'perspective' ? '#0078d4' : '#333', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>Perspective</button>
          </>
        );

        const modeLabel = pwMode === 'layout' ? 'Layout Mode' : 'Warp Mode';
        const opLabel = pwOp === 'select' ? '' : ` — ${pwOp}`;

        return (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'auto', overflow: 'visible' }}>
              <rect width="100%" height="100%" fill="transparent"
                onMouseDown={onCanvasDown}
                onTouchStart={onCanvasDown} />
              {edgeEls}
              {faceEls}
              {rectEl}
              {snapEls}
              {vertEls}
            </svg>

            {/* Toolbar */}
            <div style={{ position: 'absolute', left: `${pwXMin}px`, top: `${pwYMin - 28 / zoom}px`, display: 'flex', gap: '4px', pointerEvents: 'auto' }}>
              {layoutButtons}
              <button onClick={() => pwSetMode(pwMode === 'layout' ? 'warp' : 'layout')}
                style={{ background: '#555', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>
                {pwMode === 'layout' ? '→ Warp' : '→ Layout'}
              </button>
              <button onClick={() => { pwResetMesh(activeLayer); }}
                title="Reset mesh to default grid"
                style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: `${11 / zoom}px`, cursor: 'pointer' }}>
                Reset
              </button>
            </div>

            {/* Info label */}
            <div style={{ position: 'absolute', left: `${pwXMin}px`, top: `${pwYMax + 12 / zoom}px`, color: '#fff', background: 'rgba(0,0,0,.68)', borderRadius: 3, padding: `${4 / zoom}px ${7 / zoom}px`, fontSize: `${11 / zoom}px`, pointerEvents: 'none' }}>
              {modeLabel}{opLabel} • Shift+drag = unite selection • Del = delete • Connect = join 2 verts • Face = create quad
            </div>
          </div>
        );
      })()}

      {/* 4. Distort/Perspective/Skew Quad Bounding Box & Handles */}
      {isDeformed && mode !== 'warp' && corners && corners.length === 4 && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            <polygon
              points={corners.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(0, 120, 244, 0.03)"
              stroke="#0078d4"
              strokeWidth={1.5 / zoom}
              strokeDasharray={`${4 / zoom}, ${4 / zoom}`}
              style={{ pointerEvents: 'auto', cursor: 'move' }}
              onMouseDown={handleMouseDown('move')}
              onTouchStart={handleTouchStart('move')}
            />
          </svg>

          {corners.map((point: { x: number; y: number }, idx: number) => {
            const handleNames = ['tl', 'tr', 'br', 'bl'];
            const handle = handleNames[idx];
            let cursorStyle = 'pointer';
            if (handle === 'tl' || handle === 'br') cursorStyle = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') cursorStyle = 'nesw-resize';

            return (
              <div
                key={`corner-${handle}`}
                onMouseDown={handleMouseDown(handle)}
                onTouchStart={handleTouchStart(handle)}
                style={{
                  position: 'absolute',
                  left: `${point.x}px`,
                  top: `${point.y}px`,
                  width: `${14 / zoom}px`,
                  height: `${14 / zoom}px`,
                  backgroundColor: '#ffffff',
                  border: `${1.5 / zoom}px solid #0078d4`,
                  boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                  transform: 'translate(-50%, -50%)',
                  cursor: cursorStyle,
                  pointerEvents: 'auto',
                  zIndex: 10003
                }}
              />
            );
          })}

          {[
            { name: 'tm', x: (corners[0].x + corners[1].x) / 2, y: (corners[0].y + corners[1].y) / 2, cursor: 'ns-resize' },
            { name: 'mr', x: (corners[1].x + corners[2].x) / 2, y: (corners[1].y + corners[2].y) / 2, cursor: 'ew-resize' },
            { name: 'bm', x: (corners[2].x + corners[3].x) / 2, y: (corners[2].y + corners[3].y) / 2, cursor: 'ns-resize' },
            { name: 'ml', x: (corners[3].x + corners[0].x) / 2, y: (corners[3].y + corners[0].y) / 2, cursor: 'ew-resize' }
          ].map((mid) => (
            <div
              key={`mid-${mid.name}`}
              onMouseDown={handleMouseDown(mid.name)}
              onTouchStart={handleTouchStart(mid.name)}
              style={{
                position: 'absolute',
                left: `${mid.x}px`,
                top: `${mid.y}px`,
                width: `${14 / zoom}px`,
                height: `${14 / zoom}px`,
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: mid.cursor,
                pointerEvents: 'auto',
                zIndex: 10002
              }}
            />
          ))}
        </div>
      )}

      {/* 5. Default Scale, Rotate, Free Transform rectangular bounding box */}
      {!isDeformed && (
        <div
          className="layer-move-outline"
          onMouseDown={handleMouseDown('move')}
          onTouchStart={handleTouchStart('move')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: `${w}px`,
            height: `${h}px`,
            transform: `translate(${x}px, ${y}px) rotate(${rect.rotation}deg)`,
            transformOrigin: '0 0',
            pointerEvents: 'auto',
            cursor: 'move',
            border: `${8 / zoom}px dashed #0078d4`,
            outline: `${1 / zoom}px dashed rgba(255, 255, 255, 0.8)`,
            boxShadow: `0 0 ${4 / zoom}px rgba(0, 0, 0, 0.2)`
          }}
        >
          {mode !== 'scale' && (
            <div
              style={{
                position: 'absolute',
                top: `${-25 / zoom}px`,
                left: '50%',
                width: `${1 / zoom}px`,
                height: `${25 / zoom}px`,
                backgroundColor: '#0078d4',
                transform: 'translateX(-50%)',
                pointerEvents: 'none'
              }}
            />
          )}

          {mode !== 'scale' && (
            <div
              className="handle rot"
              onMouseDown={handleMouseDown('rot')}
              onTouchStart={handleTouchStart('rot')}
              style={{
                position: 'absolute',
                top: `${-25 / zoom}px`,
                left: '50%',
                width: `${16 / zoom}px`,
                height: `${16 / zoom}px`,
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: `${1.5 / zoom}px solid #0078d4`,
                boxShadow: `0 ${1 / zoom}px ${3 / zoom}px rgba(0, 0, 0, 0.3)`,
                transform: 'translate(-50%, -50%)',
                cursor: 'crosshair',
                pointerEvents: 'auto'
              }}
            />
          )}

          {mode !== 'rotate' && ['tl', 'tm', 'tr', 'ml', 'mr', 'bl', 'bm', 'br'].map(handle => {
            let cursorStyle = 'pointer';
            if (handle === 'tl' || handle === 'br') cursorStyle = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') cursorStyle = 'nesw-resize';
            else if (handle === 'tm' || handle === 'bm') cursorStyle = 'ns-resize';
            else if (handle === 'ml' || handle === 'mr') cursorStyle = 'ew-resize';

            return (
              <div
                key={handle}
                className={`handle ${handle}`}
                onMouseDown={handleMouseDown(handle)}
                onTouchStart={handleTouchStart(handle)}
                style={{
                  pointerEvents: 'auto',
                  cursor: cursorStyle,
                  width: `${16 / zoom}px`,
                  height: `${16 / zoom}px`,
                  borderWidth: `${1.5 / zoom}px`
                }}
              />
            );
          })}
        </div>
      )}

      {/* 6. Common Confirmation Actions Bar */}
      <div
        className="crop-actions-bar bottom"
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          left: `${(xMin + xMax) / 2}px`,
          top: `${yMax + 20}px`,
          bottom: 'auto',
          right: 'auto',
          transform: `translateX(-50%) scale(${1 / zoom})`,
          transformOrigin: 'top center',
          width: 'fit-content',
          pointerEvents: 'auto',
          display: 'flex',
          gap: '8px',
          zIndex: 100002
        }}
      >
        <button
          className="crop-action-btn confirm"
          onClick={(e) => { e.stopPropagation(); onConfirm(); }}
          title="Commit Transform"
          style={{ cursor: 'pointer' }}
        >
          ✓
        </button>
        <button
          className="crop-action-btn cancel"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          title="Cancel Transform"
          style={{ cursor: 'pointer' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

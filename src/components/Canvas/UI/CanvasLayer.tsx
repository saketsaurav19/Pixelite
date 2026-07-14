import React, { useEffect } from 'react';
import type { Layer } from '../../../store/types';
import { useStore } from '../../../store/useStore';
import { mapBlendModeToCss } from '../../../utils/blendModes';
import { getHomography, drawTrianglesWarp, loadGoogleFont } from '../../../utils/canvasUtils';
import { toolState } from '../../../tools/toolState';

interface CanvasLayerProps {
  layer: Layer;
  documentSize: { w: number, h: number };
  canvasRefs: React.MutableRefObject<Record<string, HTMLCanvasElement | null>>;
  layersCount: number;
  layerIndex: number;
  depth?: number;
}

interface VectorTextLayerProps {
  layer: Layer;
}

// ───────────────────────────────────────────────────────────────────────────────────
// VectorTextLayer — pure HTML text rendering (no SVG, no HarfBuzz glyph paths):
//
//  1. HarfBuzz cluster <span>s  — when shapedPositions[] is available (complex scripts:
//     Devanagari, Arabic, Hebrew, bidi). Each Unicode cluster is rendered as an
//     absolutely-positioned <span> at its HarfBuzz x coordinate. The browser
//     shapes each cluster natively (conjuncts, matras, ligatures render correctly).
//
//  2. PDF-run <span>s            — fallback. One <span> per TextRun extracted from the
//     PDF operator list, positioned using PDF coordinates.
//
//  3. Plain <div>                — last resort when no runs exist.
// ───────────────────────────────────────────────────────────────────────────────────

const VectorTextLayer: React.FC<VectorTextLayerProps> = ({ layer }) => {
  const zoom = useStore(state => state.zoom || 1);
  const textEditor = useStore(state => state.textEditor);
  const isBeingEdited = !!textEditor && textEditor.layerId === layer.id;
  // During active editing, show live text from textEditor. After commit, show layer content.
  const text = isBeingEdited ? textEditor!.value : (layer.textContent || '');
  const fontSize = (layer.fontSize || 16) * zoom;
  // importedFromPdf layers are normally transparent (background PDF renders the text).
  // While actively editing, make the HTML text visible so user sees their edits.
  const isTransparent = layer.importedFromPdf && !layer.isModified && !isBeingEdited;
  const textColor = isTransparent ? 'transparent' : (layer.color || '#000000');
  const fontWeight = layer.fontWeight || 'normal';



  // Load Google Font dynamically if not a custom embedded PDF font
  useEffect(() => {
    if (layer.fontFamily && !layer.fontChecksum) {
      loadGoogleFont(layer.fontFamily);
    }
  }, [layer.fontFamily, layer.fontChecksum]);

  const hasCustomFont = !!layer.fontChecksum;
  const customFontKey = hasCustomFont ? `pdf-font-${layer.fontChecksum}` : '';
  const isGeneric = !layer.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(layer.fontFamily.toLowerCase());

  const fontFamily = hasCustomFont
    ? `"${customFontKey}", "${layer.fontFamily}", "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
    : isGeneric
      ? `"Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
      : `"${layer.fontFamily}", "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`;

  const renderContent = () => {
    // ── Priority 1: HarfBuzz cluster spans (complex scripts / bidi) ─────────────
    if (layer.shapedPositions && layer.shapedPositions.length > 0) {
      return (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            whiteSpace: 'nowrap',
            fontFamily,
            fontWeight,
            fontStyle: layer.fontStyle || 'normal',
            fontSize: `${fontSize}px`,
            color: textColor,
            lineHeight: 1,
            fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {layer.shapedPositions.map((cluster, i) => (
            <span
              key={i}
              style={{
                direction: cluster.direction,
                unicodeBidi: cluster.direction === 'rtl' ? 'bidi-override' : 'normal',
              }}
            >
              {cluster.text}
            </span>
          ))}
        </div>
      );
    }

    // ── Priority 2: PDF-run spans ──────────────────────────────────────────────
    if (layer.runs && layer.runs.length > 0) {
      const theta = ((layer.rotation || 0) * Math.PI) / 180;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      return (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            userSelect: 'none',
            pointerEvents: 'none',
            fontStyle: layer.fontStyle || 'normal',
          }}
        >
          {layer.runs.map((run, i) => {
            const runIsGeneric = !run.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(run.fontFamily.toLowerCase());
            const runFontFamily = hasCustomFont
              ? `"${customFontKey}", "${run.fontFamily || layer.fontFamily}", "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
              : runIsGeneric
                ? `"Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`
                : `"${run.fontFamily}", "Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`;

            const runFontSize = run.fontSize * zoom;
            const runColor = isTransparent ? 'transparent' : (run.color || textColor);
            const runFontWeight = run.fontWeight || fontWeight;

            const rx = run.x;
            const ry = run.y;
            const dx = (rx * cosT + ry * sinT) * zoom;
            const dy = (-rx * sinT + ry * cosT) * zoom;

            const relativeRotation = (run.rotation ?? 0) - (layer.rotation ?? 0);
            const runTransform = Math.abs(relativeRotation) > 0.01 ? `rotate(${relativeRotation}deg)` : undefined;

            return (
              <span
                key={i}
                style={{
                  position: 'absolute',
                  left: `${dx}px`,
                  top: `${dy}px`,
                  fontFamily: runFontFamily,
                  fontWeight: runFontWeight,
                  fontSize: `${runFontSize}px`,
                  color: runColor,
                  opacity: run.opacity ?? 1,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                  fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
                  direction: 'ltr',
                  unicodeBidi: 'plaintext',
                  transform: runTransform,
                  transformOrigin: '0 0',
                }}
              >
                {run.str}
              </span>
            );
          })}
        </div>
      );
    }

    if (layer.isVertical) {
      const lines = text.split('\n');
      return (
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start' }}>
          {lines.map((line, i) => (
            <div key={i} style={{ writingMode: 'vertical-rl', fontFamily, fontWeight, fontStyle: layer.fontStyle || 'normal', fontSize: `${fontSize}px`, color: textColor, whiteSpace: 'pre', lineHeight: 1 }}>
              {line}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          textAlign: layer.textAlign || 'left',
          fontFamily,
          fontWeight,
          fontStyle: layer.fontStyle || 'normal',
          fontSize: `${fontSize}px`,
          color: textColor,
          lineHeight: 1,
          whiteSpace: 'pre',
          fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
          direction: 'ltr',
          unicodeBidi: 'plaintext',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {text}
      </div>
    );
  };

  return (
    <div
      className="vector-text-zoom-wrapper"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${100 * zoom}%`,
        height: `${100 * zoom}%`,
        transform: `scale(${1 / zoom})`,
        transformOrigin: '0 0',
        pointerEvents: 'none',
      }}
    >
      {/* White eraser mask: covers the PDF-rendered text below when editing to eliminate double text */}
      {isBeingEdited && layer.importedFromPdf && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${(layer.width || 100) * zoom}px`,
            height: `${(layer.height || 30) * zoom}px`,
            background: 'white',
            pointerEvents: 'none',
          }}
        />
      )}
      {renderContent()}
    </div>
  );
};

const renderVectorShape = (layer: Layer) => {
  if (layer.type !== 'shape' || !layer.shapeData) return null;
  const { type, w, h, points, fill, stroke, strokeWidth: sw } = layer.shapeData as any;

  const strokeColor = stroke || 'transparent';
  const fillColor = fill || 'transparent';
  const strokeW = sw || 0;

  if (type === 'rect' || !type) {
    return (
      <rect
        x={strokeW / 2}
        y={strokeW / 2}
        width={Math.max(0, (w || 100) - strokeW)}
        height={Math.max(0, (h || 100) - strokeW)}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeW}
      />
    );
  }

  if (type === 'ellipse') {
    const rx = Math.max(0, (w || 100) / 2 - strokeW / 2);
    const ry = Math.max(0, (h || 100) / 2 - strokeW / 2);
    return (
      <ellipse
        cx={(w || 100) / 2}
        cy={(h || 100) / 2}
        rx={rx}
        ry={ry}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={strokeW}
      />
    );
  }

  if (type === 'path') {
    if (layer.shapeData.svgPath) {
      return (
        <path
          d={layer.shapeData.svgPath}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
      );
    }

    if (points && points.length > 0) {
      let d = '';
      if (layer.shapeData.smooth && points.length >= 3) {
        d += `M ${points[0].x} ${points[0].y}`;
        const len = points.length;
        for (let i = 0; i < (layer.shapeData.closed ? len : len - 1); i++) {
          const p0 = points[(i - 1 + len) % len];
          const p1 = points[i % len];
          const p2 = points[(i + 1) % len];
          const p3 = points[(i + 2) % len];

          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6;
          const cp2y = p2.y - (p3.y - p1.y) / 6;

          d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }
      } else {
        d += `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
          d += ` L ${points[i].x} ${points[i].y}`;
        }
      }

      if (layer.shapeData.closed || layer.shapeData.smooth) {
        d += ' Z';
      }

      return (
        <path
          d={d}
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth={strokeW}
        />
      );
    }
  }

  return null;
};

export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  layer,
  documentSize,
  canvasRefs,
  layersCount,
  layerIndex,
  depth = 0
}) => {
  const textEditor = useStore(state => state.textEditor);
  const updateLayer = useStore(state => state.updateLayer);
  const zoom = useStore(state => state.zoom || 1);
  const isEditingThisLayer = textEditor?.layerId === layer.id;
  const hasCustomFont = !!layer.fontChecksum;
  const customFontKey = hasCustomFont ? `pdf-font-${layer.fontChecksum}` : '';

  const ditherMaskUrl = React.useMemo(() => {
    if (layer.blendMode !== 'dissolve') return null;

    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(size, size);
    const pixels = imgData.data;
    const opacity = layer.opacity !== undefined ? layer.opacity : 1;

    for (let i = 0; i < pixels.length; i += 4) {
      const rand = Math.random();
      if (rand < opacity) {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 255;
      } else {
        pixels[i] = 0;
        pixels[i + 1] = 0;
        pixels[i + 2] = 0;
        pixels[i + 3] = 0;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL();
  }, [layer.blendMode, layer.opacity]);

  // If it's a group or artboard, we wrap the children in an isolated div for compositing
  if (layer.type === 'group' || layer.type === 'artboard') {
    return (
      <div
        className={`layer-group ${layer.visible ? 'visible' : 'hidden'}`}
        style={{
          position: 'absolute',
          top: layer.type === 'artboard' ? (layer.position?.y || 0) : 0,
          left: layer.type === 'artboard' ? (layer.position?.x || 0) : 0,
          transform: layer.type === 'group' ? `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px)` : undefined,
          width: layer.type === 'artboard' && layer.width ? `${layer.width}px` : '100%',
          height: layer.type === 'artboard' && layer.height ? `${layer.height}px` : '100%',
          backgroundColor: layer.type === 'artboard' ? (layer.backgroundTransparent ? 'transparent' : (layer.backgroundColor || '#ffffff')) : 'transparent',
          boxShadow: layer.type === 'artboard' ? '0 10px 40px rgba(0, 0, 0, 0.6)' : undefined,
          overflow: layer.type === 'artboard' && layer.clippingEnabled !== false ? 'hidden' : 'visible',
          zIndex: layersCount - layerIndex,
          pointerEvents: layer.type === 'artboard' ? 'auto' : 'none',
          isolation: 'isolate',
          mixBlendMode: (layer.blendMode === 'dissolve' ? 'normal' : mapBlendModeToCss(layer.blendMode)) as any,
          opacity: layer.blendMode === 'dissolve' ? 1 : layer.opacity,
          WebkitMaskImage: ditherMaskUrl ? `url(${ditherMaskUrl})` : undefined,
          maskImage: ditherMaskUrl ? `url(${ditherMaskUrl})` : undefined,
          WebkitMaskRepeat: ditherMaskUrl ? 'repeat' : undefined,
          maskRepeat: ditherMaskUrl ? 'repeat' : undefined,
          touchAction: 'none',
        }}
      >
        {layer.children?.map((childLayer, childIndex) => (
          <CanvasLayer
            key={childLayer.id}
            layer={childLayer}
            documentSize={documentSize}
            canvasRefs={canvasRefs}
            layersCount={layer.children!.length}
            layerIndex={childIndex}
            depth={depth + 1}
          />
        ))}

        {/* Interactive PDF Annotations Overlay */}
        {layer.type === 'artboard' && layer.annotations && layer.annotations.length > 0 && (
          <div
            className="artboard-annotations"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              zIndex: 10000,
            }}
          >
            {layer.annotations.map((ann) => {
              const [x1, y1, x2, y2] = ann.rect;
              const width = Math.max(10, x2 - x1);
              const height = Math.max(10, y2 - y1);

              const handleValueChange = (val: any) => {
                const nextAnns = layer.annotations!.map(a =>
                  a.id === ann.id ? { ...a, fieldValue: val } : a
                );
                updateLayer(layer.id, { annotations: nextAnns });
              };

              const baseStyle: React.CSSProperties = {
                position: 'absolute',
                left: `${x1}px`,
                top: `${y1}px`,
                width: `${width}px`,
                height: `${height}px`,
                pointerEvents: 'auto',
                boxSizing: 'border-box',
              };

              if (ann.subtype === 'Link') {
                return (
                  <a
                    key={ann.id}
                    href={ann.url || '#'}
                    target={ann.url ? '_blank' : undefined}
                    rel="noopener noreferrer"
                    title={ann.url || 'Internal Link'}
                    style={{
                      ...baseStyle,
                      border: '1px dashed rgba(0, 100, 255, 0.4)',
                      backgroundColor: 'rgba(0, 100, 255, 0.05)',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 100, 255, 0.15)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0, 100, 255, 0.05)'; }}
                  />
                );
              }

              if (ann.subtype === 'Widget') {
                if (ann.fieldType === 'Tx') {
                  if (ann.multiLine) {
                    return (
                      <textarea
                        key={ann.id}
                        value={ann.fieldValue || ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        placeholder={ann.alternativeText}
                        style={{
                          ...baseStyle,
                          border: '1px solid rgba(0, 120, 255, 0.3)',
                          backgroundColor: 'rgba(230, 240, 255, 0.8)',
                          color: '#000000',
                          fontFamily: 'sans-serif',
                          fontSize: '11px',
                          padding: '2px',
                          resize: 'none',
                          outline: 'none',
                        }}
                      />
                    );
                  } else {
                    return (
                      <input
                        key={ann.id}
                        type="text"
                        value={ann.fieldValue || ''}
                        onChange={(e) => handleValueChange(e.target.value)}
                        placeholder={ann.alternativeText}
                        style={{
                          ...baseStyle,
                          border: '1px solid rgba(0, 120, 255, 0.3)',
                          backgroundColor: 'rgba(230, 240, 255, 0.8)',
                          color: '#000000',
                          fontFamily: 'sans-serif',
                          fontSize: '11px',
                          padding: '0 2px',
                          outline: 'none',
                        }}
                      />
                    );
                  }
                }

                if (ann.fieldType === 'Btn') {
                  const isChecked = ann.fieldValue === true || ann.fieldValue === 'Yes' || ann.fieldValue === ann.exportValue;
                  return (
                    <input
                      key={ann.id}
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => handleValueChange(e.target.checked ? (ann.exportValue || true) : false)}
                      title={ann.alternativeText}
                      style={{
                        ...baseStyle,
                        margin: 0,
                        cursor: 'pointer',
                        accentColor: '#0078ff',
                      }}
                    />
                  );
                }

                if (ann.fieldType === 'Ch') {
                  return (
                    <select
                      key={ann.id}
                      value={ann.fieldValue || ''}
                      onChange={(e) => handleValueChange(e.target.value)}
                      title={ann.alternativeText}
                      style={{
                        ...baseStyle,
                        border: '1px solid rgba(0, 120, 255, 0.3)',
                        backgroundColor: 'rgba(230, 240, 255, 0.9)',
                        color: '#000000',
                        fontFamily: 'sans-serif',
                        fontSize: '11px',
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <option value=""></option>
                      {ann.options?.map((opt: any, idx: number) => (
                        <option key={idx} value={opt.value}>
                          {opt.displayValue || opt.value}
                        </option>
                      ))}
                    </select>
                  );
                }
              }

              if (ann.subtype === 'Text') {
                return (
                  <div
                    key={ann.id}
                    style={{
                      ...baseStyle,
                      width: '20px',
                      height: '20px',
                      cursor: 'help',
                    }}
                    title={ann.contents || 'Sticky Note'}
                  >
                    <svg viewBox="0 0 24 24" width="100%" height="100%" fill="#ffd000" stroke="#b38f00" strokeWidth="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </div>
    );
  }

  const activeTool = useStore(state => state.activeTool);
  const transformMode = useStore(state => state.transformMode);

  // Render warp grid onto canvas
  useEffect(() => {
    if (activeTool === 'transform' && transformMode === 'warp' && layer.warpGrid && layer.warpGrid.length === 16) {
      const canvas = canvasRefs?.current?.[layer.id];
      const origCanvas = toolState.transformOriginalCanvas;
      if (canvas && origCanvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = origCanvas.width;
          const h = origCanvas.height;
          const srcGrid: { x: number; y: number }[] = [];
          for (let r = 0; r < 4; r++) {
            const v = r / 3;
            for (let c = 0; c < 4; c++) {
              const u = c / 3;
              srcGrid.push({ x: u * w, y: v * h });
            }
          }

          const xs = layer.warpGrid.map(p => p.x);
          const ys = layer.warpGrid.map(p => p.y);
          const xMin = Math.min(...xs);
          const yMin = Math.min(...ys);

          const dstGrid = layer.warpGrid.map(p => ({
            x: p.x - xMin,
            y: p.y - yMin
          }));

          drawTrianglesWarp(ctx, origCanvas, srcGrid, dstGrid, 4, 4);
        }
      }
    }
  }, [activeTool, transformMode, layer.warpGrid, layer.id, canvasRefs]);

  // Regular layer — use native dimensions if available (e.g. PDF bitmap pages)
  let canvasW = layer.isPdfBackground ? (layer.width || 1000) : (layer.width || documentSize.w);
  let canvasH = layer.isPdfBackground ? (layer.height || 1000) : (layer.height || documentSize.h);

  if (layer.isPdfBackground) {
    const originalW = canvasW;
    const originalH = canvasH;
    canvasW = Math.round(canvasW * zoom);
    canvasH = Math.round(canvasH * zoom);
    console.log(`[CanvasLayer] PDF Layer "${layer.name}" dimensions calculated: zoom=${zoom}, originalDocSize=${originalW}x${originalH}, targetCanvasSize=${canvasW}x${canvasH}`);
  }

  const isWarped = layer.type === 'text' && layer.textWarp && layer.textWarp.style !== 'None';
  let padX = 0;
  let padY = 0;
  if (isWarped) {
    padX = Math.round(canvasW * 0.3) + 20;
    padY = Math.round(canvasH * 0.8) + 20;
  }

  if (activeTool === 'transform' && transformMode === 'warp' && layer.warpGrid) {
    const xs = layer.warpGrid.map(p => p.x);
    const ys = layer.warpGrid.map(p => p.y);
    canvasW = Math.max(1, Math.round(Math.max(...xs) - Math.min(...xs)));
    canvasH = Math.max(1, Math.round(Math.max(...ys) - Math.min(...ys)));
  }

  const finalCanvasW = isWarped ? canvasW + 2 * padX : canvasW;
  const finalCanvasH = isWarped ? canvasH + 2 * padY : canvasH;

  const isVector = (layer.type === 'text' && (!layer.textWarp || layer.textWarp.style === 'None')) || layer.type === 'shape' || layer.type === 'table';

  const rotationDeg = layer.rotation ?? 0;
  let layerTransform = `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px)`;
  let layerWidth = layer.width ? `${layer.width}px` : '100%';
  let layerHeight = layer.height ? `${layer.height}px` : '100%';

  if (isWarped) {
    layerTransform = `translate(${(layer.position?.x || 0) - padX}px, ${(layer.position?.y || 0) - padY}px) rotate(${rotationDeg}deg)`;
    layerWidth = `${canvasW + 2 * padX}px`;
    layerHeight = `${canvasH + 2 * padY}px`;
  } else if (layer.corners && layer.corners.length === 4) {
    if (activeTool === 'transform' && transformMode === 'warp' && layer.warpGrid) {
      const xs = layer.warpGrid.map(p => p.x);
      const ys = layer.warpGrid.map(p => p.y);
      const xMin = Math.min(...xs);
      const xMax = Math.max(...xs);
      const yMin = Math.min(...ys);
      const yMax = Math.max(...ys);
      layerTransform = `translate(${xMin}px, ${yMin}px)`;
      layerWidth = `${xMax - xMin}px`;
      layerHeight = `${yMax - yMin}px`;
    } else {
      const w = layer.width || documentSize.w;
      const h = layer.height || documentSize.h;
      const srcPoints = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h }
      ];
      const homography = getHomography(srcPoints, layer.corners);
      if (homography) {
        layerTransform = `matrix3d(
          ${homography[0]}, ${homography[3]}, 0, ${homography[6]},
          ${homography[1]}, ${homography[4]}, 0, ${homography[7]},
          0, 0, 1, 0,
          ${homography[2]}, ${homography[5]}, 0, ${homography[8]}
        )`;
      }
    }
  } else if (rotationDeg !== 0) {
    layerTransform = `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px) rotate(${rotationDeg}deg)`;
  }

  const transformOrigin = '0 0';

  return (
    <div
      className={`layer-wrapper ${layer.visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: layerWidth,
        height: layerHeight,
        zIndex: layersCount - layerIndex,
        pointerEvents: 'none',
        mixBlendMode: (layer.blendMode === 'dissolve' ? 'normal' : mapBlendModeToCss(layer.blendMode)) as any,
        opacity: layer.blendMode === 'dissolve' ? 1 : layer.opacity,
        WebkitMaskImage: ditherMaskUrl ? `url(${ditherMaskUrl})` : undefined,
        maskImage: ditherMaskUrl ? `url(${ditherMaskUrl})` : undefined,
        WebkitMaskRepeat: ditherMaskUrl ? 'repeat' : undefined,
        maskRepeat: ditherMaskUrl ? 'repeat' : undefined,
        transform: layerTransform,
        transformOrigin,
      }}
    >
      <div style={{ opacity: layer.fill ?? 1, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {isEditingThisLayer && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#ffffff', // Cover text on background canvas during edit
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )}
        <canvas
          ref={(el) => { if (canvasRefs && canvasRefs.current) canvasRefs.current[layer.id] = el; }}
          data-layer-id={layer.id}
          width={finalCanvasW}
          height={finalCanvasH}
          className="layer-canvas"
          style={{
            width: '100%',
            height: '100%',
            opacity: (layer.importedFromPdf && !layer.isPdfBackground && !layer.isModified) ? 0 : (isVector ? 0 : 1),
            // PDF background (Skia-rendered): GPU bilinear scaling for smooth zoom
            // Paint layers: nearest-neighbour for sharp pixel-art / brush strokes
            imageRendering: layer.isPdfBackground ? 'auto' : 'pixelated',
          }}
        />
        {layer.type === 'text' && (!layer.textWarp || layer.textWarp.style === 'None') && !isEditingThisLayer && <VectorTextLayer layer={layer} />}
        {layer.type === 'table' && layer.tableData && (
          // PDF table rendered as a proper HTML table
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${layer.tableData.width}px`,
              height: `${layer.tableData.height}px`,
              overflow: 'visible',
              pointerEvents: 'none',
            }}
          >
            <table
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${layer.tableData.width}px`,
                height: `${layer.tableData.height}px`,
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
              }}
            >
              <colgroup>
                {layer.tableData.colWidths.map((w, ci) => (
                  <col key={ci} style={{ width: `${w}px` }} />
                ))}
              </colgroup>
              <tbody>
                {Array.from({ length: layer.tableData.rows }, (_, ri) => (
                  <tr key={ri} style={{ height: `${layer.tableData!.rowHeights[ri]}px` }}>
                    {layer.tableData!.cells
                      .filter(c => c.row === ri)
                      .sort((a, b) => a.col - b.col)
                      .map(cell => (
                        <td
                          key={`${cell.row}-${cell.col}`}
                          style={{
                            border: '1px solid #cbd5e1',
                            padding: '3px 6px',
                            fontSize: `${cell.fontSize}px`,
                            fontWeight: cell.fontWeight,
                            fontFamily: hasCustomFont
                              ? `"${customFontKey}", "${cell.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
                              : (!cell.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(cell.fontFamily.toLowerCase()))
                                ? `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`
                                : `"${cell.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", sans-serif`,
                            color: cell.color,
                            textAlign: cell.textAlign,
                            verticalAlign: 'middle',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: 1.3,
                            fontFeatureSettings: '"kern" 1, "liga" 1',
                          }}
                        >
                          {cell.text}
                        </td>
                      ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {layer.type === 'shape' && (
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              overflow: 'visible',
              display: (layer.importedFromPdf && !layer.isModified) ? 'none' : 'block',
            }}
          >
            {renderVectorShape(layer)}
          </svg>
        )}
      </div>
    </div>
  );
};

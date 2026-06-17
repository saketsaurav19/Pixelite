import React, { useEffect } from 'react';
import type { Layer } from '../../../store/types';
import { useStore } from '../../../store/useStore';
import { FontRegistry } from '../../../pdf/worker/engines/FontRegistry';

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
  const text = layer.textContent || '';
  const fontSize = layer.fontSize || 16;
  const textColor = layer.color || '#000000';
  const fontWeight = layer.fontWeight || 'normal';

  // Dynamically load the font face in the browser so the HTML canvas & text editor can use it
  useEffect(() => {
    if (layer.fontChecksum) {
      const regFont = FontRegistry.get(layer.fontChecksum);
      if (regFont && regFont.data) {
        const fontKey = `pdf-font-${layer.fontChecksum}`;
        const cleanFamily = regFont.name.replace(/^[A-Z]{6}\+/, '');

        const registerBrowserFont = async () => {
          try {
            // Check if already registered
            const loadedFonts = Array.from(document.fonts as any) as any[];
            const isKeyLoaded = loadedFonts.some(f => f.family === fontKey);
            if (!isKeyLoaded) {
              const fontFace1 = new FontFace(fontKey, regFont.data.buffer as ArrayBuffer);
              await fontFace1.load();
              (document.fonts as any).add(fontFace1);
              console.log(`[CanvasLayer] Registered FontFace: ${fontKey}`);
            }

            const isFamilyLoaded = loadedFonts.some(f => f.family === cleanFamily);
            if (!isFamilyLoaded) {
              const fontFace2 = new FontFace(cleanFamily, regFont.data.buffer as ArrayBuffer);
              await fontFace2.load();
              (document.fonts as any).add(fontFace2);
              console.log(`[CanvasLayer] Registered FontFace family: ${cleanFamily}`);
            }
          } catch (err) {
            console.error('[CanvasLayer] Dynamic browser FontFace registration failed:', err);
          }
        };
        registerBrowserFont();
      }
    }
  }, [layer.fontChecksum, layer.fontName]);

  const hasCustomFont = !!layer.fontChecksum;
  const customFontKey = hasCustomFont ? `pdf-font-${layer.fontChecksum}` : '';
  const isGeneric = !layer.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(layer.fontFamily.toLowerCase());

  const fontFamily = hasCustomFont
    ? `"${customFontKey}", "${layer.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
    : isGeneric
      ? `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
      : `"${layer.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`;

  // ── Priority 1: HarfBuzz cluster spans (complex scripts / bidi) ─────────────
  // HarfBuzz is used ONLY to determine cluster boundaries — which Unicode
  // codepoints form one visual unit (conjunct, matra, ligature, etc.).
  // Clusters are rendered as inline <span>s in normal flow so the browser's
  // own text engine handles advance widths. This avoids the x-drift that occurs
  // when HarfBuzz (using a fallback font) and the browser (using the PDF font)
  // compute different advance widths for the same text.
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
        }}
      >
        {layer.runs.map((run, i) => {
          const runIsGeneric = !run.fontFamily || ['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(run.fontFamily.toLowerCase());
          const runFontFamily = hasCustomFont
            ? `"${customFontKey}", "${run.fontFamily || layer.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
            : runIsGeneric
              ? `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`
              : `"${run.fontFamily}", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`;

          const runFontSize = run.fontSize;
          const runColor = run.color || textColor;
          const runFontWeight = run.fontWeight || fontWeight;

          const rx = run.x;
          const ry = run.y;
          const dx = rx * cosT + ry * sinT;
          const dy = -rx * sinT + ry * cosT;

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
          <div key={i} style={{ writingMode: 'vertical-rl', fontFamily, fontWeight, fontSize: `${fontSize}px`, color: textColor, whiteSpace: 'pre', lineHeight: 1 }}>
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
        fontFamily,
        fontWeight,
        fontSize: `${fontSize}px`,
        color: textColor,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        // OpenType features for correct ligature, kern, conjunct shaping
        fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
        // Ensure left-to-right base direction for mixed scripts
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
  const isEditingThisLayer = textEditor?.layerId === layer.id;
  const hasCustomFont = !!layer.fontChecksum;
  const customFontKey = hasCustomFont ? `pdf-font-${layer.fontChecksum}` : '';

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
          mixBlendMode: (layer.blendMode === 'source-over' || layer.blendMode === 'pass through' ? 'normal' : (layer.blendMode || 'normal')) as any,
          opacity: layer.opacity,
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

  // Regular layer — use native dimensions if available (e.g. PDF bitmap pages)
  const canvasW = layer.width || documentSize.w;
  const canvasH = layer.height || documentSize.h;

  const isVector = layer.type === 'text' || layer.type === 'shape' || layer.type === 'table';

  // Build the CSS transform string:
  //   translate() always present (positions the layer)
  //   rotate() added when the layer has a non-zero rotation (from PDF extraction)
  // Transform origin is top-left (0 0) so PDF-space position stays accurate.
  const rotationDeg = layer.rotation ?? 0;
  const layerTransform = rotationDeg !== 0
    ? `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px) rotate(${rotationDeg}deg)`
    : `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px)`;

  // We ALWAYS use transform-origin: 0 0 for all layers (including watermarks)
  // to ensure that absolute run coordinate projection in VectorTextLayer aligns perfectly.
  // const isWatermark = layer.isWatermark === true;
  const transformOrigin = '0 0';

  return (
    <div
      className={`layer-wrapper ${(layer.visible && !isEditingThisLayer) ? 'visible' : 'hidden'}`}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: layer.width ? `${layer.width}px` : '100%',
        height: layer.height ? `${layer.height}px` : '100%',
        zIndex: layersCount - layerIndex,
        pointerEvents: 'none',
        mixBlendMode: (layer.blendMode === 'source-over' ? 'normal' : (layer.blendMode || 'normal')) as any,
        opacity: layer.opacity,
        transform: layerTransform,
        transformOrigin,
      }}
    >
      <div style={{ opacity: layer.fill ?? 1, width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        <canvas
          ref={(el) => { if (canvasRefs && canvasRefs.current) canvasRefs.current[layer.id] = el; }}
          data-layer-id={layer.id}
          width={canvasW}
          height={canvasH}
          className="layer-canvas"
          style={{
            width: '100%',
            height: '100%',
            opacity: isVector ? 0 : 1,
          }}
        />
        {layer.type === 'text' && <VectorTextLayer layer={layer} />}
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
            }}
          >
            {renderVectorShape(layer)}
          </svg>
        )}
      </div>
    </div>
  );
};

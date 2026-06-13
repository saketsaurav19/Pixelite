import React, { useState, useEffect } from 'react';
import type { Layer } from '../../../store/types';
import { shapeTextWasm } from '../../../pdf/worker/engines/WasmShaper';
import type { ShapedGlyph } from '../../../pdf/worker/engines/WasmShaper';

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

const VectorTextLayer: React.FC<VectorTextLayerProps> = ({ layer }) => {
  const [shapedResult, setShapedResult] = useState<{
    glyphs: ShapedGlyph[];
    width: number;
    ascender: number;
    upem: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const text = layer.textContent || '';
  const fontSize = layer.fontSize || 40;

  useEffect(() => {
    let active = true;
    setLoading(true);
    shapeTextWasm(text, fontSize)
      .then(res => {
        if (active) {
          setShapedResult(res);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed shaping text via Wasm:", err);
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [text, fontSize]);

  if (layer.isVertical) {
    const lines = text.split('\n');
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'flex',
          flexDirection: 'row',
          fontFamily: `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`,
          fontSize: `${fontSize}px`,
          color: layer.color || '#000000',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              marginRight: `${fontSize * 0.2}px`,
            }}
          >
            {line.split('').map((char, j) => (
              <span
                key={j}
                style={{
                  height: `${fontSize}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  WebkitTextStroke: layer.strokeColor && layer.strokeWidth ? `${layer.strokeWidth}px ${layer.strokeColor}` : undefined,
                }}
              >
                {char}
              </span>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (loading || !shapedResult) {
    // Fallback: render text using browser styling
    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          fontFamily: `"Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`,
          fontSize: `${fontSize}px`,
          color: layer.color || '#000000',
          lineHeight: 1.0,
          whiteSpace: 'pre'
        }}
      >
        {text}
      </div>
    );
  }

  const scale = fontSize / shapedResult.upem;
  const baseline = shapedResult.ascender;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: `${shapedResult.width}px`,
        height: `${fontSize * 1.5}px`,
        overflow: 'visible',
      }}
    >
      <g fill={layer.color || '#000000'}>
        {shapedResult.glyphs.map((g, idx) => {
          if (!g.path) return null;
          const tx = g.x + g.xOffset;
          const ty = baseline - g.yOffset;
          
          return (
            <path
              key={idx}
              d={g.path}
              transform={`translate(${tx}, ${ty}) scale(${scale}, ${-scale})`}
              stroke={layer.strokeColor && layer.strokeWidth ? layer.strokeColor : undefined}
              strokeWidth={layer.strokeColor && layer.strokeWidth ? layer.strokeWidth / scale : undefined}
            />
          );
        })}
      </g>
    </svg>
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
      </div>
    );
  }

  // Regular layer — use native dimensions if available (e.g. PDF bitmap pages)
  const canvasW = layer.width || documentSize.w;
  const canvasH = layer.height || documentSize.h;

  const isVector = layer.type === 'text' || layer.type === 'shape';

  return (
    <div
      className={`layer-wrapper ${layer.visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: layer.width ? `${layer.width}px` : '100%',
        height: layer.height ? `${layer.height}px` : '100%',
        zIndex: layersCount - layerIndex,
        pointerEvents: 'none',
        mixBlendMode: (layer.blendMode === 'source-over' ? 'normal' : (layer.blendMode || 'normal')) as any,
        opacity: layer.opacity,
        transform: `translate(${layer.position?.x || 0}px, ${layer.position?.y || 0}px)`
      }}
    >
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
  );
};

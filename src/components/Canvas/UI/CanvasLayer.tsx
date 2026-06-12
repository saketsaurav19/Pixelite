import React from 'react';
import type { Layer } from '../../../store/types';

interface CanvasLayerProps {
  layer: Layer;
  documentSize: { w: number, h: number };
  canvasRefs: React.MutableRefObject<Record<string, HTMLCanvasElement | null>>;
  layersCount: number;
  layerIndex: number;
  depth?: number;
}

export const CanvasLayer: React.FC<CanvasLayerProps> = ({
  layer,
  documentSize,
  canvasRefs,
  layersCount,
  layerIndex,
  depth = 0
}) => {
  // If it's a group, we wrap the children in an isolated div for compositing
  if (layer.type === 'group') {
    return (
      <div
        className={`layer-group ${layer.visible ? 'visible' : 'hidden'}`}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          zIndex: layersCount - layerIndex,
          pointerEvents: 'none',
          isolation: 'isolate',
          mixBlendMode: (layer.blendMode === 'source-over' || layer.blendMode === 'pass through' ? 'normal' : (layer.blendMode || 'normal')) as any,
          opacity: layer.opacity,
          // Group doesn't have a specific transform if we treat its children absolutely
          // If we want group positioning, we could apply transform here, but Photoshop typically handles child transforms relative to document unless dragged
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

  // Regular layer
  return (
    <div
      className={`layer-wrapper ${layer.visible ? 'visible' : 'hidden'}`}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: layersCount - layerIndex,
        pointerEvents: 'none',
        mixBlendMode: (layer.blendMode === 'source-over' ? 'normal' : (layer.blendMode || 'normal')) as any,
        opacity: layer.opacity,
        transform: `translate(${(layer.position?.x || 0) / 2}px, ${(layer.position?.y || 0) / 2}px)`
      }}
    >
      <canvas
        ref={(el) => { if (canvasRefs && canvasRefs.current) canvasRefs.current[layer.id] = el; }}
        data-layer-id={layer.id}
        width={documentSize.w}
        height={documentSize.h}
        className="layer-canvas"
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

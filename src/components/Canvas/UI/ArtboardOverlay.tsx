import React from 'react';
import { useStore } from '../../../store/useStore';
import * as LucideIcons from 'lucide-react';

export const ArtboardOverlay: React.FC = () => {
  const { layers, activeTool, activeLayerId, setActiveLayer } = useStore();

  if (activeTool !== 'artboard') return null;

  const artboards = layers.filter(layer => layer.type === 'artboard');

  const handleSize = 8;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }}>
      {artboards.map(artboard => {
        const isSelected = activeLayerId === artboard.id;
        const x = artboard.position?.x || 0;
const y = artboard.position?.y || 0;
const w = artboard.width || 0;
const h = artboard.height || 0;

        return (
          <div key={artboard.id} style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
            {/* Artboard Label */}
            <div
              style={{
                position: 'absolute',
                top: -24,
                left: 0,
                fontSize: '12px',
                color: isSelected ? '#3b82f6' : '#666',
                fontFamily: 'sans-serif',
                fontWeight: isSelected ? 'bold' : 'normal',
                pointerEvents: 'auto',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveLayer(artboard.id);
              }}
            >
              <LucideIcons.Layout size={12} />
              {artboard.name}
            </div>

            {/* Bounding Box & Handles (Only if selected) */}
            {isSelected && (
              <>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: '2px solid #3b82f6', pointerEvents: 'none' }} />

                {/* Invisible Move Target inside bounding box */}
                <div className="crop-handle move-handle" data-handle="move" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'move', pointerEvents: 'auto' }} />

                {/* Handles */}
                <div className="crop-handle tl-handle" data-handle="tl" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize/2, left: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tm-handle" data-handle="tm" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize/2, left: w/2 - handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tr-handle" data-handle="tr" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize/2, right: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle lm-handle" data-handle="lm" data-layer-id={artboard.id} style={{ position: 'absolute', top: h/2 - handleSize/2, left: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle rm-handle" data-handle="rm" data-layer-id={artboard.id} style={{ position: 'absolute', top: h/2 - handleSize/2, right: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bl-handle" data-handle="bl" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize/2, left: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bm-handle" data-handle="bm" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize/2, left: w/2 - handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle br-handle" data-handle="br" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize/2, right: -handleSize/2, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '1px solid #3b82f6', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

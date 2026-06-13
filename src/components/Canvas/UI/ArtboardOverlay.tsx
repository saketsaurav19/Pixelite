import React from 'react';
import { useStore } from '../../../store/useStore';
import * as LucideIcons from 'lucide-react';

export const ArtboardOverlay: React.FC = () => {
  const { layers, activeTool, activeLayerId, setActiveLayer, addLayer, recordHistory, zoom, canvasOffset, documentSize } = useStore();

  if (activeTool !== 'artboard') return null;

  const artboards = layers.filter(layer => layer.type === 'artboard');
  const handleSize = 8;
  const primaryColor = '#00a8ff';

  const handleAddArtboard = (x: number, y: number, w: number, h: number, direction: 'top' | 'right' | 'bottom' | 'left') => {
    const margin = 20;
    let newX = x;
    let newY = y;

    if (direction === 'top') newY = y - h - margin;
    if (direction === 'bottom') newY = y + h + margin;
    if (direction === 'left') newX = x - w - margin;
    if (direction === 'right') newX = x + w + margin;

    addLayer({
      type: 'artboard',
      name: `Artboard ${artboards.length + 1}`,
      width: w,
      height: h,
      position: { x: newX, y: newY }
    });
    recordHistory('Add Artboard');
  };

  // Helper to map document coordinate to screen coordinate relative to canvas-container center
  const getScreenPos = (docX: number, docY: number) => {
    const dx = (docX - documentSize.w / 2);
    const dy = (docY - documentSize.h / 2);
    return {
      x: (dx + canvasOffset.x) * zoom,
      y: (dy + canvasOffset.y) * zoom,
    };
  };

  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 10000 }}>
      {artboards.map(artboard => {
        const isSelected = activeLayerId === artboard.id;
        const x = artboard.position?.x || 0;
        const y = artboard.position?.y || 0;
        const w = artboard.width || 0;
        const h = artboard.height || 0;

        const screenPos = getScreenPos(x, y);
        const screenW = w * zoom;
        const screenH = h * zoom;

        return (
          <div key={artboard.id} style={{ position: 'absolute', left: screenPos.x, top: screenPos.y, width: screenW, height: screenH }}>
            {/* Artboard Label */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                left: 0,
                fontSize: '12px',
                color: isSelected ? primaryColor : '#b3b3b3',
                fontFamily: 'sans-serif',
                fontWeight: 'normal',
                pointerEvents: 'auto',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onClick={(e) => {
                e.stopPropagation();
                setActiveLayer(artboard.id);
              }}
            >
              {artboard.name}
            </div>

            {/* Bounding Box & Handles (Only if selected) */}
            {isSelected && (
              <>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: `1px solid ${primaryColor}`, pointerEvents: 'none' }} />

                {/* Invisible Move Target inside bounding box */}
                <div className="crop-handle move-handle" data-handle="move" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'move', pointerEvents: 'auto' }} />

                {/* Plus Buttons */}
                <div
                  style={{ position: 'absolute', top: -35, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'top'); }}
                >
                  <LucideIcons.Plus size={14} color="#fff" />
                </div>
                <div
                  style={{ position: 'absolute', bottom: -35, left: '50%', transform: 'translateX(-50%)', width: 20, height: 20, borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'bottom'); }}
                >
                  <LucideIcons.Plus size={14} color="#fff" />
                </div>
                <div
                  style={{ position: 'absolute', left: -35, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'left'); }}
                >
                  <LucideIcons.Plus size={14} color="#fff" />
                </div>
                <div
                  style={{ position: 'absolute', right: -35, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', pointerEvents: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'right'); }}
                >
                  <LucideIcons.Plus size={14} color="#fff" />
                </div>

                {/* Center Marker */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', width: 10, height: 10, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', top: 4, left: 0, width: 10, height: 1, backgroundColor: primaryColor }} />
                  <div style={{ position: 'absolute', top: 0, left: 4, width: 1, height: 10, backgroundColor: primaryColor }} />
                </div>

                {/* Resize Handles */}
                <div className="crop-handle tl-handle" data-handle="tl" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize, left: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'nwse-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tm-handle" data-handle="tm" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize, left: screenW - handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tr-handle" data-handle="tr" data-layer-id={artboard.id} style={{ position: 'absolute', top: -handleSize, right: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle lm-handle" data-handle="lm" data-layer-id={artboard.id} style={{ position: 'absolute', top: screenH - handleSize, left: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle rm-handle" data-handle="rm" data-layer-id={artboard.id} style={{ position: 'absolute', top: screenH - handleSize, right: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bl-handle" data-handle="bl" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize, left: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bm-handle" data-handle="bm" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize, left: screenW - handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle br-handle" data-handle="br" data-layer-id={artboard.id} style={{ position: 'absolute', bottom: -handleSize, right: -handleSize, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, cursor: 'nwse-resize', pointerEvents: 'auto' }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

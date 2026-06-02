import React from 'react';
import { useStore } from '../../../store/useStore';
import * as LucideIcons from 'lucide-react';

export const ArtboardOverlay: React.FC = () => {
  const { layers, activeTool, addLayer, documentSize, setDocumentSize, recordHistory } = useStore();

  if (activeTool !== 'artboard') return null;

  const artboards = layers.filter(layer => layer.type === 'artboard');

  const displayArtboards = artboards.length > 0 ? artboards : [{
    id: 'document-artboard',
    type: 'artboard',
    position: { x: 0, y: 0 },
    width: documentSize.w,
    height: documentSize.h
  }];

  const handleAddArtboard = (x: number, y: number, w: number, h: number) => {
    addLayer({
      name: 'Artboard',
      type: 'artboard',
      position: { x, y },
      width: w,
      height: h,
      children: []
    });

    let newDocW = documentSize.w;
    let newDocH = documentSize.h;
    if (x + w > documentSize.w) newDocW = x + w;
    if (y + h > documentSize.h) newDocH = y + h;
    if (x < 0 || y < 0) {
        // Handle negative coordinates not strictly required, assuming positive quadrant
    }

    if (newDocW !== documentSize.w || newDocH !== documentSize.h) {
      setDocumentSize({ w: newDocW, h: newDocH });
    }

    recordHistory('Add Artboard');
  };

  const buttonSize = 24;
  const gap = 50;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10000 }}>
      {displayArtboards.map(artboard => {
        const x = (artboard.position?.x || 0) / 2;
        const y = (artboard.position?.y || 0) / 2;
        const w = (artboard.width || 0) / 2;
        const h = (artboard.height || 0) / 2;

        // Un-scaled dimensions to pass back when creating new
        const rawW = artboard.width || 0;
        const rawH = artboard.height || 0;
        const rawX = artboard.position?.x || 0;
        const rawY = artboard.position?.y || 0;

        return (
          <div key={artboard.id} style={{ position: 'absolute', left: x, top: y, width: w, height: h }}>
            {/* Top */}
            <button
              style={{ position: 'absolute', top: -gap/2 - buttonSize/2, left: '50%', transform: 'translateX(-50%)', width: buttonSize, height: buttonSize, borderRadius: '50%', backgroundColor: '#fff', border: '1px solid #ccc', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={() => handleAddArtboard(rawX, rawY - gap - rawH, rawW, rawH)}
              title="Add Artboard Top"
            >
              <LucideIcons.Plus size={16} />
            </button>
            {/* Right */}
            <button
              style={{ position: 'absolute', top: '50%', right: -gap/2 - buttonSize/2, transform: 'translateY(-50%)', width: buttonSize, height: buttonSize, borderRadius: '50%', backgroundColor: '#fff', border: '1px solid #ccc', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={() => handleAddArtboard(rawX + rawW + gap, rawY, rawW, rawH)}
              title="Add Artboard Right"
            >
              <LucideIcons.Plus size={16} />
            </button>
            {/* Bottom */}
            <button
              style={{ position: 'absolute', bottom: -gap/2 - buttonSize/2, left: '50%', transform: 'translateX(-50%)', width: buttonSize, height: buttonSize, borderRadius: '50%', backgroundColor: '#fff', border: '1px solid #ccc', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={() => handleAddArtboard(rawX, rawY + rawH + gap, rawW, rawH)}
              title="Add Artboard Bottom"
            >
              <LucideIcons.Plus size={16} />
            </button>
            {/* Left */}
            <button
              style={{ position: 'absolute', top: '50%', left: -gap/2 - buttonSize/2, transform: 'translateY(-50%)', width: buttonSize, height: buttonSize, borderRadius: '50%', backgroundColor: '#fff', border: '1px solid #ccc', cursor: 'pointer', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={() => handleAddArtboard(rawX - gap - rawW, rawY, rawW, rawH)}
              title="Add Artboard Left"
            >
              <LucideIcons.Plus size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

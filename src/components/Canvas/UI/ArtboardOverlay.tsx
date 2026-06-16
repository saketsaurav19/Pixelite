import React from 'react';
import { useStore } from '../../../store/useStore';
import * as LucideIcons from 'lucide-react';
import { nanoid } from 'nanoid';

interface AbsoluteRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
}

const findLayerAbsoluteRect = (
  layerId: string,
  nodes: any[],
  parentX = 0,
  parentY = 0
): AbsoluteRect | null => {
  for (const node of nodes) {
    const nodeX = parentX + (node.position?.x || 0);
    const nodeY = parentY + (node.position?.y || 0);

    if (node.id === layerId) {
      return {
        x: nodeX,
        y: nodeY,
        w: node.width || 0,
        h: node.height || 0,
        rotation: node.rotation || 0,
      };
    }

    if (node.children && node.children.length > 0) {
      const found = findLayerAbsoluteRect(layerId, node.children, nodeX, nodeY);
      if (found) return found;
    }
  }
  return null;
};

export const ArtboardOverlay: React.FC = () => {
  const { layers, setLayers, activeTool, activeLayerId, setActiveLayer, addLayer, recordHistory, zoom, canvasOffset, documentSize, canvasRotation } = useStore();

  const artboards = layers.filter(layer => layer.type === 'artboard');

  const handleSize = 8;
  const primaryColor = '#00a8ff';
  const inactiveColor = 'rgba(160, 160, 160, 0.4)';

  const handleAddArtboard = (ax: number, ay: number, aw: number, ah: number, direction: 'top' | 'right' | 'bottom' | 'left') => {
    const margin = 20;
    let newX = ax;
    let newY = ay;

    if (direction === 'top') newY = ay - ah - margin;
    if (direction === 'bottom') newY = ay + ah + margin;
    if (direction === 'left') newX = ax - aw - margin;
    if (direction === 'right') newX = ax + aw + margin;

    const currentArtboards = layers.filter(layer => layer.type === 'artboard');
    
    if (currentArtboards.length === 0) {
      // First artboard ("Artboard 1") represents the original canvas
      const firstArtboardId = nanoid();
      const firstArtboard = {
        id: firstArtboardId,
        type: 'artboard' as const,
        name: 'Artboard 1',
        width: aw,
        height: ah,
        position: { x: 0, y: 0 },
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over' as const,
        children: [...layers] // Move existing layers to it
      };

      const newArtboardId = nanoid();
      const newArtboard = {
        id: newArtboardId,
        type: 'artboard' as const,
        name: 'Artboard 2',
        width: aw,
        height: ah,
        position: { x: newX, y: newY },
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over' as const,
        children: []
      };

      setLayers([firstArtboard, newArtboard]);
      setActiveLayer(newArtboardId);
      recordHistory('Convert to Artboards');
    } else {
      const newArtboardId = nanoid();
      addLayer({
        id: newArtboardId,
        type: 'artboard',
        name: `Artboard ${currentArtboards.length + 1}`,
        width: aw,
        height: ah,
        position: { x: newX, y: newY },
        children: []
      });
      setActiveLayer(newArtboardId);
      recordHistory('Add Artboard');
    }
  };

  // Scenario 1: There are no artboards in the document
  if (artboards.length === 0) {
    // Show virtual artboard ONLY if the active tool is 'artboard'
    if (activeTool !== 'artboard') return null;

    const x = 0;
    const y = 0;
    const w = documentSize.w;
    const h = documentSize.h;
    const rotation = 0;
    const targetId = 'virtual-document-artboard';
    const targetLayerName = 'Artboard 1';

    return (
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: `${documentSize.w}px`,
          height: `${documentSize.h}px`,
          transform: `translate(-50%, -50%) scale(${zoom}) translate(${canvasOffset.x}px, ${canvasOffset.y}px) rotate(${canvasRotation}deg)`,
          transformOrigin: 'center center',
          pointerEvents: 'none',
          zIndex: 10000,
        }}
      >
        <div 
          style={{ 
            position: 'absolute', 
            left: `${x}px`, 
            top: `${y}px`, 
            width: `${w}px`, 
            height: `${h}px`,
            transform: rotation ? `rotate(${rotation}deg)` : undefined,
            transformOrigin: '0 0'
          }}
        >
          {/* Artboard Label */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: 0,
              fontSize: '12px',
              color: primaryColor,
              fontFamily: 'sans-serif',
              fontWeight: 'normal',
              pointerEvents: 'auto',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {targetLayerName}
          </div>

          {/* Bounding Box Border */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: `1px solid ${primaryColor}`, pointerEvents: 'none' }} />

          {/* Invisible Move Target inside bounding box */}
          <div className="crop-handle move-handle" data-handle="move" data-layer-id={targetId} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'move', pointerEvents: 'auto' }} />

          {/* Plus Buttons */}
          <div
            className="artboard-plus-btn top"
            onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'top'); }}
          >
            <LucideIcons.Plus size={18} />
          </div>
          <div
            className="artboard-plus-btn bottom"
            onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'bottom'); }}
          >
            <LucideIcons.Plus size={18} />
          </div>
          <div
            className="artboard-plus-btn left"
            onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'left'); }}
          >
            <LucideIcons.Plus size={18} />
          </div>
          <div
            className="artboard-plus-btn right"
            onClick={(e) => { e.stopPropagation(); handleAddArtboard(x, y, w, h, 'right'); }}
          >
            <LucideIcons.Plus size={18} />
          </div>

          {/* Center Marker */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: handleSize,
              height: handleSize,
              backgroundColor: '#fff',
              border: `1px solid ${primaryColor}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />

          {/* Resize Handles */}
          <div className="crop-handle tl-handle" data-handle="tl" data-layer-id={targetId} style={{ position: 'absolute', top: 0, left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle tm-handle" data-handle="tm" data-layer-id={targetId} style={{ position: 'absolute', top: 0, left: '50%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle tr-handle" data-handle="tr" data-layer-id={targetId} style={{ position: 'absolute', top: 0, left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle lm-handle" data-handle="lm" data-layer-id={targetId} style={{ position: 'absolute', top: '50%', left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ew-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle rm-handle" data-handle="rm" data-layer-id={targetId} style={{ position: 'absolute', top: '50%', left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ew-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle bl-handle" data-handle="bl" data-layer-id={targetId} style={{ position: 'absolute', top: '100%', left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle bm-handle" data-handle="bm" data-layer-id={targetId} style={{ position: 'absolute', top: '100%', left: '50%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto' }} />
          <div className="crop-handle br-handle" data-handle="br" data-layer-id={targetId} style={{ position: 'absolute', top: '100%', left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
        </div>
      </div>
    );
  }

  // Scenario 2: There are artboards in the document
  // Render labels and borders for ALL artboards. Show handles & plus buttons for the active artboard only if activeTool === 'artboard'.
  const activeArtboardId = layers.find(l => l.id === activeLayerId && l.type === 'artboard')?.id || artboards[0]?.id;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: `${documentSize.w}px`,
        height: `${documentSize.h}px`,
        transform: `translate(-50%, -50%) scale(${zoom}) translate(${canvasOffset.x}px, ${canvasOffset.y}px) rotate(${canvasRotation}deg)`,
        transformOrigin: 'center center',
        pointerEvents: 'none',
        zIndex: 10000,
      }}
    >
      {artboards.map(artboard => {
        const rect = findLayerAbsoluteRect(artboard.id, layers);
        if (!rect) return null;

        const isInteractive = activeTool === 'artboard' && artboard.id === activeArtboardId;
        const color = isInteractive ? primaryColor : inactiveColor;
        const labelColor = isInteractive ? primaryColor : '#b3b3b3';

        return (
          <div
            key={artboard.id}
            style={{
              position: 'absolute',
              left: `${rect.x}px`,
              top: `${rect.y}px`,
              width: `${rect.w}px`,
              height: `${rect.h}px`,
              transform: rect.rotation ? `rotate(${rect.rotation}deg)` : undefined,
              transformOrigin: '0 0',
              pointerEvents: 'none'
            }}
          >
            {/* Artboard Label */}
            <div
              style={{
                position: 'absolute',
                top: -20,
                left: 0,
                fontSize: '12px',
                color: labelColor,
                fontFamily: 'sans-serif',
                fontWeight: isInteractive ? 'bold' : 'normal',
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

            {/* Bounding Box Border */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: isInteractive ? `1.5px solid ${color}` : `1px dashed ${color}`,
                pointerEvents: 'none',
              }}
            />

            {isInteractive && (
              <>
                {/* Invisible Move Target inside bounding box */}
                <div className="crop-handle move-handle" data-handle="move" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'move', pointerEvents: 'auto' }} />

                {/* Plus Buttons */}
                <div
                  className="artboard-plus-btn top"
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(rect.x, rect.y, rect.w, rect.h, 'top'); }}
                >
                  <LucideIcons.Plus size={18} />
                </div>
                <div
                  className="artboard-plus-btn bottom"
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(rect.x, rect.y, rect.w, rect.h, 'bottom'); }}
                >
                  <LucideIcons.Plus size={18} />
                </div>
                <div
                  className="artboard-plus-btn left"
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(rect.x, rect.y, rect.w, rect.h, 'left'); }}
                >
                  <LucideIcons.Plus size={18} />
                </div>
                <div
                  className="artboard-plus-btn right"
                  onClick={(e) => { e.stopPropagation(); handleAddArtboard(rect.x, rect.y, rect.w, rect.h, 'right'); }}
                >
                  <LucideIcons.Plus size={18} />
                </div>

                {/* Center Marker */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: handleSize,
                    height: handleSize,
                    backgroundColor: '#fff',
                    border: `1px solid ${primaryColor}`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Resize Handles */}
                <div className="crop-handle tl-handle" data-handle="tl" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tm-handle" data-handle="tm" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: '50%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle tr-handle" data-handle="tr" data-layer-id={artboard.id} style={{ position: 'absolute', top: 0, left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle lm-handle" data-handle="lm" data-layer-id={artboard.id} style={{ position: 'absolute', top: '50%', left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle rm-handle" data-handle="rm" data-layer-id={artboard.id} style={{ position: 'absolute', top: '50%', left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ew-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bl-handle" data-handle="bl" data-layer-id={artboard.id} style={{ position: 'absolute', top: '100%', left: 0, width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nesw-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle bm-handle" data-handle="bm" data-layer-id={artboard.id} style={{ position: 'absolute', top: '100%', left: '50%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'ns-resize', pointerEvents: 'auto' }} />
                <div className="crop-handle br-handle" data-handle="br" data-layer-id={artboard.id} style={{ position: 'absolute', top: '100%', left: '100%', width: handleSize, height: handleSize, backgroundColor: '#fff', border: `1px solid ${primaryColor}`, transform: 'translate(-50%, -50%)', cursor: 'nwse-resize', pointerEvents: 'auto' }} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

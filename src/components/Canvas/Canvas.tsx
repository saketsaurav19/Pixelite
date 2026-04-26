import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useStore } from '../../store/useStore';
import './Canvas.css';

const Canvas: React.FC = () => {
  const store = useStore();
  const {
    activeTool, brushSize, strokeWidth, brushColor, secondaryColor, 
    primaryOpacity, secondaryOpacity,
    zoom, layers, activeLayerId,
    updateLayer, addLayer, recordHistory, setActiveLayer
  } = store;

  // 1. Unified State for maximum stability
  const [isInteracting, setIsInteracting] = useState(false);
  const [currentMousePos, setCurrentMousePos] = useState<{ x: number, y: number } | null>(null);
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [textEditor, setTextEditor] = useState<{ x: number, y: number, value: string } | null>(null);
  const [draftShape, setDraftShape] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

  const canvasRefs = useRef<{ [key: string]: HTMLCanvasElement | null }>({});
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const draftTextCanvasRef = useRef<HTMLCanvasElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  // 2. Coordinate System
  const getCoordinates = useCallback((clientX: number, clientY: number) => {
    const stack = stackRef.current;
    if (!stack) return null;
    const rect = stack.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * (2000 / rect.width),
      y: (clientY - rect.top) * (1400 / rect.height)
    };
  }, []);

  const hexToRgba = useCallback((hex: string, opacity: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }, []);

  // 3. Logic Functions
  const commitText = useCallback(() => {
    if (textEditor && textEditor.value.trim()) {
      const typedText = textEditor.value.trim();
      addLayer({
        name: typedText.length > 20 ? typedText.substring(0, 20) + '...' : typedText,
        type: 'text',
        textContent: textEditor.value,
        position: { x: textEditor.x, y: textEditor.y },
        fontSize: brushSize * 2, 
        color: hexToRgba(brushColor, primaryOpacity), 
        strokeColor: strokeWidth > 0 ? hexToRgba(secondaryColor, secondaryOpacity) : undefined,
        strokeWidth: strokeWidth,
        visible: true, opacity: 1
      });
      recordHistory('Add Text Layer');
    }
    setTextEditor(null);
  }, [textEditor, addLayer, recordHistory, brushSize, brushColor]);

  const cancelText = useCallback(() => {
    setTextEditor(null);
  }, []);

  const clearSelection = useCallback(() => {
    if (!selectionRect || !activeLayerId) return;
    const canvas = canvasRefs.current[activeLayerId];
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (ctx && canvas) {
      ctx.clearRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
      updateLayer(activeLayerId, { dataUrl: canvas.toDataURL() });
      recordHistory('Delete Selection');
      setSelectionRect(null);
    }
  }, [selectionRect, activeLayerId, updateLayer, recordHistory]);

  // 4. Interaction Engine
  const startAction = (clientX: number, clientY: number) => {
    console.log("startAction called with", clientX, clientY);
    const coords = getCoordinates(clientX, clientY);
    console.log("Calculated coords:", coords);
    if (!coords) return;

    if (activeTool === 'text') {
      console.log("Text tool active, current textEditor:", textEditor);
      if (textEditor) commitText();
      else setTextEditor({ ...coords, value: '' });
      return;
    }

    setIsInteracting(true);
    lastPointRef.current = coords;

    if (activeTool === 'select') {
      for (const layer of layers) {
        if (layer.locked) continue;

        if (layer.type === 'text') {
          const ctx = canvasRefs.current[layer.id]?.getContext('2d');
          if (ctx) {
            const fs = layer.fontSize || 40;
            ctx.font = `${fs}px Arial`;
            const lines = (layer.textContent || '').split('\n');
            let maxWidth = 10;
            lines.forEach(line => {
              const w = ctx.measureText(line).width;
              if (w > maxWidth) maxWidth = w;
            });

            const localX = coords.x - layer.position.x;
            const localY = coords.y - layer.position.y;

            if (localX >= -10 && localX <= maxWidth + 10 && localY >= -10 && localY <= lines.length * fs + 10) {
              setActiveLayer(layer.id);
              break;
            }
          }
        } else if (layer.type === 'shape' && layer.shapeData) {
          const localX = coords.x - layer.position.x;
          const localY = coords.y - layer.position.y;
          if (localX >= 0 && localX <= layer.shapeData.w && localY >= 0 && localY <= layer.shapeData.h) {
            setActiveLayer(layer.id);
            break;
          }
        } else {
          const ctx = canvasRefs.current[layer.id]?.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            const localX = coords.x - layer.position.x;
            const localY = coords.y - layer.position.y;
            if (localX >= 0 && localY >= 0 && localX < 2000 && localY < 1400) {
              if (ctx.getImageData(localX, localY, 1, 1).data[3] > 0) {
                setActiveLayer(layer.id);
                break;
              }
            }
          }
        }
      }
    } else if (activeTool === 'marquee') {
      setSelectionRect({ x: coords.x, y: coords.y, w: 0, h: 0 });
    } else if (activeTool === 'shape') {
      setDraftShape({ x: coords.x, y: coords.y, w: 0, h: 0 });
    }
  };

  const moveAction = (clientX: number, clientY: number) => {
    const coords = getCoordinates(clientX, clientY);
    if (!coords) return;
    setCurrentMousePos(coords);

    if (!isInteracting || !lastPointRef.current) return;

    if (activeTool === 'brush' || activeTool === 'eraser') {
      const ctx = canvasRefs.current[activeLayerId || layers[0]?.id]?.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        
        if (strokeWidth > 0) {
          ctx.lineWidth = brushSize + strokeWidth * 2;
          ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
          ctx.stroke();
        }
        
        ctx.lineWidth = brushSize;
        ctx.globalCompositeOperation = activeTool === 'brush' ? 'source-over' : 'destination-out';
        ctx.strokeStyle = hexToRgba(brushColor, primaryOpacity);
        ctx.stroke();
      }
    } else if (activeTool === 'marquee') {
      setSelectionRect(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
    } else if (activeTool === 'shape') {
      setDraftShape(prev => prev ? { ...prev, w: coords.x - prev.x, h: coords.y - prev.y } : null);
    } else if (activeTool === 'move' && activeLayerId) {
      const activeLayer = layers.find(l => l.id === activeLayerId);
      if (activeLayer && !activeLayer.locked) {
        const dx = coords.x - lastPointRef.current.x;
        const dy = coords.y - lastPointRef.current.y;
        updateLayer(activeLayerId, { position: { x: activeLayer.position.x + dx, y: activeLayer.position.y + dy } });
      }
    }
    lastPointRef.current = coords;
  };

  const endAction = () => {
    if (!isInteracting) return;
    if (activeTool === 'brush' || activeTool === 'eraser') {
      const id = activeLayerId || layers[0]?.id;
      const canvas = canvasRefs.current[id];
      if (canvas) updateLayer(id, { dataUrl: canvas.toDataURL() });
    } else if (activeTool === 'shape' && draftShape) {
      const w = Math.abs(draftShape.w);
      const h = Math.abs(draftShape.h);
      if (w > 2 && h > 2) {
        addLayer({
          name: 'Rectangle',
          type: 'shape',
          position: {
            x: draftShape.w >= 0 ? draftShape.x : draftShape.x + draftShape.w,
            y: draftShape.h >= 0 ? draftShape.y : draftShape.y + draftShape.h
          },
          shapeData: { 
            w, h, 
            fill: hexToRgba(brushColor, primaryOpacity), 
            stroke: hexToRgba(secondaryColor, secondaryOpacity), 
            strokeWidth: strokeWidth 
          }
        });
        recordHistory('Add Rectangle');
      }
      setDraftShape(null);
    }
    setIsInteracting(false);
    lastPointRef.current = null;
  };

  // 5. Lifecycle Hooks
  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      moveAction(clientX, clientY);
    };
    const onUp = () => endAction();
    if (isInteracting) {
      window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
      window.addEventListener('touchmove', onMove); window.addEventListener('touchend', onUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
    };
  }, [isInteracting, moveAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (textEditor) {
        if (e.key === 'Escape') {
          commitText();
          return;
        }

        if (e.key === 'Backspace') {
          setTextEditor(prev => prev ? { ...prev, value: prev.value.slice(0, -1) } : null);
          return;
        }

        if (e.key === 'Enter') {
          // If shift is not held, we might still just want a newline for on-canvas text
          // We'll commit on Escape, or click away.
          if (e.ctrlKey || e.metaKey) {
            commitText();
            return;
          }
          setTextEditor(prev => prev ? { ...prev, value: prev.value + '\n' } : null);
          return;
        }

        if (e.key.length === 1) {
          setTextEditor(prev => prev ? { ...prev, value: prev.value + e.key } : null);
        }
        return; // Important: When textEditor is active, do not execute other global shortcuts.
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !textEditor) clearSelection();
    };

    // Prevent default browser actions for Space and Backspace to prevent scrolling/navigating
    const preventScroll = (e: KeyboardEvent) => {
      if (textEditor && (e.code === 'Space' || e.key === 'Backspace')) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keydown', preventScroll, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keydown', preventScroll, { capture: true });
    };
  }, [clearSelection, textEditor, commitText]);

  // Live text rendering to draft canvas
  useEffect(() => {
    const canvas = draftTextCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (textEditor) {
      const fs = brushSize * 2; 
      ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
      ctx.font = `${fs}px Arial`;

      const lines = textEditor.value.split('\n');
      let maxWidth = 10;
      lines.forEach((line) => {
        const w = ctx.measureText(line).width;
        if (w > maxWidth) maxWidth = w;
      });

      // Draw bounding box
      const padding = 10;
      ctx.strokeStyle = '#aaaaaa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        textEditor.x - padding,
        textEditor.y,
        maxWidth + padding * 2 + 10 /* extra for cursor */,
        lines.length * fs + padding
      );
      ctx.setLineDash([]);

      lines.forEach((line, i) => {
        const yPos = textEditor.y + (i + 1) * fs;
        if (strokeWidth > 0) {
          ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
          ctx.lineWidth = strokeWidth;
          ctx.strokeText(line, textEditor.x, yPos);
        }
        ctx.fillText(line, textEditor.x, yPos);
      });

      // Draw blinking cursor at the end of the last line
      const lastLine = lines[lines.length - 1];
      const textWidth = ctx.measureText(lastLine).width;

      const time = Date.now();
      // Only draw cursor half the time to create a blinking effect (500ms on, 500ms off)
      if (Math.floor(time / 500) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
        ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
        ctx.strokeStyle = '#000000'; // Force black cursor
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [textEditor, brushSize, brushColor]);

  // Blinking cursor animation loop
  useEffect(() => {
    if (!textEditor) return;
    let animationFrameId: number;
    const renderLoop = () => {
      const canvas = draftTextCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          const fs = brushSize * 2;
          ctx.fillStyle = hexToRgba(brushColor, primaryOpacity);
          ctx.font = `${fs}px Arial`;

          const lines = textEditor.value.split('\n');
          let maxWidth = 10;
          lines.forEach((line) => {
            const w = ctx.measureText(line).width;
            if (w > maxWidth) maxWidth = w;
          });

          // Draw bounding box
          const padding = 10;
          ctx.strokeStyle = '#aaaaaa';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(
            textEditor.x - padding,
            textEditor.y,
            maxWidth + padding * 2 + 10,
            lines.length * fs + padding
          );
          ctx.setLineDash([]);

          lines.forEach((line, i) => {
            const yPos = textEditor.y + (i + 1) * fs;
            if (strokeWidth > 0) {
              ctx.strokeStyle = hexToRgba(secondaryColor, secondaryOpacity);
              ctx.lineWidth = strokeWidth;
              ctx.strokeText(line, textEditor.x, yPos);
            }
            ctx.fillText(line, textEditor.x, yPos);
          });

          const lastLine = lines[lines.length - 1];
          const textWidth = ctx.measureText(lastLine).width;

          if (Math.floor(Date.now() / 500) % 2 === 0) {
            ctx.beginPath();
            // Adjust Y offsets to properly align the cursor with the text
            ctx.moveTo(textEditor.x + textWidth + 2, textEditor.y + (lines.length - 1) * fs + fs * 0.2);
            ctx.lineTo(textEditor.x + textWidth + 2, textEditor.y + lines.length * fs + fs * 0.2);
            ctx.strokeStyle = '#000000'; // Force black cursor
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      }
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
    return () => cancelAnimationFrame(animationFrameId);
  }, [textEditor, brushSize, brushColor]);

  useEffect(() => {
    layers.forEach(layer => {
      const canvas = canvasRefs.current[layer.id];
      const ctx = canvas?.getContext('2d', { willReadFrequently: true });
      if (!ctx || !canvas) return;
      if (layer.dataUrl) {
        const img = new Image();
        img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); };
        img.src = layer.dataUrl;
      } else if (layer.type === 'paint' && layer.name === 'Background') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (layer.type === 'text' && layer.textContent) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = layer.color || '#000000';
        const fs = layer.fontSize || 40; ctx.font = `${fs}px Arial`;
        layer.textContent.split('\n').forEach((line, i) => {
          const yPos = (i + 1) * fs;
          if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
            ctx.strokeStyle = layer.strokeColor;
            ctx.lineWidth = layer.strokeWidth;
            ctx.strokeText(line, 0, yPos);
          }
          ctx.fillText(line, 0, yPos);
        });
      } else if (layer.type === 'shape' && layer.shapeData) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (layer.shapeData.fill) {
          ctx.fillStyle = layer.shapeData.fill;
          ctx.fillRect(0, 0, layer.shapeData.w, layer.shapeData.h);
        }
        if (layer.shapeData.stroke && layer.shapeData.strokeWidth > 0) {
          ctx.strokeStyle = layer.shapeData.stroke;
          ctx.lineWidth = layer.shapeData.strokeWidth;
          ctx.strokeRect(0, 0, layer.shapeData.w, layer.shapeData.h);
        }
      }
    });
  }, [layers]);

  return (
    <div className="canvas-stack-container" onMouseDown={(e) => {
      console.log("Canvas container mousedown triggered");
      startAction(e.clientX, e.clientY);
    }}>
      <div ref={stackRef} className="canvas-stack" style={{ transform: `scale(${zoom})`, pointerEvents: 'none' }}>
        {layers.map((layer) => (
          <canvas
            key={layer.id} ref={(el) => { canvasRefs.current[layer.id] = el; }}
            width={2000} height={1400} className={`layer-canvas ${layer.visible ? 'visible' : 'hidden'}`}
            style={{
              opacity: layer.opacity, zIndex: layers.length - layers.indexOf(layer),
              transform: `translate(${layer.position.x / 2}px, ${layer.position.y / 2}px)`,
              mixBlendMode: (layer.blendMode || 'source-over') as any
            }}
          />
        ))}

        {draftShape && (
          <div className="selection-marquee" style={{
            left: draftShape.w >= 0 ? draftShape.x / 2 : (draftShape.x + draftShape.w) / 2,
            top: draftShape.h >= 0 ? draftShape.y / 2 : (draftShape.y + draftShape.h) / 2,
            width: Math.abs(draftShape.w) / 2, height: Math.abs(draftShape.h) / 2,
            backgroundColor: brushColor,
            border: `${strokeWidth / 2}px solid ${secondaryColor}`,
            opacity: primaryOpacity,
            boxSizing: 'border-box'
          }} />
        )}

        {textEditor && (
          <>
            <canvas
              ref={draftTextCanvasRef}
              width={2000} height={1400}
              className="layer-canvas visible"
              style={{
                opacity: 1,
                zIndex: 9999, // Render above everything while typing
                mixBlendMode: 'normal'
              }}
            />
            <div
              className="text-action-bar"
              style={{
                position: 'absolute',
                left: textEditor.x / 2,
                top: (textEditor.y / 2) - 35, // Positioned slightly above the bounding box
                zIndex: 10000,
                display: 'flex',
                gap: '8px',
                pointerEvents: 'auto',
                background: '#333',
                padding: '4px',
                borderRadius: '4px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
              }}
              onMouseDown={(e) => e.stopPropagation()} // Prevent canvas click passthrough
            >
              <button
                onClick={(e) => { e.stopPropagation(); commitText(); }}
                style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#4caf50', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Commit (Enter)"
              >
                ✓
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); cancelText(); }}
                style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f44336', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer', fontWeight: 'bold' }}
                title="Cancel (Esc)"
              >
                ✕
              </button>
            </div>
          </>
        )}

        {currentMousePos && (activeTool === 'brush' || activeTool === 'eraser') && (
          <div className="brush-cursor" style={{ left: currentMousePos.x / 2, top: currentMousePos.y / 2, width: brushSize / 2, height: brushSize / 2 }} />
        )}

        {selectionRect && (
          <div className="selection-marquee" style={{
            left: selectionRect.w >= 0 ? selectionRect.x / 2 : (selectionRect.x + selectionRect.w) / 2,
            top: selectionRect.h >= 0 ? selectionRect.y / 2 : (selectionRect.y + selectionRect.h) / 2,
            width: Math.abs(selectionRect.w) / 2, height: Math.abs(selectionRect.h) / 2
          }} />
        )}
      </div>
    </div>
  );
};

export default Canvas;

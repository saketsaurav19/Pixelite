import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

export const ColorRangeDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isColorRangeDialogOpen,
    setIsColorRangeDialogOpen,
    activeLayerId,
    setSelectionRect,
    setIsInverseSelection,
    setLassoPaths,
    recordHistory,
    addAlert
  } = useStore();

  const [fuzziness, setFuzziness] = useState(30);
  const [color, setColor] = useState('#ffffff');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isColorRangeDialogOpen) return null;

  const handleOK = () => {
    if (!activeLayerId) {
      addAlert({ type: 'warning', message: 'No active layer selected.' });
      setIsColorRangeDialogOpen(false);
      return;
    }

    const canvas = document.querySelector(`canvas[data-layer-id="${activeLayerId}"]`) as HTMLCanvasElement;
    const ctx = canvas?.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      addAlert({ type: 'error', message: 'Could not access active layer canvas.' });
      setIsColorRangeDialogOpen(false);
      return;
    }

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Parse target color hex
    const tr = parseInt(color.slice(1, 3), 16) || 0;
    const tg = parseInt(color.slice(3, 5), 16) || 0;
    const tb = parseInt(color.slice(5, 7), 16) || 0;

    let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;
    let found = false;

    // Scan layer for pixels within the color range fuzziness
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        if (a > 20) {
          const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
          if (dist <= fuzziness) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            found = true;
          }
        }
      }
    }

    if (found) {
      setSelectionRect({
        x: Math.max(0, minX),
        y: Math.max(0, minY),
        w: Math.min(canvas.width - minX, maxX - minX + 1),
        h: Math.min(canvas.height - minY, maxY - minY + 1)
      });
      setIsInverseSelection(false);
      setLassoPaths([]);
      recordHistory('Color Range Selection');
      addAlert({ type: 'success', message: 'Color range selected.' });
    } else {
      addAlert({ type: 'warning', message: 'No matching pixels found in color range.' });
    }

    setIsColorRangeDialogOpen(false);
  };

  return (
    <div className="dialog-overlay filter-gallery-overlay" onClick={() => setIsColorRangeDialogOpen(false)}>
      <motion.div
        drag={!isMobile}
        dragControls={isMobile ? undefined : dragControls}
        dragListener={false}
        dragMomentum={false}
        dragElastic={0}
        className="dialog-content"
        onClick={(e) => e.stopPropagation()}
        style={isMobile ? {} : { width: '400px' }}
      >
        <div
          className="dialog-header drag-handle"
          onPointerDown={(e) => !isMobile && dragControls.start(e)}
          style={{ cursor: isMobile ? 'default' : 'grab' }}
        >
          <h3>Color Range</h3>
          <button className="dialog-close" onClick={() => setIsColorRangeDialogOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dialog-control-group">
            <label>Select Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{
                width: '100%',
                height: '40px',
                padding: '2px',
                border: '1px solid var(--border-color, #333)',
                borderRadius: '4px',
                cursor: 'pointer',
                backgroundColor: 'transparent'
              }}
            />
          </div>

          <div className="dialog-control-group">
            <label>Fuzziness (Tolerance): {fuzziness}</label>
            <input
              type="range"
              min="1"
              max="200"
              value={fuzziness}
              onChange={(e) => setFuzziness(parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="dialog-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color, #333)' }}>
          <button className="btn btn-secondary" onClick={() => setIsColorRangeDialogOpen(false)}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleOK}>
            Select
          </button>
        </div>
      </motion.div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { motion, useDragControls } from 'framer-motion';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

export const TransformSelectionDialog: React.FC = () => {
  const dragControls = useDragControls();
  const {
    isTransformSelectionDialogOpen,
    setIsTransformSelectionDialogOpen,
    selectionRect,
    setSelectionRect,
    recordHistory,
    addAlert
  } = useStore();

  const [originalRect, setOriginalRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [scaleW, setScaleW] = useState(100);
  const [scaleH, setScaleH] = useState(100);
  const [moveX, setMoveX] = useState(0);
  const [moveY, setMoveY] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Capture original selection rect when dialog opens
  useEffect(() => {
    if (isTransformSelectionDialogOpen) {
      if (selectionRect) {
        setOriginalRect({ ...selectionRect });
        setScaleW(100);
        setScaleH(100);
        setMoveX(0);
        setMoveY(0);
      } else {
        addAlert({ type: 'warning', message: 'Please select an area on the canvas first.' });
        setIsTransformSelectionDialogOpen(false);
      }
    }
  }, [isTransformSelectionDialogOpen]);

  // Real-time preview updates
  useEffect(() => {
    if (!isTransformSelectionDialogOpen || !originalRect) return;

    const newW = originalRect.w * (scaleW / 100);
    const newH = originalRect.h * (scaleH / 100);

    // Scale from center & translate
    const newX = originalRect.x + moveX + (originalRect.w - newW) / 2;
    const newY = originalRect.y + moveY + (originalRect.h - newH) / 2;

    setSelectionRect({
      x: Math.round(newX),
      y: Math.round(newY),
      w: Math.max(2, Math.round(newW)),
      h: Math.max(2, Math.round(newH))
    });
  }, [scaleW, scaleH, moveX, moveY, originalRect]);

  if (!isTransformSelectionDialogOpen || !originalRect) return null;

  const handleOK = () => {
    recordHistory('Transform Selection');
    setIsTransformSelectionDialogOpen(false);
  };

  const handleCancel = () => {
    // Restore original selection rect
    if (originalRect) {
      setSelectionRect(originalRect);
    }
    setIsTransformSelectionDialogOpen(false);
  };

  return (
    <div className="dialog-overlay filter-gallery-overlay" onClick={handleCancel}>
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
          <h3>Transform Selection</h3>
          <button className="dialog-close" onClick={handleCancel}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dialog-control-group">
            <label>Scale Width: {scaleW}%</label>
            <input
              type="range"
              min="10"
              max="300"
              value={scaleW}
              onChange={(e) => setScaleW(parseInt(e.target.value))}
            />
          </div>

          <div className="dialog-control-group">
            <label>Scale Height: {scaleH}%</label>
            <input
              type="range"
              min="10"
              max="300"
              value={scaleH}
              onChange={(e) => setScaleH(parseInt(e.target.value))}
            />
          </div>

          <div className="dialog-control-group">
            <label>Move Horizontal (X): {moveX}px</label>
            <input
              type="range"
              min="-500"
              max="500"
              value={moveX}
              onChange={(e) => setMoveX(parseInt(e.target.value))}
            />
          </div>

          <div className="dialog-control-group">
            <label>Move Vertical (Y): {moveY}px</label>
            <input
              type="range"
              min="-500"
              max="500"
              value={moveY}
              onChange={(e) => setMoveY(parseInt(e.target.value))}
            />
          </div>
        </div>

        <div className="dialog-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color, #333)' }}>
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleOK}>
            Apply
          </button>
        </div>
      </motion.div>
    </div>
  );
};

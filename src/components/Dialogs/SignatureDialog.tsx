import React, { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import * as pdfjsLib from 'pdfjs-dist';
import './Dialogs.css';

export const SignatureDialog: React.FC = () => {
  const { isSignatureDialogOpen, setIsSignatureDialogOpen, addLayer, documentSize } = useStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Array<Array<{ x: number; y: number }>>>([]);
  const [color, setColor] = useState('#000000');
  const [thickness, setThickness] = useState(3);
  const [mustSmooth, setMustSmooth] = useState(true);
  const [areContours, setAreContours] = useState(false);

  // Initialize canvas context style on mount/change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
  }, [color, thickness]);

  if (!isSignatureDialogOpen) return null;

  // Drawing handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const handleStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setStrokes((prev) => [...prev, [coords]]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;

    // Append to last stroke
    setStrokes((prev) => {
      const copy = [...prev];
      if (copy.length === 0) return [[coords]];
      const lastStroke = [...copy[copy.length - 1], coords];
      copy[copy.length - 1] = lastStroke;
      return copy;
    });

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsert = async () => {
    if (strokes.length === 0) {
      alert('Please draw a signature first.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;

    let svgPath = '';

    try {
      // 1. Map strokes to pdfjsLib curves structure
      const curves = strokes.map((stroke) => {
        const flatPoints: number[] = [];
        for (const pt of stroke) {
          flatPoints.push(pt.x, pt.y);
        }
        return { points: flatPoints };
      });

      // 2. Invoke SignatureExtractor
      // Since PDF.js version is exported in the bundle, we can read SignatureExtractor
      const SignatureExtractor = (pdfjsLib as any).SignatureExtractor;
      if (SignatureExtractor) {
        console.log('[SignatureDialog] Calling SignatureExtractor.processDrawnLines...');
        const result = SignatureExtractor.processDrawnLines({
          lines: {
            curves,
            width: w,
            height: h,
            thickness: thickness,
          },
          pageWidth: w,
          pageHeight: h,
          rotation: 0,
          innerMargin: 0,
          mustSmooth: mustSmooth,
          areContours: areContours,
        });

        if (result && result.outline) {
          svgPath = result.outline.toSVGPath();
          console.log('[SignatureDialog] SignatureExtractor succeeded. SVG Path:', svgPath);
        }
      }
    } catch (err) {
      console.warn('[SignatureDialog] SignatureExtractor failed, falling back to manual bezier conversion:', err);
    }

    // Fallback: If SignatureExtractor fails or is unavailable, generate a simple SVG path
    if (!svgPath) {
      console.log('[SignatureDialog] Generating manual bezier fallback path.');
      let pathData = '';
      for (const stroke of strokes) {
        if (stroke.length === 0) continue;
        pathData += `M ${stroke[0].x} ${stroke[0].y} `;
        for (let j = 1; j < stroke.length; j++) {
          pathData += `L ${stroke[j].x} ${stroke[j].y} `;
        }
      }
      svgPath = pathData.trim();
    }

    // Create a vector shape layer in the store
    addLayer({
      name: 'Signature Path',
      type: 'shape',
      position: { x: Math.max(50, (documentSize.w - w) / 2), y: Math.max(50, (documentSize.h - h) / 2) },
      width: w,
      height: h,
      shapeData: {
        type: 'path',
        w,
        h,
        svgPath,
        fill: areContours ? color : 'transparent',
        stroke: areContours ? 'transparent' : color,
        strokeWidth: areContours ? 0 : thickness,
        smooth: mustSmooth,
        closed: areContours,
      },
    });

    setIsSignatureDialogOpen(false);
  };

  return (
    <div className="dialog-overlay" onClick={() => setIsSignatureDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '540px' }}>
        <div className="dialog-header">
          <h2>Draw Signature (Vector Tracing via SignatureExtractor)</h2>
          <button className="dialog-close" onClick={() => setIsSignatureDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-body" style={{ gap: '16px' }}>
          <p style={{ fontSize: '12px', color: '#ccc', margin: 0 }}>
            Sign below. The PDF.js <code>SignatureExtractor</code> contours algorithm will smooth your input lines into a clean, resolution-independent vector shape layer.
          </p>

          <div
            style={{
              background: '#ffffff',
              borderRadius: '6px',
              border: '1px solid #444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              cursor: 'crosshair',
              touchAction: 'none',
            }}
          >
            <canvas
              ref={canvasRef}
              width={500}
              height={220}
              style={{ display: 'block', background: '#ffffff' }}
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            <div className="setting-group" style={{ flex: '1 1 120px' }}>
              <label>Color</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                style={{
                  width: '100%',
                  height: '34px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              />
            </div>

            <div className="setting-group" style={{ flex: '1 1 180px' }}>
              <label>Brush Width ({thickness}px)</label>
              <input
                type="range"
                min="1"
                max="10"
                value={thickness}
                onChange={(e) => setThickness(Number(e.target.value))}
                style={{ width: '100%', margin: '10px 0' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px', padding: '4px 0' }}>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={mustSmooth}
                onChange={(e) => setMustSmooth(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Apply Douglas-Peucker Smoothing</span>
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={areContours}
                onChange={(e) => setAreContours(e.target.checked)}
                style={{ width: '16px', height: '16px' }}
              />
              <span>Generate Filled Contour Outline</span>
            </label>
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={handleClear} style={{ marginRight: 'auto' }}>
            Clear Canvas
          </button>
          <button className="btn-secondary" onClick={() => setIsSignatureDialogOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleInsert}>
            Insert Signature Layer
          </button>
        </div>
      </div>
    </div>
  );
};

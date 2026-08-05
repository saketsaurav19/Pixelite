import React, {
  useRef, useEffect, useState, useCallback, useMemo,
} from 'react';
import './PrecisionFillDialog.css';
import { useStore } from '../../store/useStore';

// ── Constants ───────────────────────────────────────────────────────────────
const MAX_ZOOM = 64;   // 6400%
const MIN_ZOOM = 0.05;

// ── Types ───────────────────────────────────────────────────────────────────
type Tool = 'select' | 'pencil' | 'magic' | 'eyedropper' | 'pan' | 'eraser';
type FillMode = 'manual' | 'clone' | 'contentAware';

interface HistoryEntry {
  imageData: ImageData;
  selection: Set<string>;
}

interface HoverPixel {
  x: number; y: number;
  r: number; g: number; b: number; a: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

const colorDist = (a: number[], b: number[]) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

// ── Component ───────────────────────────────────────────────────────────────
export const PrecisionFillDialog: React.FC = () => {
  const isOpen  = useStore(s => s.isPrecisionFillDialogOpen);
  const setIsOpen = useStore(s => s.setIsPrecisionFillDialogOpen);
  const activeLayerId = useStore(s => s.activeLayerId);
  const layers  = useStore(s => s.layers);
  const updateLayer = useStore(s => s.updateLayer);
  const addAlert  = useStore(s => s.addAlert);

  // ── Refs ─────────────────────────────────────────────────────────────────
  const imgCanvasRef  = useRef<HTMLCanvasElement>(null);
  const overlayRef  = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const rafRef    = useRef<number>(0);

  // ── State ─────────────────────────────────────────────────────────────────
  const [zoom, setZoom]   = useState(8);   // default 800% so pixels are visible
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [brushSize, setBrushSize] = useState(1); // pixels painted per stroke
  const [selectedPixels, setSelectedPixels] = useState<Set<string>>(new Set());
  const [tool, setTool]   = useState<Tool>('pencil');
  const [fillMode, setFillMode] = useState<FillMode>('manual');
  const [fillColor, setFillColor] = useState('#3b82f6');
  const [colorLock, setColorLock] = useState(false);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [pinnedColors, setPinnedColors] = useState<string[]>([]);
  const [magicTolerance, setMagicTolerance] = useState(15);
  const [showGrid, setShowGrid] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [splitPreview, setSplitPreview] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [currentImageData, setCurrentImageData] = useState<ImageData | null>(null);
  const [hoverPixel, setHoverPixel] = useState<HoverPixel | null>(null);
  const [mouseOverlayPos, setMouseOverlayPos] = useState<{ x: number; y: number } | null>(null);

  // Interaction refs (avoid stale closures)
  const isPanningRef  = useRef(false);
  const panStartRef   = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const isDrawingRef  = useRef(false);
  const drawModeRef   = useRef<'add' | 'remove'>('add');
  const isSpaceRef  = useRef(false);
  const currentImgRef = useRef<ImageData | null>(null); // live ref for drawing without re-render loops

  const activeLayer = useMemo(() => layers.find(l => l.id === activeLayerId), [layers, activeLayerId]);

  // keep ref in sync
  useEffect(() => { currentImgRef.current = currentImageData; }, [currentImageData]);

  // ── Load image ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !activeLayer) return;
    const canvas = imgCanvasRef.current;
    if (!canvas) return;

    const dataUrl = (activeLayer as any).dataUrl as string | undefined;
    if (!dataUrl) {
      addAlert({ type: 'warning', message: 'Select an image layer to use Precision Fill.' });
      setIsOpen(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const copy = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
      setOriginalImageData(imgData);
      setCurrentImageData(copy);
      currentImgRef.current = copy;
      setHistory([{ imageData: copy, selection: new Set() }]);
      setHistoryIndex(0);
      setSelectedPixels(new Set());

      // Center image with 8x zoom (shows pixels clearly)
      if (containerRef.current) {
        const cw = containerRef.current.clientWidth;
        const ch = containerRef.current.clientHeight;
        const fitZ = Math.min(MAX_ZOOM, Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.85);
        const initZ = Math.max(4, fitZ); // at least 4x so pixels are visible
        setZoom(initZ);
        setOffset({
          x: (cw - img.naturalWidth  * initZ) / 2,
          y: (ch - img.naturalHeight * initZ) / 2,
        });
      }
    };
    img.src = dataUrl;
  }, [isOpen, activeLayer]); // eslint-disable-line

  // ── Resize overlay ────────────────────────────────────────────────────────
  useEffect(() => {
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!overlay || !container) return;
    const sync = () => { overlay.width = container.clientWidth; overlay.height = container.clientHeight; };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(container);
    return () => ro.disconnect();
  }, [isOpen]);

  // ── Render loop ───────────────────────────────────────────────────────────
  const renderFrame = useCallback(() => {
    const imgCanvas = imgCanvasRef.current;
    const overlay   = overlayRef.current;
    if (!imgCanvas || !overlay || !currentImageData) {
      rafRef.current = requestAnimationFrame(renderFrame);
      return;
    }

    const imgCtx = imgCanvas.getContext('2d')!;
    imgCtx.putImageData(showBefore && originalImageData ? originalImageData : currentImageData, 0, 0);

    const oc = overlay.getContext('2d')!;
    oc.clearRect(0, 0, overlay.width, overlay.height);

    const iw = imgCanvas.width;
    const ih = imgCanvas.height;
    const px = zoom; // screen pixels per image pixel

    // ── Pixel grid (only show when zoom >= 4 so lines are readable) ─────────
    if (showGrid && px >= 4) {
      oc.strokeStyle = px >= 16 ? 'rgba(80,120,200,0.4)' : 'rgba(80,120,200,0.2)';
      oc.lineWidth = 0.5;
      oc.beginPath();

      const startX = Math.max(0, Math.floor(-offset.x / px));
      const endX   = Math.min(iw, Math.ceil((overlay.width  - offset.x) / px) + 1);
      const startY = Math.max(0, Math.floor(-offset.y / px));
      const endY   = Math.min(ih, Math.ceil((overlay.height - offset.y) / px) + 1);

      for (let x = startX; x <= endX; x++) {
        const sx = offset.x + x * px;
        oc.moveTo(sx, offset.y); oc.lineTo(sx, offset.y + ih * px);
      }
      for (let y = startY; y <= endY; y++) {
        const sy = offset.y + y * px;
        oc.moveTo(offset.x, sy); oc.lineTo(offset.x + iw * px, sy);
      }
      oc.stroke();
    }

    // ── Selected pixels ───────────────────────────────────────────────────
    if (selectedPixels.size > 0) {
      oc.fillStyle   = 'rgba(59,130,246,0.35)';
      oc.strokeStyle = px >= 4 ? 'rgba(96,165,250,0.9)' : 'rgba(96,165,250,0.5)';
      oc.lineWidth   = px >= 8 ? 1 : 0.5;

      for (const key of selectedPixels) {
        const comma = key.indexOf(',');
        const cx  = parseInt(key.slice(0, comma));
        const cy  = parseInt(key.slice(comma + 1));
        const sx  = offset.x + cx * px;
        const sy  = offset.y + cy * px;
        if (sx + px < 0 || sy + px < 0 || sx > overlay.width || sy > overlay.height) continue;
        oc.fillRect(sx, sy, px, px);
        if (px >= 3) oc.strokeRect(sx + 0.5, sy + 0.5, px - 1, px - 1);
      }
    }

    // ── Hover pixel highlight ─────────────────────────────────────────────
    if (hoverPixel && px >= 2) {
      const sx = offset.x + hoverPixel.x * px;
      const sy = offset.y + hoverPixel.y * px;
      oc.strokeStyle = '#ffffff';
      oc.lineWidth   = px >= 8 ? 1.5 : 1;
      oc.setLineDash([3, 2]);
      oc.strokeRect(sx + 0.5, sy + 0.5, px - 1, px - 1);
      oc.setLineDash([]);

      // Pixel coordinate label (only if zoom is large enough)
      if (px >= 16) {
        oc.font = `${Math.min(10, px * 0.3)}px monospace`;
        oc.fillStyle = 'rgba(0,0,0,0.7)';
        oc.fillRect(sx + px + 4, sy, 58, 13);
        oc.fillStyle = '#e2e8f0';
        oc.textAlign = 'left';
        oc.fillText(`${hoverPixel.x}, ${hoverPixel.y}`, sx + px + 6, sy + 10);
      }
    }

    // ── Split preview ─────────────────────────────────────────────────────
    if (splitPreview && originalImageData && !showBefore) {
      const splitPx = offset.x + splitRatio * iw * px;
      oc.strokeStyle = '#ffffff';
      oc.lineWidth   = 2;
      oc.setLineDash([6, 4]);
      oc.beginPath(); oc.moveTo(splitPx, 0); oc.lineTo(splitPx, overlay.height);
      oc.stroke();
      oc.setLineDash([]);

      oc.fillStyle = 'rgba(0,0,0,0.55)';
      oc.fillRect(splitPx - 52, 8, 48, 20);
      oc.fillRect(splitPx + 4, 8, 44, 20);
      oc.fillStyle = '#fff';
      oc.font = '10px Inter,sans-serif';
      oc.textAlign = 'right'; oc.fillText('Before', splitPx - 5, 22);
      oc.textAlign = 'left';  oc.fillText('After',  splitPx + 9, 22);
    }

    // ── Eyedropper Tool Popup & Magnifier Loupe ─────────────────────────────
    if (tool === 'eyedropper' && hoverPixel && mouseOverlayPos) {
      const hoverHex = rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b);
      const mX = mouseOverlayPos.x;
      const mY = mouseOverlayPos.y;

      let lx = mX + 55;
      let ly = mY - 55;
      const radius = 34;
      const cardW = 145;
      const cardH = 58;

      if (lx + radius + cardW / 2 > overlay.width - 15) lx = mX - 55;
      if (ly - radius < 15) ly = mY + 55;
      if (lx - radius < 15) lx = radius + 15;
      if (ly + radius + cardH > overlay.height - 15) ly = overlay.height - radius - cardH - 15;

      // Guide line to target point
      oc.beginPath();
      oc.moveTo(mX, mY);
      oc.lineTo(lx, ly);
      oc.strokeStyle = 'rgba(96, 165, 250, 0.7)';
      oc.lineWidth = 1.5;
      oc.setLineDash([3, 3]);
      oc.stroke();
      oc.setLineDash([]);

      // Target cursor dot
      oc.beginPath();
      oc.arc(mX, mY, 4, 0, Math.PI * 2);
      oc.fillStyle = hoverHex;
      oc.fill();
      oc.strokeStyle = '#ffffff';
      oc.lineWidth = 1.5;
      oc.stroke();

      // Loupe outer shadow & base circle
      oc.save();
      oc.shadowColor = 'rgba(0, 0, 0, 0.6)';
      oc.shadowBlur = 10;
      oc.beginPath();
      oc.arc(lx, ly, radius + 5, 0, Math.PI * 2);
      oc.fillStyle = '#0f172a';
      oc.fill();
      oc.restore();

      // Magnified 5x5 pixel grid inside loupe circle
      oc.save();
      oc.beginPath();
      oc.arc(lx, ly, radius, 0, Math.PI * 2);
      oc.clip();

      const tileSize = (radius * 2) / 5;
      const startTileX = lx - radius;
      const startTileY = ly - radius;

      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = hoverPixel.x + dx;
          const py = hoverPixel.y + dy;
          const tileX = startTileX + (dx + 2) * tileSize;
          const tileY = startTileY + (dy + 2) * tileSize;

          if (currentImageData && px >= 0 && py >= 0 && px < currentImageData.width && py < currentImageData.height) {
            const idx = (py * currentImageData.width + px) * 4;
            const pr = currentImageData.data[idx];
            const pg = currentImageData.data[idx + 1];
            const pb = currentImageData.data[idx + 2];
            oc.fillStyle = rgbToHex(pr, pg, pb);
          } else {
            oc.fillStyle = '#1e293b';
          }
          oc.fillRect(tileX, tileY, tileSize + 0.5, tileSize + 0.5);

          oc.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          oc.lineWidth = 0.5;
          oc.strokeRect(tileX, tileY, tileSize, tileSize);
        }
      }

      // Center pixel reticle
      const centerTx = startTileX + 2 * tileSize;
      const centerTy = startTileY + 2 * tileSize;
      oc.strokeStyle = '#ffffff';
      oc.lineWidth = 2;
      oc.strokeRect(centerTx, centerTy, tileSize, tileSize);
      oc.strokeStyle = '#000000';
      oc.lineWidth = 1;
      oc.strokeRect(centerTx - 1, centerTy - 1, tileSize + 2, tileSize + 2);
      oc.restore();

      // Comparison Color Ring
      oc.lineWidth = 6;
      oc.beginPath();
      oc.arc(lx, ly, radius + 2, Math.PI, Math.PI * 2);
      oc.strokeStyle = fillColor;
      oc.stroke();

      oc.beginPath();
      oc.arc(lx, ly, radius + 2, 0, Math.PI);
      oc.strokeStyle = hoverHex;
      oc.stroke();

      oc.beginPath();
      oc.arc(lx, ly, radius + 5, 0, Math.PI * 2);
      oc.strokeStyle = '#ffffff';
      oc.lineWidth = 1.5;
      oc.stroke();

      // Floating Info Card
      const cardX = lx - cardW / 2;
      const cardY = ly + radius + 10;

      oc.save();
      oc.shadowColor = 'rgba(0, 0, 0, 0.4)';
      oc.shadowBlur = 8;
      oc.fillStyle = 'rgba(15, 23, 42, 0.94)';
      oc.strokeStyle = '#3b82f6';
      oc.lineWidth = 1.5;

      const r = 6;
      oc.beginPath();
      oc.moveTo(cardX + r, cardY);
      oc.lineTo(cardX + cardW - r, cardY);
      oc.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
      oc.lineTo(cardX + cardW, cardY + cardH - r);
      oc.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
      oc.lineTo(cardX + r, cardY + cardH);
      oc.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
      oc.lineTo(cardX, cardY + r);
      oc.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
      oc.closePath();
      oc.fill();
      oc.stroke();
      oc.restore();

      oc.fillStyle = hoverHex;
      oc.fillRect(cardX + 10, cardY + 10, 16, 16);
      oc.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      oc.lineWidth = 1;
      oc.strokeRect(cardX + 10, cardY + 10, 16, 16);

      oc.font = 'bold 12px "Courier New", monospace';
      oc.fillStyle = '#f8fafc';
      oc.textAlign = 'left';
      oc.fillText(hoverHex.toUpperCase(), cardX + 34, cardY + 22);

      oc.font = '10px "Courier New", monospace';
      oc.fillStyle = '#94a3b8';
      oc.fillText(`RGB: ${hoverPixel.r}, ${hoverPixel.g}, ${hoverPixel.b}`, cardX + 10, cardY + 40);

      oc.font = '9px "Courier New", monospace';
      oc.fillStyle = '#60a5fa';
      oc.textAlign = 'right';
      oc.fillText(`X:${hoverPixel.x} Y:${hoverPixel.y}`, cardX + cardW - 10, cardY + 50);
    }

    rafRef.current = requestAnimationFrame(renderFrame);
  }, [currentImageData, originalImageData, selectedPixels, hoverPixel, mouseOverlayPos,
      zoom, offset, showGrid, showBefore, splitPreview, splitRatio, fillColor, tool]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderFrame]);

  // ── Coord helper ──────────────────────────────────────────────────────────
  const screenToPixel = useCallback((sx: number, sy: number, z: number, off: { x: number; y: number }) => {
    const canvas = imgCanvasRef.current;
    if (!canvas) return null;
    const imgX = Math.floor((sx - off.x) / z);
    const imgY = Math.floor((sy - off.y) / z);
    if (imgX < 0 || imgY < 0 || imgX >= canvas.width || imgY >= canvas.height) return null;
    return { x: imgX, y: imgY, key: `${imgX},${imgY}` };
  }, []);

  const getPixelRGBA = useCallback((x: number, y: number, imgData: ImageData): number[] => {
    const idx = (y * imgData.width + x) * 4;
    return [imgData.data[idx], imgData.data[idx+1], imgData.data[idx+2], imgData.data[idx+3]];
  }, []);

  // ── Get brush pixels around a center pixel ────────────────────────────────
  const getBrushPixels = useCallback((cx: number, cy: number, imgW: number, imgH: number): string[] => {
    const r = Math.floor(brushSize / 2);
    const keys: string[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx, py = cy + dy;
        if (px >= 0 && py >= 0 && px < imgW && py < imgH) {
          keys.push(`${px},${py}`);
        }
      }
    }
    return keys;
  }, [brushSize]);

  // ── Magic select BFS by color tolerance ──────────────────────────────────
  const magicSelect = useCallback((startX: number, startY: number, addToSel: boolean) => {
    const canvas  = imgCanvasRef.current;
    const imgData = currentImgRef.current;
    if (!canvas || !imgData) return;

    const baseColor = getPixelRGBA(startX, startY, imgData);
    const visited = new Set<string>();
    const toAdd   = new Set<string>();
    const queue: [number, number][] = [[startX, startY]];

    while (queue.length) {
      const [x, y] = queue.shift()!;
      const key = `${x},${y}`;
      if (visited.has(key) || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      visited.add(key);
      const color = getPixelRGBA(x, y, imgData);
      if (colorDist(color, baseColor) <= magicTolerance) {
        toAdd.add(key);
        queue.push([x-1,y],[x+1,y],[x,y-1],[x,y+1]);
      }
    }

    setSelectedPixels(prev => addToSel ? new Set([...prev, ...toAdd]) : toAdd);
  }, [magicTolerance, getPixelRGBA]);

  // ── Paint pixels directly into ImageData (no history yet) ─────────────────
  const paintPixel = useCallback((x: number, y: number, imgData: ImageData, erase = false) => {
    const [r, g, b] = hexToRgb(fillColor);
    const iw = imgData.width, ih = imgData.height;
    const brushR = Math.floor(brushSize / 2);

    for (let dy = -brushR; dy <= brushR; dy++) {
      for (let dx = -brushR; dx <= brushR; dx++) {
        const px = x + dx, py = y + dy;
        if (px < 0 || py < 0 || px >= iw || py >= ih) continue;
        const idx = (py * iw + px) * 4;
        if (erase) {
          imgData.data[idx+3] = 0; // make transparent
        } else {
          imgData.data[idx]   = r;
          imgData.data[idx+1] = g;
          imgData.data[idx+2] = b;
          imgData.data[idx+3] = 255;
        }
      }
    }
    // Immediately update canvas
    const ctx = imgCanvasRef.current?.getContext('2d');
    ctx?.putImageData(imgData, 0, 0);
  }, [fillColor, brushSize]);

  // ── Commit history ─────────────────────────────────────────────────────────
  const commitHistory = useCallback((imgData: ImageData, sel: Set<string>) => {
    const copy = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
    setHistory(prev => [...prev.slice(0, historyIndex + 1), { imageData: copy, selection: new Set(sel) }]);
    setHistoryIndex(h => h + 1);
  }, [historyIndex]);

  // ── Fill selected pixels ─────────────────────────────────────────────────
  const fillSelected = useCallback((selOverride?: Set<string>) => {
    const sel = selOverride ?? selectedPixels;
    const imgData = currentImgRef.current;
    if (!sel.size || !imgData) return;

    const newData = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
    const [fr, fg, fb] = hexToRgb(fillColor);
    const iw = newData.width;

    for (const key of sel) {
      const comma = key.indexOf(',');
      const px = parseInt(key.slice(0, comma));
      const py = parseInt(key.slice(comma + 1));
      const idx = (py * iw + px) * 4;

      if (fillMode === 'manual') {
        newData.data[idx]   = fr;
        newData.data[idx+1] = fg;
        newData.data[idx+2] = fb;
        newData.data[idx+3] = 255;
      } else {
        // Sample surrounding non-selected pixels
        const neighbors: number[][] = [];
        for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
          const npx = px + dx, npy = py + dy;
          if (npx < 0 || npy < 0 || npx >= iw || npy >= newData.height) continue;
          if (sel.has(`${npx},${npy}`)) continue;
          const nidx = (npy * iw + npx) * 4;
          neighbors.push([newData.data[nidx], newData.data[nidx+1], newData.data[nidx+2]]);
        }
        if (neighbors.length) {
          const avgR = neighbors.reduce((s,c) => s+c[0], 0) / neighbors.length;
          const avgG = neighbors.reduce((s,c) => s+c[1], 0) / neighbors.length;
          const avgB = neighbors.reduce((s,c) => s+c[2], 0) / neighbors.length;
          const noise = fillMode === 'contentAware' ? () => (Math.random() - 0.5) * 6 : () => 0;
          newData.data[idx]   = Math.max(0, Math.min(255, Math.round(avgR + noise())));
          newData.data[idx+1] = Math.max(0, Math.min(255, Math.round(avgG + noise())));
          newData.data[idx+2] = Math.max(0, Math.min(255, Math.round(avgB + noise())));
          newData.data[idx+3] = 255;
        }
      }
    }

    setCurrentImageData(newData);
    currentImgRef.current = newData;
    const ctx = imgCanvasRef.current?.getContext('2d');
    ctx?.putImageData(newData, 0, 0);
    commitHistory(newData, sel);

    if (fillMode === 'manual') {
      setRecentColors(prev => [fillColor, ...prev.filter(c => c !== fillColor)].slice(0, 16));
    }
  }, [selectedPixels, fillMode, fillColor, commitHistory]);

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const entry = history[historyIndex - 1];
    const copy  = new ImageData(new Uint8ClampedArray(entry.imageData.data), entry.imageData.width, entry.imageData.height);
    setCurrentImageData(copy);
    currentImgRef.current = copy;
    setSelectedPixels(new Set(entry.selection));
    setHistoryIndex(h => h - 1);
    imgCanvasRef.current?.getContext('2d')?.putImageData(copy, 0, 0);
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const entry = history[historyIndex + 1];
    const copy  = new ImageData(new Uint8ClampedArray(entry.imageData.data), entry.imageData.width, entry.imageData.height);
    setCurrentImageData(copy);
    currentImgRef.current = copy;
    setSelectedPixels(new Set(entry.selection));
    setHistoryIndex(h => h + 1);
    imgCanvasRef.current?.getContext('2d')?.putImageData(copy, 0, 0);
  }, [history, historyIndex]);

  // ── Average surrounding color ────────────────────────────────────────────
  const pickAverageColor = useCallback(() => {
    const imgData = currentImgRef.current;
    const canvas  = imgCanvasRef.current;
    if (!selectedPixels.size || !imgData || !canvas) return;
    let r = 0, g = 0, b = 0, count = 0;
    for (const key of selectedPixels) {
      const comma = key.indexOf(',');
      const px = parseInt(key.slice(0, comma));
      const py = parseInt(key.slice(comma + 1));
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const npx = px + dx, npy = py + dy;
        if (npx < 0 || npy < 0 || npx >= canvas.width || npy >= canvas.height) continue;
        if (selectedPixels.has(`${npx},${npy}`)) continue;
        const [cr,cg,cb] = getPixelRGBA(npx, npy, imgData);
        r += cr; g += cg; b += cb; count++;
      }
    }
    if (count > 0) setFillColor(rgbToHex(Math.round(r/count), Math.round(g/count), Math.round(b/count)));
  }, [selectedPixels, getPixelRGBA]);

  // ── getOverlayXY ─────────────────────────────────────────────────────────
  const getOverlayXY = (e: MouseEvent) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e: MouseEvent) => {
    const { x, y } = getOverlayXY(e);

    if (isSpaceRef.current || tool === 'pan') {
      isPanningRef.current = true;
      panStartRef.current  = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
      return;
    }

    const pix = screenToPixel(x, y, zoom, offset);

    if (tool === 'eyedropper') {
      if (pix && currentImgRef.current) {
        isDrawingRef.current = true;
        const [r, g, b] = getPixelRGBA(pix.x, pix.y, currentImgRef.current);
        const hex = rgbToHex(r, g, b);
        setFillColor(hex);
        setRecentColors(prev => [hex, ...prev.filter(c => c !== hex)].slice(0, 16));
      }
      return;
    }

    if (tool === 'magic') {
      if (pix) magicSelect(pix.x, pix.y, e.ctrlKey || e.metaKey);
      return;
    }

    if (tool === 'pencil' || tool === 'eraser') {
      if (!pix) return;
      isDrawingRef.current = true;
      const imgData = currentImgRef.current;
      if (!imgData) return;
      const erase = tool === 'eraser';

      // Work on a mutable copy during the stroke
      const workData = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
      currentImgRef.current = workData;
      paintPixel(pix.x, pix.y, workData, erase);
      return;
    }

    if (tool === 'select') {
      if (!pix) return;
      const canvas = imgCanvasRef.current;
      if (!canvas) return;

      isDrawingRef.current = true;

      if (e.altKey) {
        drawModeRef.current = 'remove';
        const brushKeys = getBrushPixels(pix.x, pix.y, canvas.width, canvas.height);
        setSelectedPixels(prev => { const n = new Set(prev); brushKeys.forEach(k => n.delete(k)); return n; });
      } else if (e.ctrlKey || e.metaKey) {
        drawModeRef.current = 'add';
        setSelectedPixels(prev => {
          const n = new Set(prev);
          const k = pix.key;
          if (n.has(k)) n.delete(k); else n.add(k);
          return n;
        });
      } else if (e.shiftKey) {
        drawModeRef.current = 'add';
        const brushKeys = getBrushPixels(pix.x, pix.y, canvas.width, canvas.height);
        setSelectedPixels(prev => new Set([...prev, ...brushKeys]));
      } else {
        drawModeRef.current = 'add';
        const brushKeys = getBrushPixels(pix.x, pix.y, canvas.width, canvas.height);
        setSelectedPixels(new Set(brushKeys));
      }

      if (colorLock && fillMode === 'manual' && !e.altKey) {
        const singleSet = new Set(getBrushPixels(pix.x, pix.y, canvas.width, canvas.height));
        setTimeout(() => fillSelected(singleSet), 0);
      }
    }
  }, [tool, offset, zoom, screenToPixel, getPixelRGBA, magicSelect, getBrushPixels, paintPixel, colorLock, fillMode, fillSelected]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isPanningRef.current && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.mx;
      const dy = e.clientY - panStartRef.current.my;
      setOffset({ x: panStartRef.current.ox + dx, y: panStartRef.current.oy + dy });
      return;
    }

    const { x, y } = getOverlayXY(e);
    setMouseOverlayPos({ x, y });
    const pix = screenToPixel(x, y, zoom, offset);

    // Update hover info
    if (pix && currentImgRef.current) {
      const [r, g, b, a] = getPixelRGBA(pix.x, pix.y, currentImgRef.current);
      setHoverPixel({ x: pix.x, y: pix.y, r, g, b, a });

      if (tool === 'eyedropper' && isDrawingRef.current) {
        const hex = rgbToHex(r, g, b);
        setFillColor(hex);
        setRecentColors(prev => [hex, ...prev.filter(c => c !== hex)].slice(0, 16));
      }
    } else {
      setHoverPixel(null);
    }

    if (!isDrawingRef.current) return;
    if (!pix) return;

    const canvas = imgCanvasRef.current;

    if (tool === 'pencil' || tool === 'eraser') {
      const imgData = currentImgRef.current;
      if (!imgData) return;
      paintPixel(pix.x, pix.y, imgData, tool === 'eraser');
      return;
    }

    if (tool === 'select' && canvas) {
      const brushKeys = getBrushPixels(pix.x, pix.y, canvas.width, canvas.height);
      if (drawModeRef.current === 'remove') {
        setSelectedPixels(prev => { const n = new Set(prev); brushKeys.forEach(k => n.delete(k)); return n; });
      } else {
        setSelectedPixels(prev => new Set([...prev, ...brushKeys]));
      }
    }
  }, [tool, zoom, offset, screenToPixel, getPixelRGBA, paintPixel, getBrushPixels]);

  const handleMouseUp = useCallback(() => {
    if (isDrawingRef.current && tool === 'eyedropper') {
      addAlert({ type: 'success', message: `Picked color ${fillColor}` });
    }
    if (isDrawingRef.current && (tool === 'pencil' || tool === 'eraser')) {
      // Commit the paint stroke to history
      const imgData = currentImgRef.current;
      if (imgData) {
        const copy = new ImageData(new Uint8ClampedArray(imgData.data), imgData.width, imgData.height);
        setCurrentImageData(copy);
        commitHistory(imgData, selectedPixels);
        if (tool === 'pencil' && fillMode === 'manual') {
          setRecentColors(prev => [fillColor, ...prev.filter(c => c !== fillColor)].slice(0, 16));
        }
      }
    }
    isPanningRef.current  = false;
    panStartRef.current   = null;
    isDrawingRef.current  = false;
  }, [tool, selectedPixels, fillColor, fillMode, commitHistory]);

  const handleDblClick = useCallback((e: MouseEvent) => {
    if (tool !== 'select') return;
    const { x, y } = getOverlayXY(e);
    const pix = screenToPixel(x, y, zoom, offset);
    if (pix) magicSelect(pix.x, pix.y, e.ctrlKey || e.metaKey);
  }, [tool, zoom, offset, screenToPixel, magicSelect]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const rect = overlayRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    setZoom(prev => {
      const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev * factor));
      setOffset(po => ({
        x: mx - (mx - po.x) * (nz / prev),
        y: my - (my - po.y) * (nz / prev),
      }));
      return nz;
    });
  }, []);

  // Attach raw events
  useEffect(() => {
    if (!isOpen) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const handleMouseLeave = () => {
      setHoverPixel(null);
      setMouseOverlayPos(null);
    };
    overlay.addEventListener('mousedown',  handleMouseDown);
    overlay.addEventListener('dblclick',   handleDblClick);
    overlay.addEventListener('wheel',      handleWheel,      { passive: false });
    overlay.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousemove',   handleMouseMove);
    window.addEventListener('mouseup',     handleMouseUp);
    return () => {
      overlay.removeEventListener('mousedown',  handleMouseDown);
      overlay.removeEventListener('dblclick',   handleDblClick);
      overlay.removeEventListener('wheel',      handleWheel);
      overlay.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousemove',   handleMouseMove);
      window.removeEventListener('mouseup',     handleMouseUp);
    };
  }, [isOpen, handleMouseDown, handleMouseMove, handleMouseUp, handleDblClick, handleWheel]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const onDown = (e: KeyboardEvent) => {
      if (e.key === ' ') { isSpaceRef.current = true; e.preventDefault(); return; }
      if (e.key === 'Escape') { handleClose(); return; }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { undo(); e.preventDefault(); return; }
        if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { redo(); e.preventDefault(); return; }
        if (e.key === 'a') {
          e.preventDefault();
          const canvas = imgCanvasRef.current;
          if (!canvas) return;
          const all = new Set<string>();
          for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) all.add(`${px},${py}`);
          setSelectedPixels(all);
          return;
        }
        if (e.key === 'd') { e.preventDefault(); setSelectedPixels(new Set()); return; }
      }
      if (e.key === 'b' || e.key === 'B') { setTool('pencil'); return; }
      if (e.key === 'e' || e.key === 'E') { setTool('eraser'); return; }
      if (e.key === 'i' || e.key === 'I') { setTool('eyedropper'); return; }
      if (e.key === 'm' || e.key === 'M') { setTool('magic'); return; }
      if (e.key === 's' || e.key === 'S') { setTool('select'); return; }
      if (e.key === 'f' || e.key === 'F') { fillSelected(); return; }
      if (e.key === '[') { setBrushSize(s => Math.max(1, s - 2)); return; }
      if (e.key === ']') { setBrushSize(s => Math.min(51, s + 2)); return; }
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === ' ') isSpaceRef.current = false; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, [isOpen, undo, redo, fillSelected]);

  // ── Select All / Invert ───────────────────────────────────────────────────
  const selectAll = useCallback(() => {
    const canvas = imgCanvasRef.current;
    if (!canvas) return;
    const all = new Set<string>();
    for (let py = 0; py < canvas.height; py++) for (let px = 0; px < canvas.width; px++) all.add(`${px},${py}`);
    setSelectedPixels(all);
  }, []);

  const invertSelection = useCallback(() => {
    const canvas = imgCanvasRef.current;
    if (!canvas) return;
    const inv = new Set<string>();
    for (let py = 0; py < canvas.height; py++)
      for (let px = 0; px < canvas.width; px++) {
        const k = `${px},${py}`;
        if (!selectedPixels.has(k)) inv.add(k);
      }
    setSelectedPixels(inv);
  }, [selectedPixels]);

  // ── Fit zoom ──────────────────────────────────────────────────────────────
  const fitZoom = useCallback(() => {
    const canvas    = imgCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const fz = Math.min(container.clientWidth / canvas.width, container.clientHeight / canvas.height) * 0.85;
    setZoom(fz);
    setOffset({
      x: (container.clientWidth  - canvas.width  * fz) / 2,
      y: (container.clientHeight - canvas.height * fz) / 2,
    });
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────
  const exportImage = useCallback((format: 'png' | 'jpg') => {
    const canvas = imgCanvasRef.current;
    const imgData = currentImgRef.current;
    if (!canvas || !imgData) return;
    canvas.getContext('2d')!.putImageData(imgData, 0, 0);
    const url = canvas.toDataURL(format === 'png' ? 'image/png' : 'image/jpeg', 0.95);
    const a = document.createElement('a');
    a.href = url; a.download = `precision-fill.${format}`; a.click();
  }, []);

  // ── Apply to layer ────────────────────────────────────────────────────────
  const applyToLayer = useCallback(() => {
    const canvas  = imgCanvasRef.current;
    const imgData = currentImgRef.current;
    if (!canvas || !imgData || !activeLayerId) return;
    canvas.getContext('2d')!.putImageData(imgData, 0, 0);
    updateLayer(activeLayerId, { dataUrl: canvas.toDataURL('image/png'), thumbnail: '' });
    addAlert({ type: 'success', message: '✅ Precision Fill applied to layer!' });
    setIsOpen(false);
  }, [activeLayerId, updateLayer, addAlert, setIsOpen]);

  // ── Close ────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedPixels(new Set());
    setHistory([]); setHistoryIndex(-1);
    setCurrentImageData(null); setOriginalImageData(null);
    currentImgRef.current = null;
  }, [setIsOpen]);

  if (!isOpen) return null;

  const zoomPct = Math.round(zoom * 100);
  const imgW    = imgCanvasRef.current?.width  ?? 0;
  const imgH    = imgCanvasRef.current?.height ?? 0;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  return (
    <div className="pf-overlay">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="pf-header">
        <div className="pf-header-left">
          <span className="pf-logo">⚗</span>
          <span className="pf-title">Precision Fill</span>
          <span className="pf-badge">PIXEL</span>
        </div>

        <div className="pf-header-center">
          {/* Pixel info */}
          {hoverPixel ? (
            <div className="pf-pixel-info">
              <span className="pf-pixel-coord">({hoverPixel.x}, {hoverPixel.y})</span>
              <div className="pf-pixel-swatch" style={{ background: rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b) }} />
              <span className="pf-pixel-rgba">R:{hoverPixel.r} G:{hoverPixel.g} B:{hoverPixel.b} A:{hoverPixel.a}</span>
              <span className="pf-pixel-hex">{rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b)}</span>
            </div>
          ) : (
            <span className="pf-sel-info">{imgW}×{imgH}px</span>
          )}

          <div className="pf-sep" />

          {/* Brush size */}
          <div className="pf-group">
            <span className="pf-label">Brush</span>
            {[1, 3, 5, 9].map(s => (
              <button key={s} className={`pf-btn-sm ${brushSize === s ? 'active' : ''}`} onClick={() => setBrushSize(s)}>
                {s}px
              </button>
            ))}
            <input
              className="pf-input-sm"
              value={brushSize === 1 || brushSize === 3 || brushSize === 5 || brushSize === 9 ? '' : brushSize}
              placeholder="…"
              style={{ width: 32 }}
              onChange={e => { const v = parseInt(e.target.value); if (v >= 1 && v <= 51) setBrushSize(v); }}
              title="Custom brush size (odd, 1–51)"
            />
          </div>

          <div className="pf-sep" />

          {/* Zoom */}
          <div className="pf-group">
            <span className="pf-label">Zoom</span>
            <button className="pf-btn-sm" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.5))}>−</button>
            <span className="pf-zoom-val">{zoomPct}%</span>
            <button className="pf-btn-sm" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.5))}>+</button>
            <button className="pf-btn-sm" onClick={fitZoom}>Fit</button>
            {[4, 8, 16, 32].map(z => (
              <button key={z} className={`pf-btn-sm ${Math.round(zoom) === z ? 'active' : ''}`}
                onClick={() => { setZoom(z); setOffset({ x: (containerRef.current?.clientWidth ?? 600) / 2 - imgW * z / 2, y: (containerRef.current?.clientHeight ?? 400) / 2 - imgH * z / 2 }); }}>
                {z * 100}%
              </button>
            ))}
          </div>

          <div className="pf-sep" />

          <button className={`pf-btn-sm ${showGrid ? 'active' : ''}`} onClick={() => setShowGrid(g => !g)}>⊞ Grid</button>
          <span className="pf-sel-info">{selectedPixels.size.toLocaleString()} px sel.</span>
        </div>

        <div className="pf-header-right">
          <button className={`pf-btn-sm ${showBefore ? 'active' : ''}`} onClick={() => setShowBefore(b => !b)}>Before</button>
          <button className={`pf-btn-sm ${splitPreview ? 'active' : ''}`} onClick={() => setSplitPreview(s => !s)}>Split</button>
          <button className="pf-btn-sm" onClick={undo} disabled={!canUndo}>↩ Undo</button>
          <button className="pf-btn-sm" onClick={redo} disabled={!canRedo}>Redo ↪</button>
          <button className="pf-btn-primary" onClick={applyToLayer}>Apply to Layer</button>
          <button className="pf-btn-close" onClick={handleClose} title="Close (Esc)">✕</button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="pf-body">
        {/* Left toolbar */}
        <div className="pf-toolbar">
          <div className="pf-tool-section">
            <span className="pf-tool-label">TOOL</span>
            {([
              { id: 'pencil',     icon: '✏️',  title: 'Pencil — draw pixels  [B]' },
              { id: 'eraser',     icon: '🧹',  title: 'Eraser  [E]' },
              { id: 'select',     icon: '⬚',   title: 'Select pixels  [S]' },
              { id: 'magic',      icon: '✨',  title: 'Magic Wand — select similar  [M]' },
              { id: 'eyedropper', icon: '🔬',  title: 'Eyedropper — pick color  [I]' },
              { id: 'pan',        icon: '✋',  title: 'Pan  [Space]' },
            ] as const).map(t => (
              <button key={t.id} title={t.title}
                className={`pf-tool ${tool === t.id ? 'active' : ''}`}
                onClick={() => setTool(t.id)}>
                {t.icon}
              </button>
            ))}
          </div>

          <div className="pf-divider-h" />

          <div className="pf-tool-section">
            <span className="pf-tool-label">TOLERANCE</span>
            <div className="pf-tolerance-wrap">
              <input type="range" min={0} max={255} value={magicTolerance}
                onChange={e => setMagicTolerance(+e.target.value)} className="pf-slider" />
              <span className="pf-tol-val">{magicTolerance}</span>
            </div>
          </div>

          <div className="pf-divider-h" />

          <div className="pf-tool-section">
            <span className="pf-tool-label">SEL</span>
            <button className="pf-tool-action" onClick={selectAll}        title="Select All (Ctrl+A)">All</button>
            <button className="pf-tool-action" onClick={() => setSelectedPixels(new Set())} title="Deselect (Ctrl+D)">None</button>
            <button className="pf-tool-action" onClick={invertSelection}  title="Invert">Inv</button>
          </div>
        </div>

        {/* Canvas */}
        <div className="pf-canvas-area" ref={containerRef}>
          <canvas
            ref={imgCanvasRef}
            style={{
              position: 'absolute',
              left: offset.x, top: offset.y,
              width:  imgW * zoom,
              height: imgH * zoom,
              imageRendering: zoom >= 2 ? 'pixelated' : 'auto',
              pointerEvents: 'none',
            }}
          />
          <canvas
            ref={overlayRef}
            className={`pf-overlay-canvas ${
              isSpaceRef.current || tool === 'pan' ? 'cursor-pan'
              : tool === 'eyedropper' ? 'cursor-eye'
              : tool === 'pencil' || tool === 'eraser' ? 'cursor-crosshair'
              : 'cursor-crosshair'
            }`}
          />

          {/* Split drag handle */}
          {splitPreview && (
            <div style={{ position:'absolute', left: offset.x + splitRatio * imgW * zoom - 8, top:0, bottom:0, width:16, cursor:'col-resize', zIndex:10 }}
              onMouseDown={e => {
                const startX = e.clientX, startR = splitRatio;
                const onMove = (me: MouseEvent) => setSplitRatio(Math.max(0.05, Math.min(0.95, startR + (me.clientX - startX) / (imgW * zoom))));
                const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
              }}
            />
          )}

          <div className="pf-zoom-badge">{zoomPct}% · {imgW}×{imgH}px · 1 cell = 1px</div>
        </div>

        {/* Right panel */}
        <div className="pf-right-panel">
          {/* Fill mode */}
          <div className="pf-panel-section">
            <div className="pf-section-title">Fill Mode</div>
            {([
              { id: 'manual',       label: 'Manual Color',   icon: '🎨' },
              { id: 'clone',        label: 'Clone Nearby',   icon: '🔁' },
              { id: 'contentAware', label: 'Content-Aware',  icon: '🧠' },
            ] as const).map(m => (
              <button key={m.id}
                className={`pf-mode-btn ${fillMode === m.id ? 'active' : ''}`}
                onClick={() => setFillMode(m.id)}>
                <span>{m.icon}</span><span>{m.label}</span>
              </button>
            ))}
            <button className="pf-mode-btn disabled"
              onClick={() => addAlert({ type: 'info', message: '🧪 AI Inpaint — coming soon! Requires LaMa / MAT local model.' })}>
              <span>🤖</span><span>AI Inpaint</span>
            </button>
          </div>

          {/* Color */}
          <div className="pf-panel-section">
            <div className="pf-section-title">Color</div>
            <div className="pf-color-row">
              <input type="color" value={fillColor} onChange={e => setFillColor(e.target.value)} className="pf-color-swatch-input" />
              <input type="text"  value={fillColor}
                onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setFillColor(e.target.value); }}
                className="pf-hex-input" />
            </div>
            <div className="pf-color-actions">
              <button className="pf-micro-btn" onClick={() => setTool('eyedropper')} title="Pick pixel color [I]">🔬 Pick</button>
              <button className="pf-micro-btn" onClick={pickAverageColor} title="Average surrounding">⊕ Avg</button>
              <button className={`pf-micro-btn ${colorLock ? 'active' : ''}`}
                onClick={() => setColorLock(c => !c)}
                title="Color Lock: paint immediately on click">
                {colorLock ? '🔒 Lock' : '🔓 Lock'}
              </button>
            </div>

            {recentColors.length > 0 && (
              <>
                <div className="pf-mini-label">Recent</div>
                <div className="pf-color-grid">
                  {recentColors.map((c, i) => (
                    <div key={i} className="pf-color-dot" style={{ background: c }} onClick={() => setFillColor(c)} title={c} />
                  ))}
                </div>
              </>
            )}

            <div className="pf-mini-label">
              Pinned
              <button className="pf-pin-btn"
                onClick={() => setPinnedColors(p => p.includes(fillColor) ? p : [...p, fillColor])}>
                + Pin
              </button>
            </div>
            <div className="pf-color-grid">
              {pinnedColors.map((c, i) => (
                <div key={i} className="pf-color-dot pinned" style={{ background: c }}
                  onClick={() => setFillColor(c)} title={`${c} — right-click to unpin`}
                  onContextMenu={e => { e.preventDefault(); setPinnedColors(p => p.filter(x => x !== c)); }} />
              ))}
              {pinnedColors.length === 0 && <span className="pf-empty-hint">No pinned colors</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="pf-panel-section">
            <button className="pf-fill-btn" onClick={() => fillSelected()} disabled={selectedPixels.size === 0}>
              ⚡ Fill Selected ({selectedPixels.size.toLocaleString()})
            </button>
            <button className="pf-clear-btn" onClick={() => setSelectedPixels(new Set())}>
              ✕ Clear Selection
            </button>
          </div>

          {/* Pixel RGBA info panel */}
          {hoverPixel && (
            <div className="pf-panel-section">
              <div className="pf-section-title">Pixel Info</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <div style={{ width:32, height:32, borderRadius:5, background: rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b), border:'1px solid #2d3748', flexShrink:0 }} />
                <div style={{ fontSize:10, color:'#94a3b8', lineHeight:'1.6' }}>
                  <div><span style={{ color:'#64748b' }}>xy </span>{hoverPixel.x}, {hoverPixel.y}</div>
                  <div><span style={{ color:'#64748b' }}>hex </span>{rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b)}</div>
                  <div><span style={{ color:'#64748b' }}>rgb </span>{hoverPixel.r}, {hoverPixel.g}, {hoverPixel.b}</div>
                  <div><span style={{ color:'#64748b' }}>α </span>{hoverPixel.a} ({Math.round(hoverPixel.a / 255 * 100)}%)</div>
                </div>
              </div>
              <button className="pf-micro-btn" style={{ width:'100%', textAlign:'center' }}
                onClick={() => setFillColor(rgbToHex(hoverPixel.r, hoverPixel.g, hoverPixel.b))}>
                Use this color
              </button>
            </div>
          )}

          {/* Export */}
          <div className="pf-panel-section">
            <div className="pf-section-title">Export</div>
            <div className="pf-export-row">
              <button className="pf-btn-sm" onClick={() => exportImage('png')}>PNG</button>
              <button className="pf-btn-sm" onClick={() => exportImage('jpg')}>JPEG</button>
            </div>
          </div>

          {/* Shortcuts */}
          <div className="pf-panel-section pf-shortcuts">
            <div className="pf-section-title">Shortcuts</div>
            {[
              ['B',        'Pencil'],
              ['E',        'Eraser'],
              ['S',        'Select'],
              ['M',        'Magic wand'],
              ['I',        'Eyedropper'],
              ['Space',    'Pan'],
              ['[ / ]',    'Brush size'],
              ['Scroll',   'Zoom'],
              ['F',        'Fill selection'],
              ['Ctrl+Z',   'Undo'],
              ['Ctrl+⇧Z', 'Redo'],
              ['Ctrl+A',   'Select all'],
              ['Ctrl+D',   'Deselect'],
              ['Dbl-click','Magic select'],
              ['Alt+drag', 'Deselect'],
            ].map(([k, v]) => (
              <div key={k} className="pf-shortcut-row"><kbd>{k}</kbd><span>{v}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

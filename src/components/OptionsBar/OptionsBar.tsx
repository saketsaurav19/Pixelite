import React from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/useStore';
import { hexToRgba, loadGoogleFont } from '../../utils/canvasUtils';
import { Z_INDEX } from '../../constants/zIndex';

const fallbackFont = {
  family: 'Noto Sans',
  category: 'sans-serif',
  variants: [{ id: '400', name: 'Regular 400', weight: '400', style: 'normal' }]
};
import { toolState } from '../../tools/toolState';
import ColorPicker from '../shared/ColorPicker';
import * as LucideIcons from 'lucide-react';
import { recalculateTextLayerBounds } from '../Canvas/Core/textUtils';
interface EditableValueProps {
  value: number;
  unit: string;
  onCommit: (val: number) => void;
}
const EditableValue: React.FC<EditableValueProps> = ({ value, unit, onCommit }) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempValue, setTempValue] = React.useState('');
  const setIsTyping = useStore(state => state.setIsTyping);
  React.useEffect(() => {
    if (isEditing) {
      setIsTyping(true);
    } else {
      setIsTyping(false);
    }
    return () => setIsTyping(false);
  }, [isEditing, setIsTyping]);
  if (isEditing) {
    return (
      <input
        type="text"
        className="value-input"
        autoFocus
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          setIsEditing(false);
          const val = unit === '%' ? parseFloat(tempValue) : parseInt(tempValue);
          if (!isNaN(val)) onCommit(val);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setIsEditing(false);
        }}
      />
    );
  }
  return (
    <span
      className="value-label"
      onDoubleClick={() => {
        setTempValue(value.toString());
        setIsEditing(true);
      }}
      title="Double-click to type exact value"
    >
      {value}{unit}
    </span>
  );
};

const parseColorString = (colorStr: string): { hex: string; opacity: number } => {
  if (!colorStr) return { hex: '#000000', opacity: 1 };
  
  const clean = colorStr.trim().toLowerCase();
  
  const rgbaMatch = clean.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const r = parseInt(rgbaMatch[1], 10);
    const g = parseInt(rgbaMatch[2], 10);
    const b = parseInt(rgbaMatch[3], 10);
    const opacity = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;
    
    const toHex = (c: number) => {
      const hex = Math.max(0, Math.min(255, c)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return {
      hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      opacity
    };
  }
  
  if (clean.startsWith('#')) {
    let hex = clean;
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    return { hex, opacity: 1 };
  }
  
  return { hex: '#000000', opacity: 1 };
};

// Loaded dynamically from src/utils/googleFonts

const FontOption: React.FC<{
  family: string;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ family, isSelected, onSelect }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    // Load a tiny subset containing ONLY the letters of the font name!
    const linkId = `google-font-subset-${family.replace(/\s+/g, '-').toLowerCase()}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&text=${encodeURIComponent(family)}&display=swap`;
      document.head.appendChild(link);
    }
  }, [family]);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        fontFamily: `"${family}", sans-serif`,
        padding: '8px 12px',
        cursor: 'pointer',
        fontSize: '13px',
        color: '#fff',
        background: isSelected ? '#333' : isHovered ? '#222' : 'transparent',
        transition: 'background 0.15s, padding-left 0.15s',
        paddingLeft: isHovered ? '16px' : '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '3px'
      }}
    >
      <span>{family}</span>
      <span style={{ fontSize: '11px', color: isHovered || isSelected ? '#aaa' : '#444', fontFamily: 'sans-serif' }}>Aa</span>
    </div>
  );
};

const OptionsBar: React.FC = () => {
  const {
    activeTool, brushSize, setBrushSize,
    strokeWidth, setStrokeWidth,
    brushColor, setBrushColor, primaryOpacity, setPrimaryOpacity,
    secondaryColor, setSecondaryColor, secondaryOpacity, setSecondaryOpacity,
    penMode, setPenMode, setVectorPaths, setActivePathIndex, setLassoPaths,
    recordHistory, addLayer, updateLayer,
    undo, redo, activeLayerId, removeLayer, duplicateLayer,
    zoom, setZoom,
    setSelectionRect, setIsInverseSelection, inverseSelection,
    selectionRect, lassoPaths,
    selectionTolerance, setSelectionTolerance,
    selectionContiguous, setSelectionContiguous,
    selectionMode, setSelectionMode,
    customPattern,
    toolStrength, setToolStrength,
    toolHardness, setToolHardness,
    polygonSides, setPolygonSides,
    starPoints, setStarPoints,
    starInnerRadius, setStarInnerRadius,
    cornerRadius, setCornerRadius,
    canvasRotation, setCanvasRotation,
    redEyePupilSize, setRedEyePupilSize,
    redEyeDarkenAmount, setRedEyeDarkenAmount,
    selectionFeather, setSelectionFeather,
    selectionAntiAlias, setSelectionAntiAlias,
    gradientType, setGradientType,
    healingSourceMode, setHealingSourceMode,
    patchMode, setPatchMode,
    contentAwareMoveMode, setContentAwareMoveMode,
    moveAutoSelect, setMoveAutoSelect,
    moveShowTransform, setMoveShowTransform,
    textFontFamily, setTextFontFamily,
    textFontWeight, setTextFontWeight,
    textFontStyle, setTextFontStyle,
    textAlign, setTextAlign,
    lights, updateLight, removeLight, addLight,
    activeLightId, setActiveLightId,
    ambientIntensity, setAmbientIntensity,
    ambientColor, setAmbientColor,
    lightingDepthScale, showLightSource, updateLighting,
    documentSize,
    transformMode, setTransformMode, layers,
    setIsWarpDialogOpen,
    brushPresets, customShapes, savedPatterns
  } = useStore();

  const [googleFonts, setGoogleFonts] = React.useState<any[]>([]);

  React.useEffect(() => {
    // Dynamically load Google Fonts catalog to keep initial bundle size minimal
    import('../../utils/googleFonts').then((module) => {
      setGoogleFonts(module.GOOGLE_FONTS_CATALOG);
    });
  }, []);

  const activeLayer = layers.find(l => l.id === activeLayerId);
  const isVector = activeLayer && (activeLayer.type === 'text' || activeLayer.type === 'shape');

  React.useEffect(() => {
    if (isVector && ['distort', 'perspective', 'warp'].includes(transformMode)) {
      setTransformMode('free');
    }
  }, [activeLayerId, isVector, transformMode, setTransformMode]);

  const fonts = googleFonts.length > 0 ? googleFonts : [fallbackFont];

  const [isFontDropdownOpen, setIsFontDropdownOpen] = React.useState(false);
  const [fontSearchQuery, setFontSearchQuery] = React.useState('');
  const fontButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const [fontButtonCoords, setFontButtonCoords] = React.useState<{ top: number; left: number } | null>(null);

  React.useEffect(() => {
    if (isFontDropdownOpen && fontButtonRef.current) {
      const rect = fontButtonRef.current.getBoundingClientRect();
      setFontButtonCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX
      });
    }
  }, [isFontDropdownOpen, textFontFamily]);

  React.useEffect(() => {
    if (!isFontDropdownOpen) return;
    const handleOutsideClick = () => {
      setIsFontDropdownOpen(false);
    };
    const handleScroll = () => {
      setIsFontDropdownOpen(false);
    };
    
    window.addEventListener('click', handleOutsideClick);
    const optionsBarEl = document.querySelector('.options-bar');
    if (optionsBarEl) {
      optionsBarEl.addEventListener('scroll', handleScroll);
    }

    return () => {
      window.removeEventListener('click', handleOutsideClick);
      if (optionsBarEl) {
        optionsBarEl.removeEventListener('scroll', handleScroll);
      }
    };
  }, [isFontDropdownOpen]);



  // Sync options bar controls with active text layer properties
  React.useEffect(() => {
    if (activeLayer && activeLayer.type === 'text') {
      if (activeLayer.fontFamily && activeLayer.fontFamily !== textFontFamily) {
        setTextFontFamily(activeLayer.fontFamily);
      }
      const targetWeight = activeLayer.fontWeight || 'normal';
      if (targetWeight !== textFontWeight) {
        setTextFontWeight(targetWeight);
      }
      const targetStyle = activeLayer.fontStyle || 'normal';
      if (targetStyle !== textFontStyle) {
        setTextFontStyle(targetStyle);
      }
      const targetAlign = activeLayer.textAlign || 'left';
      if (targetAlign !== textAlign) {
        setTextAlign(targetAlign as any);
      }
      if (activeLayer.fontSize && Math.round(activeLayer.fontSize / 2) !== brushSize) {
        setBrushSize(Math.round(activeLayer.fontSize / 2));
      }
      if (activeLayer.color) {
        const { hex, opacity } = parseColorString(activeLayer.color);
        if (hex !== brushColor) {
          setBrushColor(hex);
        }
        if (opacity !== primaryOpacity) {
          setPrimaryOpacity(opacity);
        }
      }
    }
  }, [activeLayerId, activeLayer?.fontFamily, activeLayer?.fontWeight, activeLayer?.fontStyle, activeLayer?.textAlign, activeLayer?.fontSize, activeLayer?.color]);

  // Sync options bar controls with active shape layer properties
  React.useEffect(() => {
    if (activeLayer && activeLayer.type === 'shape' && activeLayer.shapeData) {
      const { fill, stroke, strokeWidth: sw } = activeLayer.shapeData;
      if (fill && fill !== 'transparent' && fill !== 'none' && fill !== brushColor) {
        setBrushColor(fill);
      }
      if (stroke && stroke !== 'transparent' && stroke !== 'none' && stroke !== secondaryColor) {
        setSecondaryColor(stroke);
      }
      if (sw !== undefined && sw !== strokeWidth) {
        setStrokeWidth(sw);
      }
    }
  }, [activeLayerId, activeLayer?.shapeData?.fill, activeLayer?.shapeData?.stroke, activeLayer?.shapeData?.strokeWidth]);

  // Load selected Google Font dynamically
  React.useEffect(() => {
    if (textFontFamily) {
      loadGoogleFont(textFontFamily);
    }
  }, [textFontFamily]);

  const handleDeselect = () => {
    setSelectionRect(null);
    setLassoPaths([]);
    setIsInverseSelection(false);
    recordHistory('Deselect');
  };
  const brushLikeTools = ['brush', 'pencil', 'color_replacement', 'mixer_brush', 'clone', 'pattern_stamp', 'eraser', 'background_eraser', 'magic_eraser', 'history_brush', 'art_history_brush'];
  const textTools = ['text', 'vertical_text'];
  const shapeTools = ['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'];
  const penTools = ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'];
  const detailTools = ['blur', 'sharpen', 'smudge', 'dodge', 'burn', 'sponge', 'healing', 'healing_brush', 'patch', 'red_eye'];
  return (
    <div className="options-bar">
      <div className="tool-indicator">{activeTool.toUpperCase()}</div>
      <div className="options-divider" />
      {(['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool)) && (
        <>
          <div className="option-control">
            <label>Mode</label>
            <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
              {['path', 'shape'].map(m => (
                <button
                  key={m}
                  onClick={() => setPenMode(m as any)}
                  style={{
                    padding: '2px 10px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: penMode === m ? '#444' : 'transparent', color: penMode === m ? '#fff' : '#888'
                  }}
                >
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="options-divider" />
          {penMode === 'path' ? (
            <button
              className="premium-btn-sm"
              onClick={() => {
                const paths = useStore.getState().vectorPaths;
                if (paths.length > 0) {
                  const subdividedPaths = paths.map(path => {
                    if (!path.smooth || path.points.length < 3) return path.points;
                    const result: { x: number, y: number }[] = [];
                    const steps = 12; // High resolution for selection
                    const points = path.points;
                    const len = points.length;
                    for (let i = 0; i < (path.closed ? len : len - 1); i++) {
                      const p0 = points[(i - 1 + len) % len];
                      const p1 = points[i % len];
                      const p2 = points[(i + 1) % len];
                      const p3 = points[(i + 2) % len];
                      for (let t = 0; t < steps; t++) {
                        const u = t / steps;
                        const x = 0.5 * (
                          (2 * p1.x) +
                          (-p0.x + p2.x) * u +
                          (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u * u +
                          (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u * u * u
                        );
                        const y = 0.5 * (
                          (2 * p1.y) +
                          (-p0.y + p2.y) * u +
                          (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u * u +
                          (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u * u * u
                        );
                        result.push({ x, y });
                      }
                    }
                    if (!path.closed) result.push(points[len - 1]);
                    return result;
                  });
                  setLassoPaths(subdividedPaths);
                  setVectorPaths([]);
                  setActivePathIndex(null);
                  recordHistory('Make Selection from Path');
                }
              }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#0078d7', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Make Selection
            </button>
          ) : (
            <button
              className="premium-btn-sm"
              onClick={() => {
                const paths = useStore.getState().vectorPaths;
                if (paths.length > 0) {
                  paths.forEach(path => {
                    if (path.points.length > 2) {
                      addLayer({
                        name: 'Shape',
                        type: 'shape',
                        visible: true,
                        opacity: 1,
                        position: { x: 0, y: 0 },
                        shapeData: {
                          type: 'path',
                          points: [...path.points],
                          fill: hexToRgba(brushColor, primaryOpacity),
                          stroke: hexToRgba(secondaryColor, secondaryOpacity),
                          strokeWidth: strokeWidth,
                          smooth: path.smooth,
                          closed: path.closed
                        }
                      });
                    }
                  });
                  setVectorPaths([]);
                  setActivePathIndex(null);
                  recordHistory('Create Shape from Pen');
                }
              }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#a051ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Create Shape
            </button>
          )}
          <button
            className="premium-btn-sm"
            onClick={() => {
              setVectorPaths([]);
              setActivePathIndex(null);
            }}
            style={{ padding: '4px 12px', fontSize: '11px', background: 'transparent', color: '#888', border: '1px solid #444', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
          >
            Clear
          </button>
          <div className="options-divider" />
        </>
      )}
      {(activeTool === 'marquee' || activeTool === 'ellipse_marquee' || activeTool === 'lasso' || activeTool === 'polygonal_lasso' || activeTool === 'magnetic_lasso' || activeTool === 'magic_wand' || activeTool === 'quick_selection' || activeTool === 'object_selection') && (
        <>
          <div className="option-control">
            <label>Mode</label>
            <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
              {[
                { id: 'new', icon: LucideIcons.Square, label: 'New' },
                { id: 'add', icon: LucideIcons.PlusSquare, label: 'Add' },
                { id: 'subtract', icon: LucideIcons.MinusSquare, label: 'Subtract' },
                { id: 'intersect', icon: LucideIcons.Layers, label: 'Intersect' }
              ].map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectionMode(m.id as any)}
                  title={m.label}
                  style={{
                    padding: '4px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: selectionMode === m.id ? '#444' : 'transparent', color: selectionMode === m.id ? '#fff' : '#888',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <m.icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="options-divider" />
          <div className="option-control">
            <label>Feather</label>
            <EditableValue value={selectionFeather} unit="px" onCommit={setSelectionFeather} />
          </div>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectionAntiAlias}
                onChange={(e) => setSelectionAntiAlias(e.target.checked)}
              />
              Anti-alias
            </label>
          </div>
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'artboard' && (
        <>
          <div className="option-control">
            <label>Preset</label>
            <select
              style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '2px', width: '110px' }}
              onChange={(e) => {
                if (!e.target.value) return;
                const [w, h] = e.target.value.split('x').map(Number);
                if (activeLayerId) {
                   const artboard = useStore.getState().layers.find(l => l.id === activeLayerId);
                   if (artboard && artboard.type === 'artboard') {
                       updateLayer(activeLayerId, { width: w, height: h });
                       recordHistory('Resize Artboard');
                   }
                } else {
                   // If no artboard selected, we might want to store pending sizes, but we'll leave it as apply to active for now
                }
              }}
              value=""
            >
              <option value="">Presets...</option>
              <option value="390x844">iPhone 14 (390x844)</option>
              <option value="1080x1920">Instagram Story (1080x1920)</option>
              <option value="1920x1080">1080p (1920x1080)</option>
              <option value="1440x900">MacBook (1440x900)</option>
              <option value="595x842">A4 Print (595x842)</option>
            </select>
          </div>
          {activeLayerId && (() => {
             const artboard = useStore.getState().layers.find(l => l.id === activeLayerId);
             if (artboard && artboard.type === 'artboard') {
                 return (
                   <>
                     <div className="options-divider" />
                     <div className="option-control" style={{ gap: '2px' }}>
                       <label>W:</label>
                       <EditableValue value={artboard.width || 0} unit="" onCommit={(val) => updateLayer(activeLayerId, { width: val })} />
                     </div>
                     <div className="option-control" style={{ gap: '2px' }}>
                       <label>H:</label>
                       <EditableValue value={artboard.height || 0} unit="" onCommit={(val) => updateLayer(activeLayerId, { height: val })} />
                     </div>
                   </>
                 );
             }
             return null;
          })()}
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'move' && (
        <>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={moveAutoSelect}
                onChange={(e) => setMoveAutoSelect(e.target.checked)}
              />
              Auto-Select
            </label>
          </div>
          <div className="option-control">
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={moveShowTransform}
                onChange={(e) => setMoveShowTransform(e.target.checked)}
              />
              Show Transform Controls
            </label>
          </div>
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'transform' && (
        <>
          <div className="option-control">
            <label style={{ marginRight: '6px' }}>Mode:</label>
            <select
              value={transformMode}
              onChange={(e) => setTransformMode(e.target.value as any)}
              style={{
                background: '#2b2b2b',
                color: '#fff',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="free">Free Transform</option>
              <option value="scale">Scale</option>
              <option value="rotate">Rotate</option>
              <option value="skew">Skew</option>
              <option value="distort" disabled={!!isVector}>Distort</option>
              <option value="perspective" disabled={!!isVector}>Perspective</option>
              <option value="warp" disabled={!!isVector}>Warp</option>
            </select>
          </div>

          {(() => {
            const activeLayer = layers.find(l => l.id === activeLayerId);
            if (!activeLayer) return null;
            
            const px = Math.round(activeLayer.position?.x || 0);
            const py = Math.round(activeLayer.position?.y || 0);
            const wVal = Math.round(activeLayer.width || 0);
            const hVal = Math.round(activeLayer.height || 0);
            const rotVal = Math.round(activeLayer.rotation || 0);

            const handlePropChange = (field: string, val: number) => {
              if (field === 'x') {
                updateLayer(activeLayerId, { position: { x: val, y: activeLayer.position?.y || 0 } });
              } else if (field === 'y') {
                updateLayer(activeLayerId, { position: { x: activeLayer.position?.x || 0, y: val } });
              } else if (field === 'w') {
                updateLayer(activeLayerId, { width: val });
              } else if (field === 'h') {
                updateLayer(activeLayerId, { height: val });
              } else if (field === 'rot') {
                updateLayer(activeLayerId, { rotation: val });
              }
            };

            const inputStyle = {
              background: '#2b2b2b',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '2px 6px',
              width: '60px',
              fontSize: '12px',
              textAlign: 'center' as const
            };

            return (
              <>
                <div className="options-divider" />
                <div className="option-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>X:</span>
                  <input
                    type="number"
                    value={px}
                    onChange={(e) => handlePropChange('x', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>px</span>
                </div>
                <div className="option-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>Y:</span>
                  <input
                    type="number"
                    value={py}
                    onChange={(e) => handlePropChange('y', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>px</span>
                </div>
                <div className="options-divider" />
                <div className="option-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>W:</span>
                  <input
                    type="number"
                    value={wVal}
                    onChange={(e) => handlePropChange('w', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>px</span>
                </div>
                <div className="option-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>H:</span>
                  <input
                    type="number"
                    value={hVal}
                    onChange={(e) => handlePropChange('h', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>px</span>
                </div>
                <div className="options-divider" />
                <div className="option-control" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#aaa' }}>Angle:</span>
                  <input
                    type="number"
                    value={rotVal}
                    onChange={(e) => handlePropChange('rot', parseInt(e.target.value) || 0)}
                    style={inputStyle}
                  />
                  <span style={{ fontSize: '11px', color: '#aaa' }}>°</span>
                </div>
              </>
            );
          })()}
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'color_sampler' && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => { useStore.getState().clearColorSamplers(); recordHistory('Clear Samplers'); }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Samplers
            </button>
            <div style={{ marginLeft: '12px', display: 'flex', gap: '8px' }}>
              {useStore.getState().colorSamplers.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#1a1a1a', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>
                  <span style={{ color: '#888' }}>{s.id}:</span>
                  <div style={{ width: '8px', height: '8px', background: s.color, border: '1px solid #444' }} />
                  <span>{s.color.toUpperCase()}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'ruler' && (
        <>
          <div className="option-control">
            {useStore.getState().rulerData ? (
              (() => {
                const { start, end } = useStore.getState().rulerData!;
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
                const angle = (Math.atan2(dy, dx) * 180 / Math.PI).toFixed(1);
                return (
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#ccc' }}>
                    <span>L1: {dist}px</span>
                    <span>A: {angle}°</span>
                    <span>ΔX: {dx.toFixed(1)}</span>
                    <span>ΔY: {dy.toFixed(1)}</span>
                  </div>
                );
              })()
            ) : (
              <span style={{ fontSize: '11px', color: '#666' }}>Drag to measure</span>
            )}
          </div>
          <div className="options-divider" />
        </>
      )}
      {(activeTool === 'slice' || activeTool === 'slice_select') && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => { useStore.getState().clearSlices(); recordHistory('Clear Slices'); }}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Clear Slices
            </button>
            {activeTool === 'slice_select' && toolState._sliceLastClickedIdx !== undefined && (
              <button
                className="premium-btn-sm"
                onClick={() => {
                  const idx = toolState._sliceLastClickedIdx;
                  const slices = [...useStore.getState().slices];
                  slices.splice(idx, 1);
                  useStore.getState().setSlices(slices);
                  delete toolState._sliceLastClickedIdx;
                  recordHistory('Delete Slice');
                }}
                style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
              >
                Delete Slice
              </button>
            )}
          </div>
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'crop' && (
        <>
          <div className="option-control">
            <button
              className="premium-btn-sm"
              onClick={() => window.dispatchEvent(new CustomEvent('crop-fit-doc'))}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Fit Document
            </button>
            <button
              className="premium-btn-sm"
              onClick={() => window.dispatchEvent(new CustomEvent('crop-fit-layer'))}
              style={{ padding: '4px 12px', fontSize: '11px', background: '#444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginLeft: '8px' }}
              disabled={!activeLayerId}
            >
              Fit Layer
            </button>
          </div>
          <div className="options-divider" />
        </>
      )}
      {(activeTool === 'magic_wand' || activeTool === 'quick_selection' || activeTool === 'object_selection' || activeTool === 'paint_bucket' || activeTool === 'magic_eraser') && (
        <>
          <div className="option-control">
            <label>Tolerance</label>
            <input
              type="range" min="1" max="255"
              value={selectionTolerance}
              onChange={(e) => setSelectionTolerance(parseInt(e.target.value))}
            />
            <EditableValue value={selectionTolerance} unit="" onCommit={setSelectionTolerance} />
          </div>
          {(activeTool === 'magic_wand' || activeTool === 'paint_bucket' || activeTool === 'magic_eraser') && (
            <div className="option-control">
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={selectionContiguous}
                  onChange={(e) => setSelectionContiguous(e.target.checked)}
                />
                Contiguous
              </label>
            </div>
          )}
          <div className="options-divider" />
        </>
      )}

      {activeTool === 'lighting' && (
        <>
          <div className="options-divider" />

          <div className="option-control">
            <label>Lights</label>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                className="action-btn-circle"
                onClick={() => addLight({
                  type: 'point',
                  position: { x: documentSize.w / 2, y: documentSize.h / 2, z: 400 },
                  intensity: 1.0,
                  color: '#ffffff',
                  radius: 500,
                  falloff: 'quadratic',
                  visible: true
                })}
                title="Add New Light Source"
              >
                <LucideIcons.Plus size={14} />
              </button>
              <select
                className="premium-select"
                style={{ width: '120px' }}
                value={activeLightId || ''}
                onChange={(e) => setActiveLightId(e.target.value || null)}
              >
                <option value="">Select Light</option>
                <option value="ambient">Ambient Light</option>
                {lights.map((l, i) => (
                  <option key={l.id} value={l.id}>{l.name || `Light ${i + 1}`}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="option-control">
            <label title="Strength of the 3D depth effect">Depth Scale</label>
            <input
              type="range" min="0" max="1000" step="10"
              value={lightingDepthScale || 200}
              onChange={(e) => updateLighting({ lightingDepthScale: parseInt(e.target.value) })}
              style={{ width: '80px' }}
            />
            <span className="value-label">{(lightingDepthScale || 200)}px</span>
          </div>

          <div className="option-control" style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
            <label htmlFor="show-source-toggle" style={{ marginRight: '6px', fontSize: '11px', whiteSpace: 'nowrap' }}>Show Source</label>
            <input
              id="show-source-toggle"
              type="checkbox"
              checked={showLightSource ?? true}
              onChange={(e) => updateLighting({ showLightSource: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
          </div>

          {activeLightId && (() => {
            if (activeLightId === 'ambient') {
              return (
                <>
                  <div className="options-divider" />
                  <div className="option-control">
                    <label>Ambient Int.</label>
                    <input
                      type="range" min="0" max="1" step="0.01"
                      value={ambientIntensity}
                      onChange={(e) => setAmbientIntensity(parseFloat(e.target.value))}
                      style={{ width: '100px' }}
                    />
                    <span className="value-label">{Math.round(ambientIntensity * 100)}%</span>
                  </div>
                  <div className="option-control">
                    <ColorPicker
                      label="Ambient Color"
                      color={ambientColor || '#ffffff'}
                      opacity={1}
                      onColorChange={(color) => setAmbientColor(color)}
                      onOpacityChange={() => { }}
                    />
                  </div>
                </>
              );
            }

            const activeLight = lights.find(l => l.id === activeLightId);
            if (!activeLight) return null;
            return (
              <>
                <div className="options-divider" />
                <div className="option-control">
                  <label>Type</label>
                  <select
                    className="premium-select"
                    style={{ width: '80px', height: '24px', fontSize: '11px' }}
                    value={activeLight.type}
                    onChange={(e) => updateLight(activeLight.id, { type: e.target.value as any })}
                  >
                    <option value="point">Point</option>
                    <option value="spot">Spot</option>
                    <option value="area">Area</option>
                  </select>
                </div>
                <div className="option-control">
                  <label>Name</label>
                  <input
                    type="text"
                    className="premium-input"
                    style={{ width: '80px', height: '24px', fontSize: '11px' }}
                    value={activeLight.name || ''}
                    onFocus={() => useStore.getState().setIsTyping(true)}
                    onBlur={() => useStore.getState().setIsTyping(false)}
                    onChange={(e) => updateLight(activeLight.id, { name: e.target.value })}
                  />
                </div>
                <div className="option-control">
                  <label>Distance</label>
                  <input
                    type="range" min="0" max="1000" step="10"
                    value={activeLight.distance ?? 500}
                    onChange={(e) => updateLight(activeLight.id, { distance: parseInt(e.target.value) })}
                    title="Adjust light depth from behind to front of subject"
                  />
                  <EditableValue
                    value={activeLight.distance ?? 500}
                    unit=""
                    onCommit={(val) => updateLight(activeLight.id, { distance: val })}
                  />
                </div>
                <div className="option-control">
                  <label>Power</label>
                  <input
                    type="range" min="0" max="10" step="0.1"
                    value={activeLight.intensity}
                    onChange={(e) => updateLight(activeLight.id, { intensity: parseFloat(e.target.value) })}
                  />
                  <EditableValue
                    value={activeLight.intensity}
                    unit=""
                    onCommit={(val) => updateLight(activeLight.id, { intensity: val })}
                  />
                </div>
                <div className="option-control">
                  <label>Radius</label>
                  <input
                    type="range" min="50" max="5000" step="10"
                    value={activeLight.radius}
                    onChange={(e) => updateLight(activeLight.id, { radius: parseInt(e.target.value) })}
                    title="Size of the light's illumination area"
                  />
                  <EditableValue
                    value={activeLight.radius}
                    unit="px"
                    onCommit={(val) => updateLight(activeLight.id, { radius: val })}
                  />
                </div>
                <div className="options-divider" />
                <ColorPicker
                  label="Color"
                  color={activeLight.color}
                  opacity={1}
                  onColorChange={(color) => updateLight(activeLight.id, { color })}
                  onOpacityChange={() => { }}
                />
                <button
                  className="action-btn delete-btn"
                  style={{ marginLeft: '8px' }}
                  onClick={() => removeLight(activeLight.id)}
                >
                  <LucideIcons.Trash2 size={14} />
                </button>
              </>
            );
          })()}

        </>
      )}
      {activeTool === 'zoom_tool' && (
        <>
          <div className="option-control">
            <label>Zoom</label>
            <input
              type="range" min="0.1" max="10" step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
            <EditableValue value={Math.round(zoom * 100)} unit="%" onCommit={(val) => setZoom(val / 100)} />
          </div>
          <button className="option-btn" onClick={() => setZoom(1)}>100%</button>
          <button className="option-btn" onClick={() => window.dispatchEvent(new CustomEvent('zoom-fit'))} style={{ marginLeft: '8px' }}>Fit Screen</button>
          <div className="options-divider" />
        </>
      )}
      {activeTool === 'pattern_stamp' && (
        <div className="option-control">
          <button
            className="action-button secondary"
            onClick={() => document.getElementById('pattern-upload')?.click()}
            title="Upload a custom image or SVG as a texture"
          >
            Load Texture
          </button>
          {customPattern && (
            <div className="pattern-preview" title="Current custom pattern">
              <img src={customPattern} alt="Custom pattern" />
            </div>
          )}
          <input
            id="pattern-upload"
            type="file"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  useStore.getState().setCustomPattern(event.target?.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
        </div>
      )}
      {activeTool === 'pattern_stamp' && savedPatterns.length > 0 && (
        <div className="option-control">
          <label>Saved</label>
          <select
            className="preset-select"
            onChange={(e) => {
              const pattern = savedPatterns.find(p => p.id === e.target.value);
              if (pattern) {
                useStore.getState().setCustomPattern(pattern.dataUrl);
              }
              e.target.value = '';
            }}
            value=""
          >
            <option value="" disabled>Select pattern...</option>
            {savedPatterns.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      {activeTool === 'marquee' && selectionRect && (
        <div className="option-control">
          <button
            className="action-button primary"
            onClick={() => window.dispatchEvent(new CustomEvent('define-pattern'))}
            title="Use selection as a repeating pattern"
          >
            Define Pattern
          </button>
        </div>
      )}
      {activeTool === 'polygon_shape' && (
        <div className="option-control">
          <label>Sides</label>
          <input
            type="range" min="3" max="20"
            value={polygonSides}
            onChange={(e) => setPolygonSides(parseInt(e.target.value))}
          />
          <EditableValue value={polygonSides} unit="" onCommit={setPolygonSides} />
        </div>
      )}
      {activeTool === 'custom_shape' && customShapes.length > 0 && (
        <div className="option-control">
          <label>Shape</label>
          <select
            className="preset-select"
            onChange={(e) => {
              const shape = customShapes.find(s => s.id === e.target.value);
              if (shape) {
                window.dispatchEvent(new CustomEvent('apply-custom-shape', { detail: shape.shapeData }));
              }
              e.target.value = '';
            }}
            value=""
          >
            <option value="" disabled>Select shape...</option>
            {customShapes.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {activeTool === 'custom_shape' && (
        <>
          <div className="option-control">
            <label>Points</label>
            <input
              type="range" min="3" max="20"
              value={starPoints}
              onChange={(e) => setStarPoints(parseInt(e.target.value))}
            />
            <EditableValue value={starPoints} unit="" onCommit={setStarPoints} />
          </div>
          <div className="option-control">
            <label>Inner Radius</label>
            <input
              type="range" min="5" max="95"
              value={starInnerRadius}
              onChange={(e) => setStarInnerRadius(parseInt(e.target.value))}
            />
            <EditableValue value={starInnerRadius} unit="%" onCommit={setStarInnerRadius} />
          </div>
        </>
      )}
      {(activeTool === 'shape' || activeTool === 'triangle_shape') && (
        <div className="option-control">
          <label>Radius</label>
          <input
            type="range" min="0" max="100"
            value={cornerRadius}
            onChange={(e) => setCornerRadius(parseInt(e.target.value))}
          />
          <EditableValue value={cornerRadius} unit="px" onCommit={setCornerRadius} />
        </div>
      )}
      {activeTool === 'ellipse_shape' && (
        <div className="option-control">
          <span style={{ fontSize: '11px', color: '#888' }}>Drag to draw ellipse</span>
        </div>
      )}
      {activeTool === 'rotate_view' && (
        <>
          <div className="option-control">
            <label>Rotation</label>
            <input
              type="range" min="-180" max="180"
              value={canvasRotation}
              onChange={(e) => setCanvasRotation(parseInt(e.target.value))}
            />
            <EditableValue value={Math.round(canvasRotation)} unit="°" onCommit={setCanvasRotation} />
          </div>
          <button
            className="option-btn"
            onClick={() => setCanvasRotation(0)}
            style={{ marginLeft: '10px', padding: '4px 12px' }}
          >
            Reset View
          </button>
        </>
      )}
      {activeTool === 'hand' && (
        <button
          className="option-btn"
          onClick={() => {
            useStore.getState().setCanvasOffset({ x: 0, y: 0 });
            useStore.getState().setZoom(1);
          }}
          style={{ padding: '4px 12px' }}
        >
          Reset View & Zoom
        </button>
      )}
      {activeTool === 'gradient' && (
        <div className="option-control">
          <label>Type</label>
          <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
            {[
              { id: 'linear', icon: LucideIcons.ArrowRight, label: 'Linear' },
              { id: 'radial', icon: LucideIcons.Circle, label: 'Radial' },
              { id: 'angle', icon: LucideIcons.RotateCw, label: 'Angle' },
              { id: 'reflected', icon: LucideIcons.Spline, label: 'Reflected' },
              { id: 'diamond', icon: LucideIcons.Diamond, label: 'Diamond' }
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setGradientType(m.id as any)}
                title={m.label}
                style={{
                  padding: '4px', fontSize: '11px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                  background: gradientType === m.id ? '#444' : 'transparent', color: gradientType === m.id ? '#fff' : '#888',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <m.icon size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
      {(activeTool === 'healing_brush' || activeTool === 'patch' || activeTool === 'content_aware_move') && (
        <>
          {activeTool === 'healing_brush' && (
            <div className="option-control">
              <label>Source</label>
              <select value={healingSourceMode} onChange={(e) => setHealingSourceMode(e.target.value as any)} className="premium-select">
                <option value="sampled">Sampled</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>
          )}
          {activeTool === 'patch' && (
            <div className="option-control">
              <label>Patch</label>
              <select value={patchMode} onChange={(e) => setPatchMode(e.target.value as any)} className="premium-select">
                <option value="source">Source</option>
                <option value="destination">Destination</option>
              </select>
            </div>
          )}
          {activeTool === 'content_aware_move' && (
            <div className="option-control">
              <label>Mode</label>
              <select value={contentAwareMoveMode} onChange={(e) => setContentAwareMoveMode(e.target.value as any)} className="premium-select">
                <option value="move">Move</option>
                <option value="extend">Extend</option>
              </select>
            </div>
          )}
          <div className="options-divider" />
        </>
      )}
      {(activeTool === 'text' || activeTool === 'vertical_text') && (() => {
        const selectedFamilyData = fonts.find(f => f.family.toLowerCase() === textFontFamily.toLowerCase()) || fonts[0];
        const nonItalicVariants = selectedFamilyData.variants.filter(v => v.style !== 'italic');
        const activeVariantId = nonItalicVariants.find(v => v.weight === textFontWeight)?.id || nonItalicVariants[0]?.id || '400';

        return (
          <>
            <div className="option-control">
              <label>Family</label>
              <button
                ref={fontButtonRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFontDropdownOpen(!isFontDropdownOpen);
                }}
                className="premium-select"
                style={{
                  width: '145px',
                  textAlign: 'left',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{textFontFamily}</span>
                <LucideIcons.ChevronDown size={14} style={{ color: '#888', marginLeft: '4px', flexShrink: 0 }} />
              </button>

              {isFontDropdownOpen && fontButtonCoords && createPortal((() => {
                const query = fontSearchQuery.toLowerCase().trim();
                const filtered = !query ? fonts : fonts.filter(f => f.family.toLowerCase().includes(query));
                const visibleFonts = filtered.slice(0, 80);

                return (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: `${fontButtonCoords.top}px`,
                      left: `${fontButtonCoords.left}px`,
                      width: '260px',
                      maxHeight: '350px',
                      background: '#141414',
                      border: '1px solid #333',
                      borderRadius: '6px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
                      zIndex: Z_INDEX.fontDropdown,
                      marginTop: '4px',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    <div style={{ padding: '8px', borderBottom: '1px solid #222', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <LucideIcons.Search size={14} style={{ color: '#666', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search 1500+ fonts..."
                        value={fontSearchQuery}
                        onChange={(e) => setFontSearchQuery(e.target.value)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          fontSize: '12px',
                          outline: 'none',
                          width: '100%'
                        }}
                        autoFocus
                      />
                    </div>
                    <div
                      style={{
                        overflowY: 'auto',
                        flex: 1,
                        maxHeight: '280px',
                        padding: '4px'
                      }}
                    >
                      {visibleFonts.length === 0 ? (
                        <div style={{ padding: '12px', color: '#666', fontSize: '12px', textAlign: 'center' }}>No fonts found</div>
                      ) : (
                        visibleFonts.map(f => (
                          <FontOption
                            key={f.family}
                            family={f.family}
                            isSelected={f.family === textFontFamily}
                            onSelect={() => {
                              const val = f.family;
                              setTextFontFamily(val);
                              loadGoogleFont(val);
                              
                              const defaultVariant = f.variants.find(v => v.style !== 'italic') || f.variants[0];
                              if (defaultVariant) {
                                setTextFontWeight(defaultVariant.weight);
                                setTextFontStyle(defaultVariant.style);
                              }

                              if (activeLayer && activeLayer.type === 'text') {
                                const targetFamily = val;
                                const targetWeight = defaultVariant ? defaultVariant.weight : (activeLayer.fontWeight || 'normal');
                                const targetStyle = defaultVariant ? defaultVariant.style : (activeLayer.fontStyle || 'normal');
                                const targetSize = activeLayer.fontSize || 40;
                                const bounds = recalculateTextLayerBounds(
                                  activeLayer,
                                  targetFamily,
                                  targetSize,
                                  targetWeight,
                                  targetStyle
                                );
                                const updates: any = {
                                  fontFamily: targetFamily,
                                  fontWeight: targetWeight,
                                  fontStyle: targetStyle,
                                  ...bounds
                                };
                                updateLayer(activeLayer.id, updates);
                                recordHistory('Change Font Family');
                              }
                              setIsFontDropdownOpen(false);
                            }}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })(), document.body)}
            </div>
            <div className="option-control">
              <label>Style</label>
              <select
                value={activeVariantId}
                onChange={(e) => {
                  const variant = selectedFamilyData.variants.find(v => v.id === e.target.value);
                  if (variant) {
                    setTextFontWeight(variant.weight);
                    setTextFontStyle(variant.style);
                    if (activeLayer && activeLayer.type === 'text') {
                      const bounds = recalculateTextLayerBounds(
                        activeLayer,
                        activeLayer.fontFamily || textFontFamily,
                        activeLayer.fontSize || 40,
                        variant.weight,
                        variant.style
                      );
                      updateLayer(activeLayer.id, {
                        fontWeight: variant.weight,
                        fontStyle: variant.style as any,
                        ...bounds
                      });
                      recordHistory('Change Font Style');
                    }
                  }
                }}
                className="premium-select"
                style={{ width: '110px' }}
              >
                {nonItalicVariants.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="option-control">
              <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px', gap: '2px' }}>
                <button
                  onClick={() => {
                    const nextWeight = textFontWeight === 'bold' ? 'normal' : 'bold';
                    setTextFontWeight(nextWeight);
                    if (activeLayer && activeLayer.type === 'text') {
                      const bounds = recalculateTextLayerBounds(
                        activeLayer,
                        activeLayer.fontFamily || textFontFamily,
                        activeLayer.fontSize || 40,
                        nextWeight,
                        activeLayer.fontStyle || 'normal'
                      );
                      updateLayer(activeLayer.id, {
                        fontWeight: nextWeight,
                        ...bounds
                      });
                      recordHistory('Toggle Bold');
                    }
                  }}
                  title="Bold"
                  style={{
                    padding: '4px 8px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                    background: textFontWeight === 'bold' ? '#444' : 'transparent', color: textFontWeight === 'bold' ? '#fff' : '#888',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <LucideIcons.Bold size={13} />
                </button>
              </div>
            </div>
            <div className="option-control">
              <div className="segmented-control" style={{ display: 'flex', background: '#1a1a1a', borderRadius: '4px', padding: '2px' }}>
                {[
                  { id: 'left', icon: LucideIcons.AlignLeft },
                  { id: 'center', icon: LucideIcons.AlignCenter },
                  { id: 'right', icon: LucideIcons.AlignRight }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      const val = m.id as any;
                      setTextAlign(val);
                      if (activeLayer && activeLayer.type === 'text') {
                        updateLayer(activeLayer.id, { textAlign: val });
                        recordHistory('Change Text Alignment');
                      }
                    }}
                    style={{
                      padding: '4px', border: 'none', borderRadius: '3px', cursor: 'pointer',
                      background: textAlign === m.id ? '#444' : 'transparent', color: textAlign === m.id ? '#fff' : '#888'
                    }}
                  >
                    <m.icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div className="option-control">
              <button
                className="premium-btn-sm"
                disabled={!activeLayer || activeLayer.type !== 'text'}
                onClick={() => setIsWarpDialogOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  background: '#1a1a1a',
                  border: '1px solid #444',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  opacity: (!activeLayer || activeLayer.type !== 'text') ? 0.5 : 1
                }}
                title="Warp Text"
              >
                <span style={{ fontSize: '12px', transform: 'skewX(-10deg)', display: 'inline-block', fontWeight: 'bold' }}>T</span>
                <span>Warp</span>
              </button>
            </div>
            <div className="options-divider" />
          </>
        );
      })()}
      {activeTool === 'red_eye' && (
        <>
          <div className="option-control">
            <label>Pupil Size</label>
            <input
              type="range" min="1" max="100"
              value={redEyePupilSize}
              onChange={(e) => setRedEyePupilSize(parseInt(e.target.value))}
            />
            <EditableValue value={redEyePupilSize} unit="%" onCommit={setRedEyePupilSize} />
          </div>
          <div className="option-control">
            <label>Darken Amount</label>
            <input
              type="range" min="1" max="100"
              value={redEyeDarkenAmount}
              onChange={(e) => setRedEyeDarkenAmount(parseInt(e.target.value))}
            />
            <EditableValue value={redEyeDarkenAmount} unit="%" onCommit={setRedEyeDarkenAmount} />
          </div>
          <div className="options-divider" />
        </>
      )}
      {brushLikeTools.includes(activeTool) && brushPresets.length > 0 && (
        <div className="option-control">
          <label>Preset</label>
          <select
            className="preset-select"
            onChange={(e) => {
              const preset = brushPresets.find(p => p.id === e.target.value);
              if (preset) {
                setBrushSize(preset.size);
                setBrushColor(preset.color);
                setToolHardness(preset.hardness);
                setPrimaryOpacity(preset.opacity);
              }
              e.target.value = '';
            }}
            value=""
          >
            <option value="" disabled>Select preset...</option>
            {brushPresets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}
      {(brushLikeTools.includes(activeTool) || textTools.includes(activeTool) || shapeTools.includes(activeTool) || activeTool === 'quick_selection' || detailTools.includes(activeTool) || penTools.includes(activeTool)) && (
        <>
          <div className="option-control">
            <label>
              {(activeTool === 'text' || activeTool === 'vertical_text') ? 'Font Size' : 'Size'}
            </label>
            <input
              type="range"
              min="1"
              max={(activeTool === 'text' || activeTool === 'vertical_text') ? "500" : "500"}
              value={brushSize}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setBrushSize(val);
                if (activeLayer && activeLayer.type === 'text') {
                  const targetSize = val * 2;
                  const bounds = recalculateTextLayerBounds(
                    activeLayer,
                    activeLayer.fontFamily || textFontFamily,
                    targetSize,
                    activeLayer.fontWeight || 'normal',
                    activeLayer.fontStyle || 'normal'
                  );
                  updateLayer(activeLayer.id, {
                    fontSize: targetSize,
                    ...bounds
                  });
                  recordHistory('Change Font Size');
                }
              }}
            />
            <EditableValue
              value={brushSize}
              unit="px"
              onCommit={(val) => {
                setBrushSize(val);
                if (activeLayer && activeLayer.type === 'text') {
                  const targetSize = val * 2;
                  const bounds = recalculateTextLayerBounds(
                    activeLayer,
                    activeLayer.fontFamily || textFontFamily,
                    targetSize,
                    activeLayer.fontWeight || 'normal',
                    activeLayer.fontStyle || 'normal'
                  );
                  updateLayer(activeLayer.id, {
                    fontSize: targetSize,
                    ...bounds
                  });
                  recordHistory('Change Font Size');
                }
              }}
            />
          </div>
          {(activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'blur' || activeTool === 'sharpen' || activeTool === 'smudge' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sponge' || activeTool === 'clone' || activeTool === 'history_brush') && (
            <div className="option-control">
              <label>Hardness</label>
              <input
                type="range" min="0" max="100"
                value={toolHardness}
                onChange={(e) => setToolHardness(parseInt(e.target.value))}
              />
              <EditableValue value={toolHardness} unit="%" onCommit={setToolHardness} />
            </div>
          )}
          {(activeTool === 'blur' || activeTool === 'sharpen' || activeTool === 'smudge' || activeTool === 'dodge' || activeTool === 'burn' || activeTool === 'sponge' || activeTool === 'healing_brush') && (
            <div className="option-control">
              <label>Strength</label>
              <input
                type="range" min="1" max="100"
                value={toolStrength}
                onChange={(e) => setToolStrength(parseInt(e.target.value))}
              />
              <EditableValue value={toolStrength} unit="%" onCommit={setToolStrength} />
            </div>
          )}
          {(activeTool === 'dodge' || activeTool === 'burn') && (
            <div className="option-control">
              <label>Range</label>
              <select
                value={useStore.getState().toningRange}
                onChange={(e) => useStore.getState().setToningRange(e.target.value as any)}
                style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '2px' }}
              >
                <option value="shadows">Shadows</option>
                <option value="midtones">Midtones</option>
                <option value="highlights">Highlights</option>
              </select>
            </div>
          )}
          {activeTool === 'sponge' && (
            <div className="option-control">
              <label>Mode</label>
              <select
                value={useStore.getState().spongeMode}
                onChange={(e) => useStore.getState().setSpongeMode(e.target.value as any)}
                style={{ background: '#1a1a1a', color: '#ccc', border: '1px solid #444', borderRadius: '3px', fontSize: '11px', padding: '2px' }}
              >
                <option value="desaturate">Desaturate</option>
                <option value="saturate">Saturate</option>
              </select>
            </div>
          )}
        </>
      )}
      {(shapeTools.includes(activeTool) || penTools.includes(activeTool)) && (
        <div className="option-control">
          <label>Stroke Width</label>
          <input
            type="range"
            min="0"
            max="50"
            value={strokeWidth}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setStrokeWidth(val);
              if (activeLayer && activeLayer.type === 'shape' && activeLayer.shapeData) {
                updateLayer(activeLayer.id, {
                  shapeData: {
                    ...activeLayer.shapeData,
                    strokeWidth: val
                  }
                });
                recordHistory('Change Stroke Width');
              }
            }}
          />
          <EditableValue
            value={strokeWidth}
            unit="px"
            onCommit={(val) => {
              setStrokeWidth(val);
              if (activeLayer && activeLayer.type === 'shape' && activeLayer.shapeData) {
                updateLayer(activeLayer.id, {
                  shapeData: {
                    ...activeLayer.shapeData,
                    strokeWidth: val
                  }
                });
                recordHistory('Change Stroke Width');
              }
            }}
          />
        </div>
      )}
      {(brushLikeTools.includes(activeTool) || textTools.includes(activeTool) || shapeTools.includes(activeTool) || activeTool === 'eyedropper' || penTools.includes(activeTool)) && (
        <ColorPicker
          label={['shape', 'ellipse_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool as string) ? 'Fill' : (activeTool === 'eyedropper' ? 'Sampled' : 'Color')}
          color={brushColor}
          opacity={primaryOpacity}
          onColorChange={(color) => {
            setBrushColor(color);
            if (activeLayer && activeLayer.type === 'text') {
              updateLayer(activeLayer.id, { color: hexToRgba(color, primaryOpacity) });
              recordHistory('Change Text Color');
            } else if (activeLayer && activeLayer.type === 'shape' && activeLayer.shapeData) {
              const fill = activeTool === 'line_shape' ? '' : color;
              const stroke = activeTool === 'line_shape' ? color : activeLayer.shapeData.stroke;
              updateLayer(activeLayer.id, {
                shapeData: {
                  ...activeLayer.shapeData,
                  fill,
                  stroke
                }
              });
              recordHistory('Change Shape Fill');
            }
          }}
          onOpacityChange={(opacity) => {
            setPrimaryOpacity(opacity);
            if (activeLayer && activeLayer.type === 'text') {
              updateLayer(activeLayer.id, { color: hexToRgba(brushColor, opacity) });
              recordHistory('Change Text Color');
            }
          }}
        />
      )}
      {(shapeTools.includes(activeTool) || penTools.includes(activeTool)) && (
        <ColorPicker
          label={['shape', 'ellipse_shape', 'line_shape', 'triangle_shape', 'polygon_shape', 'custom_shape'].includes(activeTool) || ['pen', 'free_pen', 'curvature_pen', 'add_anchor', 'delete_anchor', 'convert_point', 'path_select', 'direct_select'].includes(activeTool) ? 'Stroke' : 'Secondary'}
          color={secondaryColor}
          opacity={secondaryOpacity}
          onColorChange={(color) => {
            setSecondaryColor(color);
            if (activeLayer && activeLayer.type === 'shape' && activeLayer.shapeData) {
              const stroke = activeTool === 'line_shape' ? activeLayer.shapeData.stroke : color;
              updateLayer(activeLayer.id, {
                shapeData: {
                  ...activeLayer.shapeData,
                  stroke
                }
              });
              recordHistory('Change Shape Stroke');
            }
          }}
          onOpacityChange={setSecondaryOpacity}
        />
      )}
      {/* Quick Actions - Very important for mobile */}
      <div className="options-divider" />
      <div className="quick-actions">
        <button className="action-btn" onClick={() => undo()} title="Undo (Ctrl+Z)">
          <LucideIcons.RotateCcw size={16} />
        </button>
        <button className="action-btn" onClick={() => redo()} title="Redo (Ctrl+Y)">
          <LucideIcons.RotateCw size={16} />
        </button>
        <div className="action-divider" />
        <button className="action-btn" onClick={handleDeselect} title="Deselect (Ctrl+D)">
          <LucideIcons.SquareX size={16} />
        </button>
        <button
          className="action-btn"
          onClick={() => { inverseSelection(); recordHistory('Inverse Selection'); }}
          title="Inverse Selection (Shift+Ctrl+I)"
        >
          <LucideIcons.Expand size={16} />
        </button>
        <button
          className="action-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('select-subject'))}
          title="Select Subject (Ctrl+Alt+S)"
          disabled={!activeLayerId}
        >
          <LucideIcons.Target size={16} />
        </button>
        <div className="action-divider" />
        <button
          className="action-btn"
          onClick={() => window.dispatchEvent(new CustomEvent('invert-layer'))}
          disabled={!activeLayerId}
          title="Invert Colors (Ctrl+I)"
        >
          <LucideIcons.Contrast size={16} />
        </button>
        <div className="action-divider" />
        <button
          className="action-btn"
          onClick={() => activeLayerId && duplicateLayer(activeLayerId)}
          disabled={!activeLayerId}
          title="Duplicate Layer (Ctrl+J)"
        >
          <LucideIcons.Copy size={16} />
        </button>
        <button
          className="action-btn delete-btn"
          onClick={() => {
            if (selectionRect || (lassoPaths && lassoPaths.length > 0)) {
              window.dispatchEvent(new CustomEvent('delete-selection'));
            } else if (activeLayerId) {
              removeLayer(activeLayerId);
              recordHistory('Delete Layer');
            }
          }}
          disabled={!activeLayerId}
          title={selectionRect || (lassoPaths && lassoPaths.length > 0) ? "Delete Selection" : "Delete Layer"}
        >
          <LucideIcons.Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};
export default OptionsBar;

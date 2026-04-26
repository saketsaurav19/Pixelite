import React from 'react';
import { useStore } from '../../store/useStore';
import ColorPicker from '../shared/ColorPicker';

const OptionsBar: React.FC = () => {
  const { 
    activeTool, brushSize, setBrushSize, 
    strokeWidth, setStrokeWidth,
    brushColor, setBrushColor, primaryOpacity, setPrimaryOpacity,
    secondaryColor, setSecondaryColor, secondaryOpacity, setSecondaryOpacity 
  } = useStore();

  return (
    <div className="options-bar">
      <div className="tool-indicator">{activeTool.toUpperCase()}</div>
      <div className="options-divider" />
      
      {(activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'text' || activeTool === 'shape') && (
        <div className="option-control">
          <label>
            {activeTool === 'text' ? 'Font Size' : 'Size'}
          </label>
          <input 
            type="range" 
            min="1" 
            max={activeTool === 'text' ? "500" : "200"} 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))} 
          />
          <span className="value-label">{brushSize}px</span>
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape') && (
        <div className="option-control">
          <label>Stroke Width</label>
          <input 
            type="range" 
            min="0" 
            max="50" 
            value={strokeWidth} 
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))} 
          />
          <span className="value-label">{strokeWidth}px</span>
        </div>
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape') && (
        <ColorPicker 
          label={activeTool === 'shape' ? 'Fill' : 'Color'}
          color={brushColor}
          opacity={primaryOpacity}
          onColorChange={setBrushColor}
          onOpacityChange={setPrimaryOpacity}
        />
      )}

      {(activeTool === 'brush' || activeTool === 'text' || activeTool === 'shape') && (
        <ColorPicker 
          label="Stroke"
          color={secondaryColor}
          opacity={secondaryOpacity}
          onColorChange={setSecondaryColor}
          onOpacityChange={setSecondaryOpacity}
        />
      )}
    </div>
  );
};

export default OptionsBar;

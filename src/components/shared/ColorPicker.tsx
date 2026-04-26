import React from 'react';

interface ColorPickerProps {
  label: string;
  color: string;
  opacity: number;
  onColorChange: (color: string) => void;
  onOpacityChange: (opacity: number) => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ label, color, opacity, onColorChange, onOpacityChange }) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const rgba = `rgba(${r}, ${g}, ${b}, ${opacity.toFixed(2)})`;

  return (
    <div className="option-control premium-picker">
      <label>{label}</label>
      <div className="picker-container" style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#2a2a2a', padding: '4px 8px', borderRadius: '6px', border: '1px solid #444' }}>
        <div className="color-preview-wrapper" style={{ position: 'relative', width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', border: '1px solid #555' }}>
          <div className="transparency-grid" style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)', backgroundSize: '8px 8px', backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px', opacity: 0.2 }} />
          <div className="color-fill" style={{ position: 'absolute', inset: 0, backgroundColor: rgba }} />
          <input 
            type="color" 
            value={color} 
            onChange={(e) => onColorChange(e.target.value)} 
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
          />
        </div>
        
        <div className="picker-sliders" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <input 
            type="range" 
            min="0" max="1" step="0.01" 
            value={opacity} 
            onChange={(e) => onOpacityChange(parseFloat(e.target.value))} 
            style={{ width: '80px', height: '4px', accentColor: '#0078d4' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#aaa', fontFamily: 'monospace' }}>
            <span>ALPHA</span>
            <span>{Math.round(opacity * 100)}%</span>
          </div>
        </div>

        <div className="rgba-display" style={{ fontSize: '10px', color: '#eee', fontFamily: 'monospace', padding: '2px 4px', background: '#1a1a1a', borderRadius: '3px', minWidth: '110px', textAlign: 'center' }}>
          {rgba}
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;

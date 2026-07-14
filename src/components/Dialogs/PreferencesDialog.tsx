import React from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import { resetPreferences, loadPreferences } from '../../utils/preferenceStorage';
import './Dialogs.css';

const GRID_TYPES = ['square', 'horizontal', 'vertical', 'cross'] as const;
const INTERPOLATION = ['nearest-neighbor', 'bilinear', 'bicubic'] as const;
const RULER_UNITS = ['px', 'in', 'cm'] as const;

export const PreferencesDialog: React.FC = () => {
  const {
    isPreferencesDialogOpen, setIsPreferencesDialogOpen,
    showGuides, setShowGuides,
    guidesColor, setGuidesColor,
    globalGuidesColor, setGlobalGuidesColor,
    showGrid, setShowGrid,
    gridColor, setGridColor,
    gridType, setGridType,
    gridGapX, setGridGapX,
    gridGapY, setGridGapY,
    gridSubdivision, setGridSubdivision,
    rulerUnit, setRulerUnit,
    quickMaskColor, setQuickMaskColor,
    interpolation, setInterpolation,
    zoomScroll, setZoomScroll,
    glassMenus, setGlassMenus,
    cursorOffset, setCursorOffset,
    dezgoApiKey, setDezgoApiKey,
  } = useStore();

  if (!isPreferencesDialogOpen) return null;

  return (
    <div className="dialog-overlay" onClick={() => setIsPreferencesDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '520px' }}>
        <div className="dialog-header">
          <h3>Preferences</h3>
          <button className="dialog-close" onClick={() => setIsPreferencesDialogOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '16px 20px' }}>

          {/* Section: Guides */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Guides</h4>
            <div style={groupStyle}>
              <Row label="Guides">
                <Toggle checked={showGuides} onChange={setShowGuides} />
              </Row>
              <Row label="Local guides color">
                <ColorSwatch value={guidesColor} onChange={setGuidesColor} />
              </Row>
              <Row label="Global guides color">
                <ColorSwatch value={globalGuidesColor} onChange={setGlobalGuidesColor} />
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Grid */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Grid</h4>
            <div style={groupStyle}>
              <Row label="Grid">
                <Toggle checked={showGrid} onChange={setShowGrid} />
              </Row>
              <Row label="Grid color">
                <ColorSwatch value={gridColor} onChange={setGridColor} />
              </Row>
              <Row label="Grid Type">
                <select value={gridType} onChange={(e) => setGridType(e.target.value as any)} style={selectStyle}>
                  {GRID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Row>
              <Row label="Grid Gap X">
                <NumberInput value={gridGapX} onChange={setGridGapX} unit="Pixels" />
              </Row>
              <Row label="Grid Gap Y">
                <NumberInput value={gridGapY} onChange={setGridGapY} unit="Pixels" />
              </Row>
              <Row label="Subdivision">
                <NumberInput value={gridSubdivision} onChange={setGridSubdivision} unit="" />
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Ruler */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Ruler</h4>
            <div style={groupStyle}>
              <Row label="Ruler Units">
                <select value={rulerUnit} onChange={(e) => setRulerUnit(e.target.value as any)} style={selectStyle}>
                  {RULER_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Quick Mask */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Quick Mask</h4>
            <div style={groupStyle}>
              <Row label="Quick Mask Color">
                <ColorSwatch value={quickMaskColor} onChange={setQuickMaskColor} />
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Image Scaling */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Image Scaling</h4>
            <div style={groupStyle}>
              <Row label="Interpolation">
                <select value={interpolation} onChange={(e) => setInterpolation(e.target.value as any)} style={selectStyle}>
                  {INTERPOLATION.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Interface Options */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Interface Options</h4>
            <div style={groupStyle}>
              <Row label="Zoom with Scroll Wheel">
                <Toggle checked={zoomScroll} onChange={setZoomScroll} />
              </Row>
              <Row label="Glass Menus">
                <Toggle checked={glassMenus} onChange={setGlassMenus} />
              </Row>
              <Row label="Cursor Offset">
                <NumberInput value={cursorOffset} onChange={setCursorOffset} unit="" />
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: API */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>API</h4>
            <div style={groupStyle}>
              <Row label="Dezgo API Key">
                <input
                  type="text"
                  value={dezgoApiKey}
                  onChange={(e) => setDezgoApiKey(e.target.value)}
                  placeholder="Enter API key..."
                  style={textInputStyle}
                />
              </Row>
            </div>
          </div>
          <div style={dividerStyle} />

          {/* Section: Save/Reset */}
          <div style={sectionStyle}>
            <h4 style={sectionTitleStyle}>Preferences Storage</h4>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 10px 0' }}>
              All preferences are saved automatically to local storage.
            </p>
            <button
              onClick={() => {
                resetPreferences();
                window.location.reload();
              }}
              style={{
                background: '#c0392b', color: '#fff', border: 'none',
                borderRadius: '4px', padding: '6px 14px', fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Reset All Preferences
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

/* ─── Helpers ─── */

const sectionStyle: React.CSSProperties = {
  marginBottom: '16px',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 10px 0',
  fontSize: '13px',
  color: '#aaa',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const groupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
    <span style={{ fontSize: '13px', color: '#ddd' }}>{label}</span>
    {children}
  </div>
);

const dividerStyle: React.CSSProperties = {
  height: '1px',
  backgroundColor: '#444',
  margin: '12px 0',
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    style={{
      width: '36px', height: '20px', borderRadius: '10px', border: 'none', cursor: 'pointer',
      backgroundColor: checked ? '#4a9eff' : '#555', position: 'relative', transition: 'background 0.2s',
    }}
  >
    <span style={{
      position: 'absolute', top: '2px', left: checked ? '18px' : '2px',
      width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff',
      transition: 'left 0.2s',
    }} />
  </button>
);

const ColorSwatch: React.FC<{ value: string; onChange: (color: string) => void }> = ({ value, onChange }) => (
  <div style={{ position: 'relative', width: '28px', height: '28px' }}>
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        position: 'absolute', top: 0, left: 0, width: '28px', height: '28px',
        border: '1px solid #555', borderRadius: '4px', cursor: 'pointer',
        padding: 0, background: 'none',
      }}
    />
  </div>
);

const NumberInput: React.FC<{ value: number; onChange: (v: number) => void; unit?: string }> = ({ value, onChange, unit }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={{
        width: '70px', background: '#1a1a1a', color: '#fff', border: '1px solid #444',
        borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none', textAlign: 'right',
      }}
    />
    {unit && <span style={{ fontSize: '11px', color: '#888', minWidth: '40px' }}>{unit}</span>}
  </div>
);

const selectStyle: React.CSSProperties = {
  background: '#1a1a1a', color: '#fff', border: '1px solid #444',
  borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none', minWidth: '110px',
};

const textInputStyle: React.CSSProperties = {
  background: '#1a1a1a', color: '#fff', border: '1px solid #444',
  borderRadius: '4px', padding: '4px 8px', fontSize: '12px', outline: 'none', width: '200px',
};

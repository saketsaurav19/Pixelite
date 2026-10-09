import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import './Dialogs.css';

const TITLES: Record<string, string> = {
  expand: 'Expand Selection',
  contract: 'Contract Selection',
  border: 'Border Selection',
  smooth: 'Smooth Selection',
  feather: 'Feather Selection',
};

const DESCRIPTIONS: Record<string, string> = {
  expand: 'Grows the selection outward by the given number of pixels.',
  contract: 'Shrinks the selection inward by the given number of pixels.',
  border: 'Selects a border band, centered on the current selection edge.',
  smooth: 'Rounds sharp corners of the selection.',
  feather: 'Softens the selection edge by the given radius.',
};

/**
 * Small amount-input dialog for Select > Modify (Expand / Contract /
 * Border / Smooth / Feather). Mounted from MenuBar (not App.tsx).
 */
export const SelectModifyDialog: React.FC = () => {
  const selectModifyRequest = useStore((s) => s.selectModifyRequest);
  const closeSelectModifyDialog = useStore((s) => s.closeSelectModifyDialog);
  const [pixels, setPixels] = useState(10);

  useEffect(() => {
    if (selectModifyRequest) setPixels(10);
  }, [selectModifyRequest]);

  if (!selectModifyRequest) return null;
  const type = selectModifyRequest.type;

  const handleOk = () => {
    const st = useStore.getState();
    const px = Math.max(0, Math.min(500, Math.round(pixels) || 0));
    if (type === 'feather') {
      st.setSelectionFeather(px);
      st.recordHistory?.('Feather Selection');
    } else {
      const hasSelection = st.selectionRect || st.lassoPaths.length > 0;
      if (!hasSelection) {
        st.addAlert?.({ type: 'warning', message: 'No active selection to modify.' });
      } else {
        st.modifySelection(type, px);
      }
    }
    closeSelectModifyDialog();
  };

  return (
    <div className="dialog-overlay" onClick={closeSelectModifyDialog}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '340px' }}>
        <div className="dialog-header">
          <h3>{TITLES[type]}</h3>
          <button className="dialog-close" onClick={closeSelectModifyDialog}>
            <LucideIcons.X size={18} />
          </button>
        </div>
        <div className="dialog-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="dialog-control-group">
            <label>{type === 'feather' ? 'Feather Radius' : 'Pixels'}: {pixels}px</label>
            <input
              type="range"
              min="0"
              max="200"
              value={pixels}
              onChange={(e) => setPixels(parseInt(e.target.value, 10))}
            />
          </div>
          <div className="dialog-control-group">
            <input
              type="number"
              min="0"
              max="500"
              value={pixels}
              onChange={(e) => setPixels(Math.max(0, parseInt(e.target.value, 10) || 0))}
              style={{ width: '100%' }}
            />
          </div>
          <p style={{ fontSize: '0.8rem', color: '#888', margin: 0 }}>{DESCRIPTIONS[type]}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={closeSelectModifyDialog}>Cancel</button>
            <button className="btn btn-primary" onClick={handleOk}>OK</button>
          </div>
        </div>
      </div>
    </div>
  );
};

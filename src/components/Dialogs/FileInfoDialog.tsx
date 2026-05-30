import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import piexif from 'piexifjs';
import './Dialogs.css';

const SUPPORTED_ICC_PROFILES = [
  'sRGB IEC61966-2.1',
  'Adobe RGB (1998)',
  'Display P3',
  'ProPhoto RGB',
  'Apple RGB',
  'ColorMatch RGB',
  'Wide Gamut RGB'
];

export const FileInfoDialog: React.FC = () => {
  const { isFileInfoDialogOpen, setIsFileInfoDialogOpen, documentSize, layers, exifData, setExifData, iccProfile, setIccProfile } = useStore();

  const [activeTab, setActiveTab] = useState<'general' | 'exif' | 'icc'>('general');
  const [localExif, setLocalExif] = useState<any>(null);
  const [localIcc, setLocalIcc] = useState<string>(iccProfile || 'sRGB IEC61966-2.1');

  // EXIF New Field State
  const [newTagIfd, setNewTagIfd] = useState<string>('0th');
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagValue, setNewTagValue] = useState<string>('');

  useEffect(() => {
    if (isFileInfoDialogOpen) {
      setLocalExif(exifData ? JSON.parse(JSON.stringify(exifData)) : { '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null });
      setLocalIcc(iccProfile || 'sRGB IEC61966-2.1');
      setActiveTab('general');
    }
  }, [isFileInfoDialogOpen, exifData, iccProfile]);

  if (!isFileInfoDialogOpen) return null;

  const handleSave = () => {
    setExifData(localExif);
    setIccProfile(localIcc);
    setIsFileInfoDialogOpen(false);
  };

  const handleClearExif = () => {
    setLocalExif({ '0th': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}, '1st': {}, 'thumbnail': null });
  };

  const handleExifChange = (ifd: string, tagId: string, value: any) => {
    setLocalExif((prev: any) => ({
      ...prev,
      [ifd]: {
        ...prev[ifd],
        [tagId]: value
      }
    }));
  };

  const handleRemoveExifTag = (ifd: string, tagId: string) => {
    setLocalExif((prev: any) => {
      const next = { ...prev };
      if (next[ifd] && next[ifd][tagId] !== undefined) {
          delete next[ifd][tagId];
      }
      return next;
    });
  };

  const handleAddExifTag = () => {
      if (!newTagName || newTagValue === '') return;

      // Attempt to find the tag ID from piexif.TAGS
      let tagId: string | null = null;


      // Very basic lookup
      const ifdName = newTagIfd === '0th' ? 'Image' : newTagIfd; // piexifjs uses 'Image' for '0th' in TAGS sometimes, but usually just loops

      let found = false;
      for (const tId in piexif.TAGS[ifdName as keyof typeof piexif.TAGS]) {
         const t = (piexif.TAGS[ifdName as keyof typeof piexif.TAGS] as any)[tId];
         if (t.name === newTagName) {
             tagId = tId;
             // tagType = t.type;
             found = true;
             break;
         }
      }

      if (!found) {
         // fallback if user manually entered a tag ID instead of name
         if (!isNaN(Number(newTagName))) {
             tagId = newTagName;
         } else {
             alert(`Tag "${newTagName}" not found in standard dictionary for IFD ${newTagIfd}.`);
             return;
         }
      }

      if (tagId) {
          // Convert value based on basic types (very simplified)
          // For a real app, strict Type checking based on piexif.TYPES is needed.
          let parsedValue: any = newTagValue;
          if (!isNaN(Number(newTagValue))) parsedValue = Number(newTagValue);

          handleExifChange(newTagIfd, tagId, parsedValue);
          setNewTagName('');
          setNewTagValue('');
      }
  };

  const renderExifFields = (ifd: string) => {
    if (!localExif || !localExif[ifd]) return null;
    const tags = localExif[ifd];
    const keys = Object.keys(tags);

    if (keys.length === 0) return <p className="empty-state">No data</p>;

    return (
      <div className="exif-table">
        {keys.map(tagId => {
          const val = tags[tagId];
          // Try to get human readable name
          let tagName = tagId;
          const dictName = ifd === '0th' ? 'Image' : ifd;
          if (piexif.TAGS[dictName as keyof typeof piexif.TAGS] && (piexif.TAGS[dictName as keyof typeof piexif.TAGS] as any)[tagId]) {
              tagName = (piexif.TAGS[dictName as keyof typeof piexif.TAGS] as any)[tagId].name;
          }



          return (
            <div key={tagId} className="exif-row">
              <span className="exif-label" title={`Tag ID: ${tagId}`}>{tagName}:</span>
              <input
                 type="text"
                 className="exif-input"
                 value={typeof val === 'string' ? val : JSON.stringify(val)}
                 onChange={(e) => {
                    let newVal: any = e.target.value;
                    try {
                        // try parsing json for arrays/numbers if user edits it
                        if (newVal.startsWith('[') || !isNaN(Number(newVal))) {
                             newVal = JSON.parse(newVal);
                        }
                    } catch(_e) { /* ignore parse error */ }
                    handleExifChange(ifd, tagId, newVal);
                 }}
              />
              <button className="btn-icon" onClick={() => handleRemoveExifTag(ifd, tagId)} title="Remove">
                 <LucideIcons.Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="dialog-overlay" onClick={() => setIsFileInfoDialogOpen(false)}>
      <div className="dialog-content file-info-dialog" onClick={e => e.stopPropagation()} style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="dialog-header">
          <h2>File Information</h2>
          <button className="dialog-close" onClick={() => setIsFileInfoDialogOpen(false)}>
            <LucideIcons.X size={20} />
          </button>
        </div>

        <div className="dialog-tabs">
            <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>General</button>
            <button className={`tab-btn ${activeTab === 'exif' ? 'active' : ''}`} onClick={() => setActiveTab('exif')}>EXIF Data</button>
            <button className={`tab-btn ${activeTab === 'icc' ? 'active' : ''}`} onClick={() => setActiveTab('icc')}>ICC Profile</button>
        </div>

        <div className="dialog-body" style={{ minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }}>
            {activeTab === 'general' && (
                <div className="info-grid">
                    <div className="info-row">
                        <span className="info-label">Dimensions:</span>
                        <span className="info-value">{documentSize.w} x {documentSize.h} pixels</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Total Layers:</span>
                        <span className="info-value">{layers.length}</span>
                    </div>
                    <div className="info-row">
                        <span className="info-label">Approx Memory:</span>
                        <span className="info-value">{Math.round((documentSize.w * documentSize.h * 4 * layers.length) / 1024 / 1024)} MB (Uncompressed Buffers)</span>
                    </div>
                </div>
            )}

            {activeTab === 'exif' && (
                <div className="exif-editor">
                    <div className="exif-toolbar">
                        <button className="btn-secondary btn-sm" onClick={handleClearExif}>Clear All EXIF</button>
                    </div>

                    <div className="exif-section">
                        <h3>0th (Image)</h3>
                        {renderExifFields('0th')}
                    </div>
                    <div className="exif-section">
                        <h3>Exif</h3>
                        {renderExifFields('Exif')}
                    </div>
                    <div className="exif-section">
                        <h3>GPS</h3>
                        {renderExifFields('GPS')}
                    </div>

                    <div className="exif-add-new">
                        <h4>Add/Edit Tag</h4>
                        <div className="add-tag-row">
                           <select value={newTagIfd} onChange={e => setNewTagIfd(e.target.value)}>
                              <option value="0th">0th (Image)</option>
                              <option value="Exif">Exif</option>
                              <option value="GPS">GPS</option>
                              <option value="1st">1st (Thumbnail)</option>
                           </select>
                           <input type="text" placeholder="Tag Name (e.g. Make, Model)" value={newTagName} onChange={e => setNewTagName(e.target.value)} />
                           <input type="text" placeholder="Value" value={newTagValue} onChange={e => setNewTagValue(e.target.value)} />
                           <button className="btn-secondary" onClick={handleAddExifTag}>Add</button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'icc' && (
                <div className="icc-editor">
                    <p>Assign a color profile to this document. Note: Visual changes require canvas color space manipulation.</p>
                    <div className="setting-group">
                        <label>Color Profile:</label>
                        <select value={localIcc} onChange={(e) => setLocalIcc(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '10px' }}>
                            {SUPPORTED_ICC_PROFILES.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
        </div>

        <div className="dialog-footer">
          <button className="btn-secondary" onClick={() => setIsFileInfoDialogOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

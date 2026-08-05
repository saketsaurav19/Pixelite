import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import './Dialogs.css';

interface CommandDef {
  id: string;
  name: string;
  category: string;
  defaultVal: string;
}

const commandsList: CommandDef[] = [
  // File
  { id: 'file_new', name: 'New...', category: 'File', defaultVal: 'Ctrl+N' },
  { id: 'file_open', name: 'Open...', category: 'File', defaultVal: 'Ctrl+O' },
  { id: 'file_open_url', name: 'Open from URL...', category: 'File', defaultVal: '' },
  { id: 'file_take_snapshot', name: 'Take a picture...', category: 'File', defaultVal: '' },
  { id: 'file_place', name: 'Open and Place...', category: 'File', defaultVal: '' },
  { id: 'file_save', name: 'Save', category: 'File', defaultVal: 'Ctrl+S' },
  { id: 'file_save_psd', name: 'Save as PSD', category: 'File', defaultVal: '' },
  { id: 'file_export_dialog', name: 'Export...', category: 'File', defaultVal: '' },
  { id: 'file_print', name: 'Print...', category: 'File', defaultVal: 'Ctrl+P' },
  // Edit
  { id: 'edit_undo', name: 'Undo', category: 'Edit', defaultVal: 'Ctrl+Z' },
  { id: 'edit_redo', name: 'Redo', category: 'Edit', defaultVal: 'Shift+Ctrl+Z' },
  { id: 'edit_cut', name: 'Cut', category: 'Edit', defaultVal: 'Ctrl+X' },
  { id: 'edit_copy', name: 'Copy', category: 'Edit', defaultVal: 'Ctrl+C' },
  { id: 'edit_paste', name: 'Paste', category: 'Edit', defaultVal: 'Ctrl+V' },
  { id: 'edit_fill', name: 'Fill...', category: 'Edit', defaultVal: '' },
  { id: 'edit_fade', name: 'Fade...', category: 'Edit', defaultVal: '' },
  { id: 'edit_copy_merged', name: 'Copy Merged', category: 'Edit', defaultVal: '' },
  { id: 'edit_free_transform', name: 'Free Transform', category: 'Edit', defaultVal: 'Ctrl+T' },
  { id: 'edit_preferences', name: 'Preferences...', category: 'Edit', defaultVal: 'Ctrl+K' },
  // Image
  { id: 'dialog_image_size', name: 'Image Size...', category: 'Image', defaultVal: 'Alt+Ctrl+I' },
  { id: 'dialog_canvas_size', name: 'Canvas Size...', category: 'Image', defaultVal: 'Alt+Ctrl+C' },
  { id: 'image_auto_tone', name: 'Auto Tone', category: 'Image', defaultVal: '' },
  { id: 'image_auto_contrast', name: 'Auto Contrast', category: 'Image', defaultVal: '' },
  { id: 'image_auto_color', name: 'Auto Color', category: 'Image', defaultVal: '' },
  // Image > Adjustments
  { id: 'adjust_levels', name: 'Levels...', category: 'Image > Adjustments', defaultVal: 'Ctrl+L' },
  { id: 'adjust_curves', name: 'Curves...', category: 'Image > Adjustments', defaultVal: 'Ctrl+M' },
  { id: 'adjust_hue_saturation', name: 'Hue/Saturation...', category: 'Image > Adjustments', defaultVal: 'Ctrl+U' },
  { id: 'adjust_color_balance', name: 'Color Balance...', category: 'Image > Adjustments', defaultVal: 'Ctrl+B' },
  { id: 'adjust_invert', name: 'Invert', category: 'Image > Adjustments', defaultVal: 'Ctrl+I' },
  // Layer
  { id: 'layer_new', name: 'New Layer', category: 'Layer', defaultVal: 'Shift+Ctrl+N' },
  { id: 'layer_duplicate', name: 'Duplicate Layer', category: 'Layer', defaultVal: 'Ctrl+J' },
  { id: 'layer_delete', name: 'Delete Layer', category: 'Layer', defaultVal: 'Del' },
  { id: 'layer_merge', name: 'Merge Layers', category: 'Layer', defaultVal: 'Ctrl+E' },
  { id: 'layer_flatten', name: 'Flatten Image', category: 'Layer', defaultVal: '' },
  // Select
  { id: 'select_all', name: 'All', category: 'Select', defaultVal: 'Ctrl+A' },
  { id: 'select_deselect', name: 'Deselect', category: 'Select', defaultVal: 'Ctrl+D' },
  { id: 'select_inverse', name: 'Inverse Selection', category: 'Select', defaultVal: 'Shift+Ctrl+I' },
  { id: 'select_subject', name: 'Select Subject', category: 'Select', defaultVal: '' },
  { id: 'select_remove_bg', name: 'Remove BG', category: 'Select', defaultVal: '' },
  // View
  { id: 'view_zoom_fit', name: 'Fit Area', category: 'View', defaultVal: 'Ctrl+0' },
  { id: 'view_zoom_100', name: 'Pixel to Pixel', category: 'View', defaultVal: 'Ctrl+1' },
  { id: 'view_rulers', name: 'Rulers', category: 'View', defaultVal: 'Ctrl+R' },
  { id: 'view_grid', name: 'Grid', category: 'View', defaultVal: '' },
  { id: 'view_guides', name: 'Guides', category: 'View', defaultVal: '' },
  // Tools
  { id: 'tool_move', name: 'Move Tool', category: 'Tools', defaultVal: 'V' },
  { id: 'tool_marquee', name: 'Marquee Selection', category: 'Tools', defaultVal: 'M' },
  { id: 'tool_lasso', name: 'Lasso Selection', category: 'Tools', defaultVal: 'L' },
  { id: 'tool_quick_selection', name: 'Quick Selection', category: 'Tools', defaultVal: 'W' },
  { id: 'tool_crop', name: 'Crop Tool', category: 'Tools', defaultVal: 'C' },
  { id: 'tool_eyedropper', name: 'Eyedropper', category: 'Tools', defaultVal: 'I' },
  { id: 'tool_healing', name: 'Healing Brush', category: 'Tools', defaultVal: 'J' },
  { id: 'tool_brush', name: 'Brush Tool', category: 'Tools', defaultVal: 'B' },
  { id: 'tool_clone', name: 'Clone Stamp', category: 'Tools', defaultVal: 'S' },
  { id: 'tool_eraser', name: 'Eraser Tool', category: 'Tools', defaultVal: 'E' },
  { id: 'tool_gradient', name: 'Gradient Tool', category: 'Tools', defaultVal: 'G' },
  { id: 'tool_dodge', name: 'Dodge Tool', category: 'Tools', defaultVal: 'O' },
  { id: 'tool_pen', name: 'Pen Tool', category: 'Tools', defaultVal: 'P' },
  { id: 'tool_text', name: 'Text Tool', category: 'Tools', defaultVal: 'T' },
  { id: 'tool_shape', name: 'Shape Tool', category: 'Tools', defaultVal: 'U' },
  { id: 'tool_hand', name: 'Hand Tool', category: 'Tools', defaultVal: 'H' },
  { id: 'tool_zoom', name: 'Zoom Tool', category: 'Tools', defaultVal: 'Z' },
];

export const KeyboardShortcutsDialog: React.FC = () => {
  const {
    isKeyboardShortcutsDialogOpen,
    setIsKeyboardShortcutsDialogOpen,
    shortcuts,
    setShortcut
  } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for adding custom keyboard shortcut
  const [showAddForm, setShowAddForm] = useState(false);
  const [addSelectedCmdId, setAddSelectedCmdId] = useState('');
  const [addShortcutText, setAddShortcutText] = useState('');
  const [isCapturingAddShortcut, setIsCapturingAddShortcut] = useState(false);

  useEffect(() => {
    if (!editingId && !isCapturingAddShortcut) return;

    const handleKeyDownCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const modifiers: string[] = [];
      if (e.ctrlKey || e.metaKey) modifiers.push('Ctrl');
      if (e.altKey) modifiers.push('Alt');
      if (e.shiftKey) modifiers.push('Shift');

      const isModifierOnly = ['control', 'shift', 'alt', 'meta'].includes(e.key.toLowerCase());
      
      if (!isModifierOnly) {
        let keyName = e.key;
        if (keyName === ' ') {
          keyName = 'Space';
        } else if (keyName.length === 1) {
          keyName = keyName.toUpperCase();
        } else if (keyName === 'ArrowUp') {
          keyName = 'Up';
        } else if (keyName === 'ArrowDown') {
          keyName = 'Down';
        } else if (keyName === 'ArrowLeft') {
          keyName = 'Left';
        } else if (keyName === 'ArrowRight') {
          keyName = 'Right';
        }

        const shortcutStr = [...modifiers, keyName].join('+');

        if (editingId) {
          setShortcut(editingId, shortcutStr);
          setEditingId(null);
        } else if (isCapturingAddShortcut) {
          setAddShortcutText(shortcutStr);
          setIsCapturingAddShortcut(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDownCapture, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDownCapture, true);
    };
  }, [editingId, isCapturingAddShortcut, setShortcut]);

  if (!isKeyboardShortcutsDialogOpen) return null;

  const filteredCommands = commandsList.filter(cmd => 
    cmd.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    cmd.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleResetAll = () => {
    if (window.confirm('Are you sure you want to reset all shortcuts to their defaults?')) {
      commandsList.forEach(cmd => {
        setShortcut(cmd.id, cmd.defaultVal);
      });
      setEditingId(null);
    }
  };

  const handleResetSingle = (cmdId: string, defaultVal: string) => {
    setShortcut(cmdId, defaultVal);
    if (editingId === cmdId) setEditingId(null);
  };

  const handleSaveAddForm = () => {
    if (!addSelectedCmdId) {
      alert('Please select a command.');
      return;
    }
    if (!addShortcutText) {
      alert('Please specify a shortcut combination.');
      return;
    }
    setShortcut(addSelectedCmdId, addShortcutText);
    setAddSelectedCmdId('');
    setAddShortcutText('');
    setShowAddForm(false);
  };

  // Commands available to add (currently not set or not matching defaults)
  const availableToAdd = commandsList.filter(cmd => {
    const isConfigured = shortcuts[cmd.id] !== undefined ? shortcuts[cmd.id] !== '' : cmd.defaultVal !== '';
    return !isConfigured;
  });

  return (
    <div className="dialog-overlay" onClick={() => setIsKeyboardShortcutsDialogOpen(false)}>
      <div 
        className="dialog-content" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '48rem', width: '95%', background: '#1c1c1e', border: '1px solid #2c2c2e' }}
      >
        <div className="dialog-header" style={{ padding: '16px 20px', borderBottom: '1px solid #2c2c2e' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 600 }}>Keyboard Shortcuts</h2>
          <button className="dialog-close" onClick={() => setIsKeyboardShortcutsDialogOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ padding: '20px', gap: '16px', overflowY: 'hidden', height: '520px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <LucideIcons.Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8e8e93' }} />
              <input 
                type="text" 
                placeholder="Search commands or categories..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  background: '#2c2c2e',
                  border: '1px solid #3a3a3c',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
            <button 
              onClick={handleResetAll}
              style={{
                padding: '8px 14px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '6px',
                color: '#ff453a',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.2s',
                outline: 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 69, 58, 0.15)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
            >
              Reset All Defaults
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #2c2c2e', borderRadius: '6px', background: '#121214' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#1c1c1e', borderBottom: '1px solid #2c2c2e', position: 'sticky', top: 0, zIndex: 10 }}>
                  <th style={{ padding: '10px 14px', color: '#8e8e93', fontWeight: 500 }}>Category</th>
                  <th style={{ padding: '10px 14px', color: '#8e8e93', fontWeight: 500 }}>Command</th>
                  <th style={{ padding: '10px 14px', color: '#8e8e93', fontWeight: 500 }}>Keybinding</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: '#8e8e93', fontWeight: 500 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCommands.length > 0 ? (
                  filteredCommands.map((cmd) => {
                    const isEditing = editingId === cmd.id;
                    const displayShortcut = shortcuts[cmd.id] !== undefined ? shortcuts[cmd.id] : cmd.defaultVal;

                    return (
                      <tr key={cmd.id} style={{ borderBottom: '1px solid #1c1c1e', transition: 'background 0.15s' }}>
                        <td style={{ padding: '10px 14px', color: '#8e8e93' }}>{cmd.category}</td>
                        <td style={{ padding: '10px 14px', color: '#fff', fontWeight: 500 }}>{cmd.name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {isEditing ? (
                            <div 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                padding: '4px 8px', 
                                background: '#ff9500', 
                                color: '#000', 
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 600
                              }}
                            >
                              Press desired keys...
                            </div>
                          ) : displayShortcut ? (
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              {displayShortcut.split('+').map((part, pIdx) => (
                                <kbd 
                                  key={pIdx} 
                                  style={{
                                    padding: '2px 6px',
                                    background: '#2c2c2e',
                                    border: '1px solid #3a3a3c',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: '#fff',
                                    boxShadow: '0 1px 0 rgba(0,0,0,0.2)'
                                  }}
                                >
                                  {part}
                                </kbd>
                              ))}
                            </div>
                          ) : (
                            <span style={{ color: '#48484a', fontSize: '12px', fontStyle: 'italic' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setEditingId(isEditing ? null : cmd.id)}
                              style={{
                                padding: '4px 8px',
                                background: isEditing ? '#ff3b30' : 'rgba(255, 255, 255, 0.06)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '4px',
                                color: '#fff',
                                fontSize: '11px',
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {isEditing ? 'Cancel' : 'Edit'}
                            </button>
                            {displayShortcut !== cmd.defaultVal && (
                              <button
                                onClick={() => handleResetSingle(cmd.id, cmd.defaultVal)}
                                title="Reset to default"
                                style={{
                                  padding: '4px 8px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#ff9500',
                                  fontSize: '11px',
                                  cursor: 'pointer',
                                  outline: 'none'
                                }}
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#8e8e93' }}>
                      No matching commands found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Add Shortcut Section */}
          <div style={{ borderTop: '1px solid #2c2c2e', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {showAddForm ? (
              <div 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'center', 
                  background: '#2c2c2e', 
                  padding: '10px 14px', 
                  borderRadius: '6px',
                  border: '1px solid #3a3a3c'
                }}
              >
                <div style={{ flex: 1 }}>
                  <select 
                    value={addSelectedCmdId}
                    onChange={(e) => setAddSelectedCmdId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      background: '#1c1c1e',
                      border: '1px solid #3a3a3c',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  >
                    <option value="">-- Choose Unbound Action --</option>
                    {availableToAdd.map(cmd => (
                      <option key={cmd.id} value={cmd.id}>
                        {cmd.category} &gt; {cmd.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '180px' }}>
                  {isCapturingAddShortcut ? (
                    <div 
                      style={{ 
                        padding: '6px 12px', 
                        background: '#ff9500', 
                        color: '#000', 
                        borderRadius: '4px', 
                        fontSize: '12px', 
                        fontWeight: 600,
                        textAlign: 'center'
                      }}
                    >
                      Press keys...
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      readOnly
                      placeholder="Click to capture..."
                      value={addShortcutText}
                      onClick={() => setIsCapturingAddShortcut(true)}
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        background: '#1c1c1e',
                        border: '1px solid #3a3a3c',
                        borderRadius: '4px',
                        color: '#fff',
                        fontSize: '12px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        outline: 'none'
                      }}
                    />
                  )}
                </div>

                <button 
                  onClick={handleSaveAddForm}
                  style={{
                    padding: '6px 14px',
                    background: '#30d158',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setShowAddForm(false);
                    setAddSelectedCmdId('');
                    setAddShortcutText('');
                    setIsCapturingAddShortcut(false);
                  }}
                  style={{
                    padding: '6px 14px',
                    background: 'transparent',
                    border: 'none',
                    color: '#8e8e93',
                    fontSize: '12px',
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowAddForm(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  width: '100%',
                  padding: '10px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px dashed rgba(255, 255, 255, 0.15)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'background 0.2s, border-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                }}
              >
                <LucideIcons.Plus size={14} /> Add Custom Shortcut
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

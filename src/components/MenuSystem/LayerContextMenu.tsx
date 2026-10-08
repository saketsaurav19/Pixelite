import './LayerContextMenu.css';
import React, { useEffect, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { findLayerById } from '../../utils/layerUtils';

interface LayerContextMenuProps {
  position: { x: number; y: number };
  layerId: string;
  onClose: () => void;
  onRename: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onSetAsCanvas?: (layerId: string) => void;
  onDuplicate?: (layerId: string) => void;
  onMergeDown?: (layerId: string) => void;
}

const LayerContextMenu: React.FC<LayerContextMenuProps> = ({
  position,
  layerId,
  onClose,
  onRename,
  onDelete,
  onSetAsCanvas,
  onDuplicate,
  onMergeDown,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  // Layers are a tree — findLayerById searches nested children too.
  const layer = useStore(s => findLayerById(s.layers, layerId));
  const addLayerMask = useStore(s => s.addLayerMask);
  const deleteLayerMask = useStore(s => s.deleteLayerMask);
  const setLayerMaskEnabled = useStore(s => s.setLayerMaskEnabled);
  const createClippingMask = useStore(s => s.createClippingMask);
  const releaseClippingMask = useStore(s => s.releaseClippingMask);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  // Keep menu on-screen
  const style: React.CSSProperties = {
    position: 'fixed',
    top: position.y,
    left: position.x,
    zIndex: 2000,
  };

  // Only image / paint layers have real pixel dimensions we can use for "Set as Canvas"
  const canSetAsCanvas = layer && (
    layer.type === 'image' ||
    layer.type === 'paint' ||
    (layer as any).dataUrl
  );

  return (
    <div className="layer-context-menu" style={style} ref={menuRef} onContextMenu={(e) => e.preventDefault()}>
      {/* Rename */}
      <button className="menu-item" onClick={() => { onRename(layerId); }}>
        <LucideIcons.Type size={14} />
        <span>Rename</span>
      </button>

      {/* Duplicate */}
      {onDuplicate && (
        <button className="menu-item" onClick={() => { onDuplicate(layerId); onClose(); }}>
          <LucideIcons.Copy size={14} />
          <span>Duplicate Layer</span>
        </button>
      )}

      {/* Set as Canvas — only for image/paint layers */}
      {canSetAsCanvas && onSetAsCanvas && (
        <>
          <div className="menu-divider" />
          <button
            className="menu-item"
            title="Resize the canvas to match this layer's image dimensions"
            onClick={() => { onSetAsCanvas(layerId); onClose(); }}
          >
            <LucideIcons.Maximize2 size={14} />
            <span>Set as Canvas Size</span>
          </button>
        </>
      )}

      {/* Merge Down */}
      {onMergeDown && (
        <button className="menu-item" onClick={() => { onMergeDown(layerId); onClose(); }}>
          <LucideIcons.ArrowDown size={14} />
          <span>Merge Down</span>
        </button>
      )}

      <div className="menu-divider" />

      {/* Layer Mask — add only when there is no mask yet */}
      {layer && !layer.layerMask && (
        <>
          <button className="menu-item" onClick={() => { addLayerMask(layerId, 'revealAll'); onClose(); }}>
            <LucideIcons.CirclePlus size={14} />
            <span>Add Mask (Reveal All)</span>
          </button>
          <button className="menu-item" onClick={() => { addLayerMask(layerId, 'hideAll'); onClose(); }}>
            <LucideIcons.CircleMinus size={14} />
            <span>Add Mask (Hide All)</span>
          </button>
          <div className="menu-divider" />
        </>
      )}

      {/* Layer Mask — manage an existing mask */}
      {layer?.layerMask && (
        <>
          <button
            className="menu-item"
            onClick={() => { setLayerMaskEnabled(layerId, !layer.layerMask!.enabled); onClose(); }}
          >
            {layer.layerMask.enabled
              ? <LucideIcons.EyeOff size={14} />
              : <LucideIcons.Eye size={14} />}
            <span>{layer.layerMask.enabled ? 'Disable Layer Mask' : 'Enable Layer Mask'}</span>
          </button>
          <button className="menu-item text-danger" onClick={() => { deleteLayerMask(layerId); onClose(); }}>
            <LucideIcons.X size={14} />
            <span>Delete Layer Mask</span>
          </button>
          <div className="menu-divider" />
        </>
      )}

      {/* Clipping Mask — for non-group layers */}
      {layer && layer.type !== 'group' && (
        <>
          <button
            className="menu-item"
            onClick={() => {
              if (layer.clippedTo) {
                releaseClippingMask(layerId);
              } else {
                createClippingMask(layerId);
              }
              onClose();
            }}
          >
            {layer.clippedTo
              ? <LucideIcons.CornerUpLeft size={14} />
              : <LucideIcons.CornerDownRight size={14} />}
            <span>{layer.clippedTo ? 'Release Clipping Mask' : 'Create Clipping Mask'}</span>
          </button>
          <div className="menu-divider" />
        </>
      )}

      {/* Delete */}
      <button className="menu-item text-danger" onClick={() => { onDelete(layerId); }}>
        <LucideIcons.Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default LayerContextMenu;

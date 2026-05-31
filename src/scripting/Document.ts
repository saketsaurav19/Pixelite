import { useStore } from '../store/useStore';
import { ArtLayer } from './ArtLayer';

export class Document {
  get name(): string {
    return useStore.getState().currentProjectId || 'Untitled';
  }

  get width(): number {
    return useStore.getState().documentSize.w;
  }

  get height(): number {
    return useStore.getState().documentSize.h;
  }

  get activeLayer(): ArtLayer | null {
    const activeId = useStore.getState().activeLayerId;
    if (activeId) {
      return new ArtLayer(activeId);
    }
    return null;
  }

  set activeLayer(layer: ArtLayer | null) {
      if (layer) {
          useStore.getState().setActiveLayer(layer.id);
      }
  }

  get artLayers(): ArtLayer[] {
    return useStore.getState().layers.map(l => new ArtLayer(l.id));
  }
}

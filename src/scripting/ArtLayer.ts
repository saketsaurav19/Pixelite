import { useStore } from '../store/useStore';
import type { Layer } from '../store/types';

export class ArtLayer {
  declare GlobalCompositeOperation: any;
  private _id: string;

  constructor(id: string) {
    this._id = id;
  }

  private get _layer(): Layer | undefined {
    return useStore.getState().layers.find(l => l.id === this._id);
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._layer?.name || '';
  }

  set name(value: string) {
    useStore.getState().updateLayer(this._id, { name: value });
  }

  get visible(): boolean {
    return this._layer?.visible ?? false;
  }

  set visible(value: boolean) {
    useStore.getState().updateLayer(this._id, { visible: value });
  }

  get opacity(): number {
    return (this._layer?.opacity ?? 1) * 100;
  }

  set opacity(value: number) {
    // Photoshop opacity is 0-100, we map it to 0-1
    const clamped = Math.max(0, Math.min(100, value));
    useStore.getState().updateLayer(this._id, { opacity: clamped / 100 });
  }

  get blendMode(): string {
      return this._layer?.blendMode || 'source-over';
  }

  set blendMode(value: string) {
      useStore.getState().updateLayer(this._id, { blendMode: value as GlobalCompositeOperation });
  }

  // --- Methods ---

  translate(deltaX: number, deltaY: number): void {
    const layer = this._layer;
    if (layer) {
      useStore.getState().updateLayer(this._id, {
        position: {
          x: layer.position.x + deltaX,
          y: layer.position.y + deltaY
        }
      });
    }
  }

  remove(): void {
    useStore.getState().removeLayer(this._id);
  }

  duplicate(): ArtLayer {
    useStore.getState().duplicateLayer(this._id);
    const layers = useStore.getState().layers;
    // duplicateLayer prepends the new layer to the beginning
    const newLayer = layers[0];
    return new ArtLayer(newLayer.id);
  }
}

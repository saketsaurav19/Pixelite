# `store/slices/layerSlice.ts`

## 📋 Purpose

Zustand slice — layer CRUD, ordering, visibility, locking, opacity, blending, grouping, and masking state. All actions use the immutable tree utilities from `layerUtils`.

> **Source file:** `src/store/slices/layerSlice.ts`

---

## 📦 Imports & Dependencies

| From | What is imported |
|------|-----------------|
| [`zustand`](https://www.npmjs.com/package/zustand) | `StateCreator` |
| [`nanoid`](https://www.npmjs.com/package/nanoid) | `nanoid` |
| `../types` | `EditorState`, `Layer` |
| `../../utils/layerUtils` | `findLayerById`, `removeNode`, `insertNode`, `updateNode`, `flattenTree`, `moveNode`, `reorderNodes` |

---

## 🔧 Slice Actions

---

<code>addLayer(layer: Partial&lt;Layer&gt;): void</code>

Creates a new layer with sensible defaults (`visible: true`, `locked: false`, `opacity: 1`, `type: 'paint'`, etc.) and merges the supplied `Partial<Layer>` on top. Prepends the layer to the top of the root-level array and immediately makes it the `activeLayerId`. The layer name defaults to `"Layer N"` where N is the total flattened layer count + 1.

---

<code>removeLayer(id: string): void</code>

Removes the layer with the given `id` from the tree at any depth using `removeNode`. If the removed layer was the active layer, the active layer is reset to the first root-level layer (or `null` if the list is now empty).

---

<code>setActiveLayer(id: string): void</code>

Simply sets `activeLayerId` to the provided `id`. Used when the user clicks a layer in the panel or when an import operation creates new layers.

---

<code>updateLayer(id: string, updates: Partial&lt;Layer&gt;): void</code>

Shallow-merges `updates` onto the target layer anywhere in the tree using `updateNode`. Used pervasively — e.g. to update `dataUrl` after a paint operation, change `opacity`, or toggle `locked`.

---

<code>duplicateLayer(id: string): void</code>

Finds the layer by `id`, clones it with a new `nanoid()`, appends `" Copy"` to the name, and offsets its position by `(+20, +20)` pixels so the duplicate is visually stacked. Inserts the clone at the root level and activates it.

---

<code>toggleLayerVisibility(id: string): void</code>

Flips the `visible` boolean of the target layer using `updateNode`. Reads the current `visible` state first via `findLayerById`.

---

<code>moveLayer(id: string, direction: 'up' | 'down'): void</code>

Moves the layer one position up or down within its sibling list, delegating to the `moveNode` utility. Works at any nesting depth.

---

<code>reorderLayers(startIndex: number, endIndex: number): void</code>

**Legacy (flat-list) reorder.** Splices the root-level layers array to move the element at `startIndex` to `endIndex`. Kept for backward compatibility — prefer `reorderNodesAction` for tree-aware drag-and-drop.

---

<code>reorderNodesAction(draggedId: string, targetId: string, position: 'before' | 'after' | 'inside'): void</code>

Tree-aware drag-and-drop reorder. Delegates to `reorderNodes` from `layerUtils`, which removes the dragged node and re-inserts it relative to `targetId` at any depth. Supports inserting *before*, *after*, or *inside* (as a child group member) the target.

---

<code>setLayers(layers: Layer[]): void</code>

Directly replaces the entire `layers` array in the store. Used by import operations (open/place file) that build a full new layer tree externally.

---

<code>mergeLayers(ids: string[]): void</code>

Removes all layers in `ids` except the first one (`ids[0]`) from the tree. Sets the active layer to `ids[0]`. Note: this currently only removes the extra layers from the store — the actual pixel compositing must happen before calling this action (e.g. in the menu handler).

---

<code>flattenImage(): void</code>

Collapses the entire layer tree into a single locked `"Background"` layer. Takes the bottom-most leaf of the flattened tree as the base, creates a new `nanoid()` id, renames it `'Background'`, locks it, and sets `type: 'paint'`. All other layers are discarded from the store.

---

<code>rasterizeLayer(id: string): void</code>

Converts a non-paint layer (e.g. `'image'`, `'text'`, `'svg'`) to `type: 'paint'` by updating only the `type` field. The pixel data (`dataUrl`) is left unchanged; the canvas component will treat it as a raster layer from this point.

---

## 📐 Interface

### `LayerSlice`

```typescript
layers: Layer[];
activeLayerId: string | null;
addLayer: (layer: Partial<Layer>) => void;
removeLayer: (id: string) => void;
setActiveLayer: (id: string) => void;
updateLayer: (id: string, updates: Partial<Layer>) => void;
duplicateLayer: (id: string) => void;
toggleLayerVisibility: (id: string) => void;
moveLayer: (id: string, direction: 'up' | 'down') => void;
reorderLayers: (startIndex: number, endIndex: number) => void;
reorderNodesAction: (draggedId: string, targetId: string, position: 'before'|'after'|'inside') => void;
setLayers: (layers: Layer[]) => void;
mergeLayers: (ids: string[]) => void;
flattenImage: () => void;
rasterizeLayer: (id: string) => void;
```

---

*Auto-generated by `_agents/gen-docs.cjs` · 2026-06-15 (improved format)*
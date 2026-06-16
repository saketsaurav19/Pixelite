import type { Layer } from '../store/types';

export function findLayerById(layers: Layer[], id: string): Layer | undefined {
  for (const layer of layers) {
    if (layer.id === id) {
      return layer;
    }
    if (layer.children) {
      const found = findLayerById(layer.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

export function findParentNode(layers: Layer[], id: string): Layer | null {
  for (const layer of layers) {
    if (layer.children) {
      if (layer.children.some(child => child.id === id)) {
        return layer;
      }
      const found = findParentNode(layer.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function removeNode(layers: Layer[], id: string): Layer[] {
  return layers
    .filter(layer => layer.id !== id)
    .map(layer => {
      if (layer.children) {
        return {
          ...layer,
          children: removeNode(layer.children, id)
        };
      }
      return layer;
    });
}

export function insertNode(layers: Layer[], node: Layer, parentId?: string | null): Layer[] {
  if (!parentId) {
    return [node, ...layers];
  }
  return layers.map(layer => {
    if (layer.id === parentId) {
      return {
        ...layer,
        children: [node, ...(layer.children || [])]
      };
    }
    if (layer.children) {
      return {
        ...layer,
        children: insertNode(layer.children, node, parentId)
      };
    }
    return layer;
  });
}

export function updateNode(layers: Layer[], id: string, updates: Partial<Layer>): Layer[] {
  return layers.map(layer => {
    if (layer.id === id) {
      return { ...layer, ...updates };
    }
    if (layer.children) {
      return {
        ...layer,
        children: updateNode(layer.children, id, updates)
      };
    }
    return layer;
  });
}

export function flattenTree(layers: Layer[]): Layer[] {
  let result: Layer[] = [];
  for (const layer of layers) {
    result.push(layer);
    if (layer.children) {
      result = result.concat(flattenTree(layer.children));
    }
  }
  return result;
}

export function getVisibleRenderOrder(layers: Layer[]): Layer[] {
  const result: Layer[] = [];
  // Render bottom-to-top (last in array is bottom in our logic, or top?
  // Wait, the current logic relies on array mapping directly.
  // Actually, currently index 0 is top-most. We process them as needed.
  for (const layer of layers) {
    if (layer.visible) {
      // If we want a flat list of renderable items in bottom-to-top order...
      // It's usually better to just let CanvasLayer handle nesting recursively.
      result.push(layer);
    }
  }
  return result;
}

export function moveNode(layers: Layer[], id: string, direction: 'up' | 'down'): Layer[] {
  const newLayers = JSON.parse(JSON.stringify(layers)) as Layer[]; // Deep copy
  const parent = findParentNode(newLayers, id);
  let list = parent ? parent.children! : newLayers;

  const index = list.findIndex(l => l.id === id);
  if (index === -1) return layers;

  if (direction === 'up' && index > 0) {
    [list[index], list[index - 1]] = [list[index - 1], list[index]];
  } else if (direction === 'down' && index < list.length - 1) {
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
  }

  return newLayers;
}

export function reorderNodes(layers: Layer[], draggedId: string, targetId: string, position: 'before' | 'after' | 'inside'): Layer[] {
    const draggedNode = findLayerById(layers, draggedId);
    if (!draggedNode) return layers;

    let newLayers = removeNode(layers, draggedId);

    if (position === 'inside') {
        return insertNode(newLayers, draggedNode, targetId);
    }

    // Helper to insert before/after
    function insertAtTarget(list: Layer[]): Layer[] {
        const idx = list.findIndex(l => l.id === targetId);
        if (idx !== -1) {
            const newList = [...list];
            newList.splice(position === 'before' ? idx : idx + 1, 0, draggedNode!);
            return newList;
        }
        return list.map(l => {
            if (l.children) {
                return { ...l, children: insertAtTarget(l.children) };
            }
            return l;
        });
    }

    return insertAtTarget(newLayers);
}

export function isLayerOrDescendantsLocked(layer: Layer): boolean {
  if (layer.locked) return true;
  if (layer.children) {
    for (const child of layer.children) {
      if (isLayerOrDescendantsLocked(child)) {
        return true;
      }
    }
  }
  return false;
}

export function isLayerOrAncestorsLocked(layers: Layer[], layerId: string): boolean {
  const layer = findLayerById(layers, layerId);
  if (!layer) return false;

  if (isLayerOrDescendantsLocked(layer)) {
    return true;
  }

  let currentId = layerId;
  let parent = findParentNode(layers, currentId);
  while (parent) {
    if (parent.locked) {
      return true;
    }
    currentId = parent.id;
    parent = findParentNode(layers, currentId);
  }

  return false;
}


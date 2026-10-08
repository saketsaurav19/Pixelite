import type { MenuItem } from './types';
import { editMenu } from './edit';
import { imageMenu } from './image';
import { layerMenu } from './layer';
import { selectMenu } from './select';
import { filterMenu } from './filter';
import { viewMenu } from './view';
import { windowMenu } from './window';
import { helpMenu } from './help';

export const staticMenus: Record<string, MenuItem[]> = {
  edit: editMenu,
  image: imageMenu,
  layer: layerMenu,
  select: selectMenu,
  filter: filterMenu,
  view: viewMenu,
  window: windowMenu,
  help: helpMenu,
};

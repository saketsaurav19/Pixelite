import type { MenuItem } from '../types';
import { editCoreMenu } from './core';
import { editTransformMenu } from './transform';

export const editMenu: MenuItem[] = [...editCoreMenu, ...editTransformMenu];

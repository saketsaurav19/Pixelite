import type { MenuItem } from '../types';
import { layerManagementMenu } from './management';
import { layerStylesMenu } from './styles';

export const layerMenu: MenuItem[] = [...layerManagementMenu, ...layerStylesMenu];

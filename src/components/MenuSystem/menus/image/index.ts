import type { MenuItem } from '../types';
import { imageModeMenu } from './mode';
import { imageAdjustmentMenu } from './adjustments';
import { imageCanvasMenu } from './canvas';

export const imageMenu: MenuItem[] = [...imageModeMenu, ...imageAdjustmentMenu, ...imageCanvasMenu];

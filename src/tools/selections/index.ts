import { marqueeTools } from './marqueeTools';
import { lassoTools } from './lassoTools';
import { magicWandTool } from './magicWandTool';
import { quickSelectionTool } from './quickSelectionTool';
import { objectSelectionTool } from './objectSelectionTool';

export const selectionTools = [
  ...marqueeTools,
  ...lassoTools,
  magicWandTool,
  quickSelectionTool,
  objectSelectionTool
];

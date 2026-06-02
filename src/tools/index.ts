import type { ToolModule } from './types';
import { selectionTools } from './Selection';
import { paintingTools } from './Painting/paintingTools';
import { transformTools } from './Transform/transformTools';
import { utilityTools } from './Utility/utilityTools';
import { healingTools } from './Retouching/healingTools';
import { retouchingTools } from './Retouching/retouchingTools';
import { exposureTools } from './Retouching/exposureTools';
import { artboardTool } from './Artboard/artboardTool';

const allTools: ToolModule[] = [
  ...selectionTools,
  ...paintingTools,
  ...transformTools,
  ...utilityTools,
  ...healingTools,
  ...retouchingTools,
  ...exposureTools,
  artboardTool,
];

export const getToolModule = (id: string) => allTools.find(t => t.id === id);

import type { ToolModule } from './types';
import { selectionTools } from './Selection';
import { vectorTools } from './Selection/penTools';
import { paintingTools } from './Painting/paintingTools';
import { transformTools } from './Transform/transformTools';
import { perspectiveWarpTool } from './Transform/perspectiveWarpTool';
import { utilityTools } from './Utility/utilityTools';
import { healingTools } from './Retouching/healingTools';
import { retouchingTools } from './Retouching/retouchingTools';
import { exposureTools } from './Retouching/exposureTools';
import { artboardTool } from './Artboard/artboardTool';
import { meshWarpTool } from './Transform/meshWarpTool';
import { zoomTool } from './Utility/zoomTool';

const allTools: ToolModule[] = [
  ...selectionTools,
  ...vectorTools,
  ...paintingTools,
  ...transformTools,
  perspectiveWarpTool,
  meshWarpTool,
  zoomTool,
  ...utilityTools,
  ...healingTools,
  ...retouchingTools,
  ...exposureTools,
  artboardTool,
];

export const getToolModule = (id: string) => allTools.find(t => t.id === id);

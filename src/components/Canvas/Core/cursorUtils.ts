export const getCursor = (
  isInteracting: boolean,
  activeTool: string,
  isAltPressed: boolean,
  isCtrlPressed: boolean,
  BRUSH_TOOLS: string[]
): string => {
  if (isInteracting && activeTool === 'hand') return 'grabbing';
  if (activeTool === 'hand') return 'grab';
  if (activeTool === 'move' || activeTool === 'artboard') return 'move';
  if (activeTool === 'zoom_tool') return isAltPressed ? 'zoom-out' : 'zoom-in';
  if (activeTool === 'eyedropper' || activeTool === 'color_sampler') return 'copy';
  if (activeTool === 'text' || activeTool === 'vertical_text') return 'text';

  let tool = activeTool;
  if (['pen', 'curvature_pen', 'free_pen', 'add_anchor', 'delete_anchor'].includes(activeTool as string)) {
    if (isCtrlPressed) tool = 'direct_select' as any;
    else if (isAltPressed) tool = 'convert_point' as any;
  }

  if (tool === 'pen' || tool === 'curvature_pen' || tool === 'free_pen' || tool === 'add_anchor' || tool === 'delete_anchor' || tool === 'direct_select' || tool === 'path_select' || tool === 'convert_point') {
    return 'crosshair';
  }

  if (BRUSH_TOOLS.includes(activeTool as string)) {
    return 'none';
  }
  return 'default';
};

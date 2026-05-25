const toolNameCache: Record<string, string> = {};

/**
 * Formats a tool ID into a human-readable label.
 * Example: 'art_history_brush' -> 'Art History Brush'
 * Uses a cache to avoid repeated string operations.
 */
export const formatToolName = (toolId: string): string => {
  if (toolNameCache[toolId]) {
    return toolNameCache[toolId];
  }

  const formatted = toolId
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  toolNameCache[toolId] = formatted;
  return formatted;
};

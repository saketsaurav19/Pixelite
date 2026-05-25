/**
 * Transient state for tools to avoid polluting the global window object.
 * This object holds temporary data during tool interactions (e.g., start coordinates,
 * canvas snapshots, etc.) that does not need to be part of the global React/Zustand state.
 */
export const toolState: Record<string, any> = {};

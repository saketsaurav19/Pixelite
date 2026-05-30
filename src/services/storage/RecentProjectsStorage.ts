import localforage from 'localforage';
import type { EditorState, HistoryEntry } from '../../store/types';

export interface RecentProject {
  id: string;
  name: string;
  timestamp: number;
  thumbnailDataUrl: string;
  documentSize: { w: number; h: number };
  stateSnapshot: Partial<EditorState>;
  history?: HistoryEntry[];
  historyIndex?: number;
}

// Initialize localforage instance
const storage = localforage.createInstance({
  name: 'Pixelite',
  storeName: 'recent_projects',
  description: 'Stores recent project states'
});

const MAX_PROJECTS = 3;
const MAX_STORAGE_PERCENTAGE = 0.9;

/**
 * We simulate quota checks because standard IndexedDB doesn't expose
 * an exact cross-browser byte size limit easily via localforage.
 * We can use the StorageManager API if available.
 */
async function checkStorageQuota(): Promise<boolean> {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.usage && estimate.quota) {
        return (estimate.usage / estimate.quota) > MAX_STORAGE_PERCENTAGE;
      }
    } catch (e) {
      console.warn('Storage estimation failed', e);
    }
  }
  return false;
}

export const RecentProjectsStorage = {
  async saveProjectState(state: EditorState, thumbnailDataUrl: string, projectId: string | null = null, history: HistoryEntry[] = [], historyIndex: number = 0): Promise<string | null> {
    // 1. Validate - skip if empty
    if (!state.layers || state.layers.length === 0) return null;
    const isBlankBackground = state.layers.length === 1 &&
                              state.layers[0].name === 'Background' &&
                              state.layers[0].type === 'paint' &&
                              !state.layers[0].dataUrl;
    if (isBlankBackground) return null;

    // 2. Generate a name
    const topLayer = state.layers.find(l => l.type === 'image' && l.name !== 'Background');
    const name = topLayer ? topLayer.name : `Project ${new Date().toLocaleDateString()}`;
    const id = projectId || `project_${Date.now()}`;

    // 3. Prepare the snapshot data to save
    const snapshot: Partial<EditorState> = {
      layers: state.layers,
      documentSize: state.documentSize,
      activeLayerId: state.activeLayerId,
    };

    const newProject: RecentProject = {
      id,
      name,
      timestamp: Date.now(),
      thumbnailDataUrl,
      documentSize: state.documentSize,
      stateSnapshot: snapshot,
      history,
      historyIndex
    };

    try {
      // 4. Check quota and clear oldest if needed
      let isFull = await checkStorageQuota();
      let projects = await this.getRecentProjects();

      while (isFull || projects.length >= MAX_PROJECTS) {
        // Remove the oldest project (bottom of the stack)
        const oldest = projects[projects.length - 1]; // sorted newest to oldest
        if (oldest) {
          await storage.removeItem(oldest.id);
          projects = await this.getRecentProjects(); // refresh list
          isFull = await checkStorageQuota();
        } else {
          break;
        }
      }

      // 5. Save the new project
      await storage.setItem(id, newProject);
      return id;
    } catch (e) {
      console.error('Failed to save recent project state to indexedDB:', e);
      return null;
    }
  },

  async getRecentProjects(): Promise<RecentProject[]> {
    try {
      const keys = await storage.keys();
      const projects: RecentProject[] = [];
      for (const key of keys) {
        const p = await storage.getItem<RecentProject>(key);
        if (p) {
          projects.push(p);
        }
      }
      // Sort descending by timestamp (newest first)
      return projects.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      console.error('Failed to get recent projects', e);
      return [];
    }
  },

  async loadProjectState(id: string): Promise<RecentProject | null> {
    try {
      return await storage.getItem<RecentProject>(id);
    } catch (e) {
      console.error(`Failed to load project state for ${id}`, e);
      return null;
    }
  },

  async deleteProject(id: string): Promise<void> {
    try {
      await storage.removeItem(id);
    } catch (e) {
      console.error(`Failed to delete project state for ${id}`, e);
    }
  }
};

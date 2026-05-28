import type { EditorState } from '../../../store/types';

export type MenuAction = (state: EditorState) => void;

export interface MenuLeafItem {
  label: string;
  shortcut?: string;
  action: MenuAction;
  isEnabled?: (state: EditorState) => boolean;
}

export interface MenuGroupItem {
  label: string;
  submenu: MenuItem[];
}

export type MenuItem = MenuLeafItem | MenuGroupItem | { divider: true };

export const isGroupItem = (item: MenuItem): item is MenuGroupItem => 'submenu' in item;
export const isLeafItem = (item: MenuItem): item is MenuLeafItem => 'action' in item;

// placeholder function removed

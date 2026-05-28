import type { MenuItem } from '../types';

export const helpMenu: MenuItem[] = [
  { label: 'Pixelite Help...', action: (s) => s.setIsHelpDialogOpen?.(true) },
  { label: 'Learn & Tutorials', action: (s) => window.open('https://github.com/saketsaurav19/Pixelite', '_blank') },
  { divider: true },
  { label: 'System Info', action: (s) => s.setIsSystemInfoDialogOpen?.(true) },
  { label: 'Keyboard Shortcuts', action: (s) => s.setIsKeyboardShortcutsDialogOpen?.(true) },
  { divider: true },
  { label: 'About Pixelite', action: (s) => s.setIsAboutDialogOpen?.(true) },
];

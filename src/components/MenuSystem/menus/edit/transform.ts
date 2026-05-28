import type { MenuItem } from '../types';

export const editTransformMenu: MenuItem[] = [
  { label: 'Paste Special', submenu: [
    { label: 'Paste in Place', action: (s) => console.log('Paste in Place') },
    { label: 'Paste Into', action: (s) => console.log('Paste Into') },
    { label: 'Paste Outside', action: (s) => console.log('Paste Outside') },
  ] },
  { divider: true },
  { label: 'Free Transform', shortcut: 'Ctrl+T', action: (s) => console.log('Free Transform mode') },
  { label: 'Content-Aware Scale', action: (s) => console.log('Content-Aware Scale') },
  { label: 'Puppet Warp', action: (s) => console.log('Puppet Warp') },
];

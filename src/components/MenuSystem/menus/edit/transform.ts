import type { MenuItem } from '../types';

export const editTransformMenu: MenuItem[] = [
  { label: 'Paste Special', submenu: [
    { label: 'Paste in Place', action: (_s) => console.log('Paste in Place') },
    { label: 'Paste Into', action: (_s) => console.log('Paste Into') },
    { label: 'Paste Outside', action: (_s) => console.log('Paste Outside') },
  ] },
  { divider: true },
  { label: 'Free Transform', shortcut: 'Ctrl+T', action: (_s) => console.log('Free Transform mode') },
  { label: 'Content-Aware Scale', action: (_s) => console.log('Content-Aware Scale') },
  { label: 'Puppet Warp', action: (_s) => console.log('Puppet Warp') },
];

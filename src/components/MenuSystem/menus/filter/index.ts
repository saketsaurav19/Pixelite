import type { MenuItem } from '../types';

export const filterMenu: MenuItem[] = [
  { label: 'Filter Gallery...', action: (_s) => console.log('Filter Gallery') },
  { label: 'Camera Raw Filter...', action: (_s) => console.log('Camera Raw Filter') },
  { divider: true },
  { label: 'Blur', submenu: [
    { label: 'Average', action: (_s) => console.log('Apply Average Blur') },
    { label: 'Blur', action: (_s) => console.log('Apply Blur') },
    { label: 'Gaussian Blur...', action: (_s) => console.log('Gaussian Blur dialog') },
    { label: 'Motion Blur...', action: (_s) => console.log('Motion Blur dialog') }
  ] },
  { label: 'Distort', submenu: [
    { label: 'Displace...', action: (_s) => console.log('Displace dialog') },
    { label: 'Pinch...', action: (_s) => console.log('Pinch dialog') },
    { label: 'Ripple...', action: (_s) => console.log('Ripple dialog') },
    { label: 'Wave...', action: (_s) => console.log('Wave dialog') }
  ] },
  { label: 'Noise', submenu: [
    { label: 'Add Noise...', action: (_s) => console.log('Add Noise dialog') },
    { label: 'Dust & Scratches...', action: (_s) => console.log('Dust & Scratches dialog') },
    { label: 'Median...', action: (_s) => console.log('Median dialog') }
  ] },
  { label: 'Sharpen', submenu: [
    { label: 'Sharpen', action: (_s) => console.log('Apply Sharpen') },
    { label: 'Sharpen More', action: (_s) => console.log('Apply Sharpen More') },
    { label: 'Unsharp Mask...', action: (_s) => console.log('Unsharp Mask dialog') }
  ] },
  { label: 'Stylize', submenu: [
    { label: 'Emboss...', action: (_s) => console.log('Emboss dialog') },
    { label: 'Find Edges', action: (_s) => console.log('Apply Find Edges') },
    { label: 'Oil Paint...', action: (_s) => console.log('Oil Paint dialog') }
  ] },
  { label: 'Other', submenu: [
    { label: 'High Pass...', action: (_s) => console.log('High Pass dialog') },
    { label: 'Maximum...', action: (_s) => console.log('Maximum dialog') },
    { label: 'Minimum...', action: (_s) => console.log('Minimum dialog') }
  ] },
];

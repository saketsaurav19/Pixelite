import type { MenuItem } from '../types';

export const filterMenu: MenuItem[] = [
  { label: 'Filter Gallery...', action: (s) => console.log('Filter Gallery') },
  { label: 'Camera Raw Filter...', action: (s) => console.log('Camera Raw Filter') },
  { divider: true },
  { label: 'Blur', submenu: [
    { label: 'Average', action: (s) => console.log('Apply Average Blur') },
    { label: 'Blur', action: (s) => console.log('Apply Blur') },
    { label: 'Gaussian Blur...', action: (s) => console.log('Gaussian Blur dialog') },
    { label: 'Motion Blur...', action: (s) => console.log('Motion Blur dialog') }
  ] },
  { label: 'Distort', submenu: [
    { label: 'Displace...', action: (s) => console.log('Displace dialog') },
    { label: 'Pinch...', action: (s) => console.log('Pinch dialog') },
    { label: 'Ripple...', action: (s) => console.log('Ripple dialog') },
    { label: 'Wave...', action: (s) => console.log('Wave dialog') }
  ] },
  { label: 'Noise', submenu: [
    { label: 'Add Noise...', action: (s) => console.log('Add Noise dialog') },
    { label: 'Dust & Scratches...', action: (s) => console.log('Dust & Scratches dialog') },
    { label: 'Median...', action: (s) => console.log('Median dialog') }
  ] },
  { label: 'Sharpen', submenu: [
    { label: 'Sharpen', action: (s) => console.log('Apply Sharpen') },
    { label: 'Sharpen More', action: (s) => console.log('Apply Sharpen More') },
    { label: 'Unsharp Mask...', action: (s) => console.log('Unsharp Mask dialog') }
  ] },
  { label: 'Stylize', submenu: [
    { label: 'Emboss...', action: (s) => console.log('Emboss dialog') },
    { label: 'Find Edges', action: (s) => console.log('Apply Find Edges') },
    { label: 'Oil Paint...', action: (s) => console.log('Oil Paint dialog') }
  ] },
  { label: 'Other', submenu: [
    { label: 'High Pass...', action: (s) => console.log('High Pass dialog') },
    { label: 'Maximum...', action: (s) => console.log('Maximum dialog') },
    { label: 'Minimum...', action: (s) => console.log('Minimum dialog') }
  ] },
];

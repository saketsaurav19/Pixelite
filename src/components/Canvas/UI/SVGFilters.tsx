import React from 'react';
import { useStore } from '../../../store/useStore';

export const SVGFilters: React.FC = () => {
  const visibleChannels = useStore(state => state.visibleChannels) || { r: true, g: true, b: true };
  const selectedChannel = useStore(state => state.selectedChannel) || 'RGB';

  let matrix = '';
  if (selectedChannel === 'r') {
    matrix = '1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 1 0';
  } else if (selectedChannel === 'g') {
    matrix = '0 1 0 0 0  0 1 0 0 0  0 1 0 0 0  0 0 0 1 0';
  } else if (selectedChannel === 'b') {
    matrix = '0 0 1 0 0  0 0 1 0 0  0 0 1 0 0  0 0 0 1 0';
  } else {
    const rVal = visibleChannels.r ? '1' : '0';
    const gVal = visibleChannels.g ? '1' : '0';
    const bVal = visibleChannels.b ? '1' : '0';
    matrix = `${rVal} 0 0 0 0  0 ${gVal} 0 0 0  0 0 ${bVal} 0 0  0 0 0 1 0`;
  }

  return (
    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <filter id="selectionUnion" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          <feMorphology operator="dilate" radius="1.2" result="expanded" />
          <feComposite in="expanded" in2="SourceGraphic" operator="out" />
          <feComponentTransfer>
            <feFuncA type="discrete" tableValues="0 1" />
          </feComponentTransfer>
        </filter>
        <filter id="channelFilter" colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={matrix} />
        </filter>
      </defs>
    </svg>
  );
};

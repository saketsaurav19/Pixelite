// @ts-ignore
import googleFontsComplete from 'google-fonts-complete';

export interface FontVariant {
  id: string;
  name: string;
  weight: string;
  style: 'normal' | 'italic';
}

export interface GoogleFont {
  family: string;
  category: 'sans-serif' | 'serif' | 'handwriting' | 'monospace' | string;
  variants: FontVariant[];
}

const weightNames: Record<string, string> = {
  '100': 'Thin 100',
  '200': 'ExtraLight 200',
  '300': 'Light 300',
  '400': 'Regular 400',
  '500': 'Medium 500',
  '600': 'SemiBold 600',
  '700': 'Bold 700',
  '800': 'ExtraBold 800',
  '900': 'Black 900'
};

const getVariantName = (weight: string, style: 'normal' | 'italic') => {
  const baseName = weightNames[weight] || `Weight ${weight}`;
  if (style === 'italic') {
    return weight === '400' ? 'Italic' : `${baseName.split(' ')[0]} Italic`;
  }
  return baseName;
};

const parseFontsCatalog = (): GoogleFont[] => {
  const rawData = googleFontsComplete as Record<string, any>;
  if (!rawData || typeof rawData !== 'object') return [];

  return Object.keys(rawData).map(family => {
    const fontData = rawData[family];
    const variants: FontVariant[] = [];

    if (fontData.variants) {
      // Normal variants
      if (fontData.variants.normal) {
        Object.keys(fontData.variants.normal).forEach(weight => {
          variants.push({
            id: weight,
            name: getVariantName(weight, 'normal'),
            weight: weight,
            style: 'normal'
          });
        });
      }
      // Italic variants
      if (fontData.variants.italic) {
        Object.keys(fontData.variants.italic).forEach(weight => {
          variants.push({
            id: `${weight}italic`,
            name: getVariantName(weight, 'italic'),
            weight: weight,
            style: 'italic'
          });
        });
      }
    }

    // Default variant if somehow empty
    if (variants.length === 0) {
      variants.push({ id: '400', name: 'Regular 400', weight: '400', style: 'normal' });
    }

    return {
      family,
      category: fontData.category || 'sans-serif',
      variants: variants.sort((a, b) => {
        const wa = parseInt(a.weight) || 400;
        const wb = parseInt(b.weight) || 400;
        if (wa !== wb) return wa - wb;
        return a.style.localeCompare(b.style);
      })
    };
  }).sort((a, b) => a.family.localeCompare(b.family));
};

export const GOOGLE_FONTS_CATALOG = parseFontsCatalog();

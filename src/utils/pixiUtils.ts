import { Application, Sprite, ColorMatrixFilter, Texture } from 'pixi.js';

let sharedApp: Application | null = null;
let initPromise: Promise<Application> | null = null;

export async function getSharedApp(): Promise<Application> {
  if (sharedApp) return sharedApp;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const app = new Application();
    await app.init({
      width: 100,
      height: 100,
      backgroundAlpha: 0,
      manageImports: false,
    });
    sharedApp = app;
    return app;
  })();

  return initPromise;
}

/**
 * Loads an image from a data URL/URI and returns an HTMLImageElement.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

export interface AdjustmentSettings {
  brightness?: number; // -100 to 100
  contrast?: number;   // -100 to 100
  hue?: number;        // -180 to 180
  saturation?: number; // -100 to 100
  lightness?: number;  // -100 to 100
  greyscale?: boolean;
  effect?: 'sepia' | 'vintage' | 'polaroid' | 'technicolor' | 'lsd' | 'kodachrome' | 'brownie' | 'night' | 'negative' | 'predator' | 'none';
}

/**
 * Applies WebGL-based color matrix filters to an image element and returns a base64 png data URL.
 */
export async function applyPixiAdjustments(
  imageElement: HTMLImageElement,
  settings: AdjustmentSettings
): Promise<string> {
  const app = await getSharedApp();
  const { width, height } = imageElement;

  // Resize renderer to fit the image
  app.renderer.resize(width, height);

  // Clear the stage
  app.stage.removeChildren();

  // Create texture and sprite
  const texture = Texture.from(imageElement);
  const sprite = new Sprite(texture);
  app.stage.addChild(sprite);

  // Setup color matrix filter
  const colorMatrix = new ColorMatrixFilter();
  sprite.filters = [colorMatrix];

  // Apply transformations
  colorMatrix.reset();

  // We chain adjustments using multiply = true.
  // 1. Brightness & Contrast
  if (settings.brightness !== undefined && settings.brightness !== 0) {
    colorMatrix.brightness(1 + settings.brightness / 100, true);
  }
  if (settings.contrast !== undefined && settings.contrast !== 0) {
    colorMatrix.contrast(1 + settings.contrast / 100, true);
  }

  // 2. Hue, Saturation & Lightness
  if (settings.hue !== undefined && settings.hue !== 0) {
    colorMatrix.hue(settings.hue, true);
  }
  if (settings.saturation !== undefined && settings.saturation !== 0) {
    colorMatrix.saturate(1 + settings.saturation / 100, true);
  }
  if (settings.lightness !== undefined && settings.lightness !== 0) {
    colorMatrix.brightness(1 + settings.lightness / 100, true);
  }

  // 3. Black & White
  if (settings.greyscale) {
    colorMatrix.greyscale(1, true);
  }

  // 4. Effects
  if (settings.effect && settings.effect !== 'none') {
    switch (settings.effect) {
      case 'sepia':
        colorMatrix.sepia(true);
        break;
      case 'vintage':
        colorMatrix.vintage(true);
        break;
      case 'polaroid':
        colorMatrix.polaroid(true);
        break;
      case 'technicolor':
        colorMatrix.technicolor(true);
        break;
      case 'lsd':
        colorMatrix.lsd(true);
        break;
      case 'kodachrome':
        colorMatrix.kodachrome(true);
        break;
      case 'brownie':
        colorMatrix.browni(true);
        break;
      case 'night':
        colorMatrix.night(0.5, true);
        break;
      case 'negative':
        colorMatrix.negative(true);
        break;
      case 'predator':
        colorMatrix.predator(1, true);
        break;
    }
  }

  // Render the stage
  app.renderer.render(app.stage);

  // Extract base64 representation
  const resultDataUrl = await app.renderer.extract.base64(app.stage);

  // Clean up texture to avoid GPU memory leaks
  texture.destroy(true);

  return resultDataUrl;
}

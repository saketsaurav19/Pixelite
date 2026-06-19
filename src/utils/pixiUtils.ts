import { Application, Sprite, ColorMatrixFilter, Texture, Container } from 'pixi.js';

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
 * 
 * SAFETY: This function is designed to handle rapid successive calls safely:
 * - Uses try/finally to guarantee GPU resource cleanup even on errors
 * - Properly destroys textures, sprites, and filters to prevent memory leaks
 * - Caller should implement debouncing/concurrency guards for best performance
 */
export async function applyPixiAdjustments(
  imageElement: HTMLImageElement,
  settings: AdjustmentSettings
): Promise<string> {
  // Validate input
  if (!imageElement || imageElement.width === 0 || imageElement.height === 0) {
    throw new Error('Invalid image element: image must be loaded with non-zero dimensions');
  }

  const app = await getSharedApp();
  const { width, height } = imageElement;

  // Resize renderer to fit the image
  app.renderer.resize(width, height);

  // Store previous children for cleanup in case of unexpected state
  const previousChildren = [...app.stage.children];

  // Clear the stage
  app.stage.removeChildren();

  // Destroy previous sprites/textures from the old children to prevent memory leaks
  previousChildren.forEach((child) => {
    if (child instanceof Sprite) {
      if (child.texture) {
        child.texture.destroy(true);
      }
      child.destroy({ children: true });
    } else if (child instanceof Container) {
      child.destroy({ children: true });
    } else {
      child.destroy();
    }
  });

  // Create texture and sprite
  const texture = Texture.from(imageElement);
  const sprite = new Sprite(texture);

  // Setup color matrix filter - create fresh filter each call to avoid state accumulation
  const colorMatrix = new ColorMatrixFilter();
  sprite.filters = [colorMatrix];

  app.stage.addChild(sprite);

  let resultDataUrl: string;

  try {
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
      // Lightness is approximated using brightness as PIXI's ColorMatrixFilter
      // does not have a dedicated lightness method. This is a known limitation.
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
          // PIXI uses 'browni' (not 'brownie') as the method name
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
    resultDataUrl = await app.renderer.extract.base64(app.stage);
  } catch (error) {
    // Re-throw after cleanup in finally block
    throw error;
  } finally {
    // GUARANTEED CLEANUP: Always destroy GPU resources even if rendering fails
    try {
      // Remove sprite from stage before destroying
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      // Destroy texture (frees GPU memory)
      texture.destroy(true);
      // Destroy sprite and its filters
      sprite.destroy({ children: true });
      // Explicitly destroy the filter
      colorMatrix.destroy();
    } catch (cleanupError) {
      // Log cleanup errors but don't mask the original error
      console.warn('PIXI resource cleanup warning:', cleanupError);
    }
  }

  return resultDataUrl;
}

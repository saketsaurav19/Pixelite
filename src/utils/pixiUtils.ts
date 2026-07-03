import { Application, Sprite, ColorMatrixFilter, Texture, Filter, GlProgram, UniformGroup, defaultFilterVert } from 'pixi.js';

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
      preference: 'webgl',
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

export interface Point {
  x: number;
  y: number;
}

export interface LevelsSettings {
  master: { inBlack: number; inGamma: number; inWhite: number; outBlack: number; outWhite: number };
  red: { inBlack: number; inGamma: number; inWhite: number; outBlack: number; outWhite: number };
  green: { inBlack: number; inGamma: number; inWhite: number; outBlack: number; outWhite: number };
  blue: { inBlack: number; inGamma: number; inWhite: number; outBlack: number; outWhite: number };
}

export interface CurvesSettings {
  master: Point[];
  red?: Point[];
  green?: Point[];
  blue?: Point[];
}

export interface ColorBalanceSettings {
  shadows: { cyanRed: number; magentaGreen: number; yellowBlue: number };
  midtones: { cyanRed: number; magentaGreen: number; yellowBlue: number };
  highlights: { cyanRed: number; magentaGreen: number; yellowBlue: number };
  preserveLuminosity: boolean;
}

export interface AdjustmentSettings {
  brightness?: number; // -100 to 100
  contrast?: number;   // -100 to 100
  hue?: number;        // -180 to 180
  saturation?: number; // -100 to 100
  lightness?: number;  // -100 to 100
  greyscale?: boolean;
  effect?: 'sepia' | 'vintage' | 'polaroid' | 'technicolor' | 'lsd' | 'kodachrome' | 'brownie' | 'night' | 'negative' | 'predator' | 'none';
  exposure?: {
    exposure: number;
    offset: number;
    gamma: number;
  };
  vibrance?: number; // -100 to 100
  colorBalance?: ColorBalanceSettings;
  levels?: LevelsSettings;
  curves?: CurvesSettings;
}

/**
 * Robust linear interpolation utility for curves mapping fallback.
 */
export function computeLinearInterpolation(points: Point[]): number[] {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const lut = new Array<number>(256);
  const n = pts.length;
  
  if (n === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  if (n === 1) {
    const val = Math.max(0, Math.min(255, Math.round(pts[0].y)));
    lut.fill(val);
    return lut;
  }

  for (let i = 0; i < 256; i++) {
    if (i <= pts[0].x) {
      const slope = (pts[1].y - pts[0].y) / (pts[1].x - pts[0].x || 1);
      lut[i] = Math.max(0, Math.min(255, Math.round(pts[0].y + slope * (i - pts[0].x))));
    } else if (i >= pts[n - 1].x) {
      const slope = (pts[n - 1].y - pts[n - 2].y) / (pts[n - 1].x - pts[n - 2].x || 1);
      lut[i] = Math.max(0, Math.min(255, Math.round(pts[n - 1].y + slope * (i - pts[n - 1].x))));
    } else {
      let j = 0;
      for (let k = 0; k < n - 1; k++) {
        if (i >= pts[k].x && i <= pts[k + 1].x) {
          j = k;
          break;
        }
      }
      const t = (i - pts[j].x) / (pts[j + 1].x - pts[j].x || 1);
      const y = pts[j].y + t * (pts[j + 1].y - pts[j].y);
      lut[i] = Math.max(0, Math.min(255, Math.round(y)));
    }
  }
  return lut;
}

/**
 * Natural cubic spline interpolation for curves mapping.
 */
export function computeCubicSpline(points: Point[]): number[] {
  const pts = [...points].sort((a, b) => a.x - b.x);
  const n = pts.length;
  const lut = new Array<number>(256);

  if (n === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }
  if (n === 1) {
    const val = Math.max(0, Math.min(255, Math.round(pts[0].y)));
    lut.fill(val);
    return lut;
  }

  const h = new Float32Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = pts[i + 1].x - pts[i].x;
  }

  const a = new Float32Array(n);
  for (let i = 1; i < n - 1; i++) {
    a[i] = (3.0 / h[i]) * (pts[i + 1].y - pts[i].y) - (3.0 / h[i - 1]) * (pts[i].y - pts[i - 1].y);
  }

  const l = new Float32Array(n);
  const mu = new Float32Array(n);
  const z = new Float32Array(n);
  l[0] = 1.0;
  mu[0] = 0.0;
  z[0] = 0.0;

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2.0 * (pts[i + 1].x - pts[i - 1].x) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (a[i] - h[i - 1] * z[i - 1]) / l[i];
  }

  l[n - 1] = 1.0;
  z[n - 1] = 0.0;

  const c = new Float32Array(n);
  const b = new Float32Array(n - 1);
  const d = new Float32Array(n - 1);
  
  c[n - 1] = 0.0;

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (pts[j + 1].y - pts[j].y) / h[j] - (h[j] * (c[j + 1] + 2.0 * c[j])) / 3.0;
    d[j] = (c[j + 1] - c[j]) / (3.0 * h[j]);
  }

  for (let i = 0; i < 256; i++) {
    const x = Math.max(pts[0].x, Math.min(pts[n - 1].x, i));
    
    let j = 0;
    for (let k = 0; k < n - 1; k++) {
      if (x >= pts[k].x && x <= pts[k + 1].x) {
        j = k;
        break;
      }
    }
    
    const dx = x - pts[j].x;
    let y = pts[j].y + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx;
    
    if (i < pts[0].x) {
      const slope = b[0];
      y = pts[0].y + slope * (i - pts[0].x);
    } else if (i > pts[n - 1].x) {
      const lastIdx = n - 2;
      const hLast = h[lastIdx];
      const slope = b[lastIdx] + 2.0 * c[lastIdx] * hLast + 3.0 * d[lastIdx] * hLast * hLast;
      y = pts[n - 1].y + slope * (i - pts[n - 1].x);
    }

    lut[i] = Math.max(0, Math.min(255, Math.round(y)));
  }

  return lut;
}

export function computeCurvesLut(points: Point[]): number[] {
  try {
    const pts = [...points].sort((a, b) => a.x - b.x);
    const unique = pts.filter((p, idx) => idx === 0 || p.x > pts[idx - 1].x + 0.0001);
    if (unique.length < 2) {
      return computeLinearInterpolation(unique);
    }
    return computeCubicSpline(unique);
  } catch (e) {
    console.warn("Spline interpolation failed, falling back to linear:", e);
    return computeLinearInterpolation(points);
  }
}

export function createCurvesLutTexture(curves: CurvesSettings): Texture {
  const identityLut = Array.from({ length: 256 }, (_, idx) => idx);
  const rLut = curves.red ? computeCurvesLut(curves.red) : identityLut;
  const gLut = curves.green ? computeCurvesLut(curves.green) : identityLut;
  const bLut = curves.blue ? computeCurvesLut(curves.blue) : identityLut;
  const mLut = computeCurvesLut(curves.master);

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(256, 1);
    for (let i = 0; i < 256; i++) {
      imgData.data[i * 4 + 0] = rLut[i];
      imgData.data[i * 4 + 1] = gLut[i];
      imgData.data[i * 4 + 2] = bLut[i];
      imgData.data[i * 4 + 3] = mLut[i];
    }
    ctx.putImageData(imgData, 0, 0);
  }
  return Texture.from(canvas);
}

// ----------------------------------------------------
// Custom WebGL Shaders & Filter Classes (PixiJS v8)
// ----------------------------------------------------

const exposureFragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform float uExposure;
  uniform float uOffset;
  uniform float uGamma;
  out vec4 finalColor;

  void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);
      vec3 rgb = color.rgb;
      // Exposure (2^exposure stops multiplication)
      rgb = rgb * pow(2.0, uExposure);
      // Offset
      rgb = rgb + vec3(uOffset);
      // Gamma
      rgb = clamp(rgb, 0.0, 1.0);
      rgb = pow(rgb, vec3(1.0 / uGamma));
      finalColor = vec4(rgb, color.a);
  }
`;

export class ExposureFilter extends Filter {
  constructor(exposure = 0, offset = 0, gamma = 1) {
    super({
      glProgram: GlProgram.from({
        fragment: exposureFragment,
        vertex: defaultFilterVert,
      }),
      resources: {
        exposureUniforms: new UniformGroup({
          uExposure: { value: exposure, type: 'f32' },
          uOffset: { value: offset, type: 'f32' },
          uGamma: { value: gamma, type: 'f32' },
        })
      }
    });
  }
}

const vibranceFragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform float uVibrance;
  out vec4 finalColor;

  void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec3 lum3 = vec3(lum);
      vec3 mask = clamp((color.rgb - lum3) * -1.0 + 1.0, 0.0, 1.0);
      float lumMask = dot(vec3(0.299, 0.587, 0.114), mask);
      vec3 rgb = mix(lum3, color.rgb, 1.0 + uVibrance * lumMask);
      finalColor = vec4(rgb, color.a);
  }
`;

export class VibranceFilter extends Filter {
  constructor(vibrance = 0) {
    super({
      glProgram: GlProgram.from({
        fragment: vibranceFragment,
        vertex: defaultFilterVert,
      }),
      resources: {
        vibranceUniforms: new UniformGroup({
          uVibrance: { value: vibrance, type: 'f32' },
        })
      }
    });
  }
}

const colorBalanceFragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec3 uShadows;
  uniform vec3 uMidtones;
  uniform vec3 uHighlights;
  out vec4 finalColor;

  void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);
      float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      
      float shadowMask = clamp(1.0 - (lum * 2.0), 0.0, 1.0);
      float highlightMask = clamp((lum - 0.5) * 2.0, 0.0, 1.0);
      float midtoneMask = 1.0 - shadowMask - highlightMask;
      
      vec3 rgb = color.rgb;
      rgb += uShadows * shadowMask + uMidtones * midtoneMask + uHighlights * highlightMask;
      rgb = clamp(rgb, 0.0, 1.0);
      
      finalColor = vec4(rgb, color.a);
  }
`;

export class ColorBalanceFilter extends Filter {
  constructor(cb: ColorBalanceSettings) {
    // Photoshop scale of -100 to 100 mapped to subtle GLSL addition range [-0.2, 0.2]
    const scale = 0.2 / 100;
    const shadows = [cb.shadows.cyanRed * scale, cb.shadows.magentaGreen * scale, cb.shadows.yellowBlue * scale];
    const midtones = [cb.midtones.cyanRed * scale, cb.midtones.magentaGreen * scale, cb.midtones.yellowBlue * scale];
    const highlights = [cb.highlights.cyanRed * scale, cb.highlights.magentaGreen * scale, cb.highlights.yellowBlue * scale];
    
    super({
      glProgram: GlProgram.from({
        fragment: colorBalanceFragment,
        vertex: defaultFilterVert,
      }),
      resources: {
        cbUniforms: new UniformGroup({
          uShadows: { value: shadows, type: 'vec3<f32>' },
          uMidtones: { value: midtones, type: 'vec3<f32>' },
          uHighlights: { value: highlights, type: 'vec3<f32>' },
        })
      }
    });
  }
}

const levelsFragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform vec3 uMasterIn;   // x: black, y: gamma, z: white
  uniform vec2 uMasterOut;  // x: black, y: white
  uniform vec3 uRedIn;
  uniform vec2 uRedOut;
  uniform vec3 uGreenIn;
  uniform vec2 uGreenOut;
  uniform vec3 uBlueIn;
  uniform vec2 uBlueOut;
  out vec4 finalColor;

  float applyLevels(float val, vec3 levelIn, vec2 levelOut) {
      float inBlack = levelIn.x;
      float inGamma = levelIn.y;
      float inWhite = levelIn.z;
      float outBlack = levelOut.x;
      float outWhite = levelOut.y;
      
      float norm = clamp((val - inBlack) / (inWhite - inBlack), 0.0, 1.0);
      float corrected = pow(norm, 1.0 / inGamma);
      return outBlack + corrected * (outWhite - outBlack);
  }

  void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);
      vec3 rgb = color.rgb;
      
      // 1. Master levels
      rgb.r = applyLevels(rgb.r, uMasterIn, uMasterOut);
      rgb.g = applyLevels(rgb.g, uMasterIn, uMasterOut);
      rgb.b = applyLevels(rgb.b, uMasterIn, uMasterOut);
      
      // 2. Channel levels
      rgb.r = applyLevels(rgb.r, uRedIn, uRedOut);
      rgb.g = applyLevels(rgb.g, uGreenIn, uGreenOut);
      rgb.b = applyLevels(rgb.b, uBlueIn, uBlueOut);
      
      rgb = clamp(rgb, 0.0, 1.0);
      finalColor = vec4(rgb, color.a);
  }
`;

export class LevelsFilter extends Filter {
  constructor(levels: LevelsSettings) {
    super({
      glProgram: GlProgram.from({
        fragment: levelsFragment,
        vertex: defaultFilterVert,
      }),
      resources: {
        levelsUniforms: new UniformGroup({
          uMasterIn: { value: [levels.master.inBlack / 255, levels.master.inGamma, levels.master.inWhite / 255], type: 'vec3<f32>' },
          uMasterOut: { value: [levels.master.outBlack / 255, levels.master.outWhite / 255], type: 'vec2<f32>' },
          
          uRedIn: { value: [levels.red.inBlack / 255, levels.red.inGamma, levels.red.inWhite / 255], type: 'vec3<f32>' },
          uRedOut: { value: [levels.red.outBlack / 255, levels.red.outWhite / 255], type: 'vec2<f32>' },
          
          uGreenIn: { value: [levels.green.inBlack / 255, levels.green.inGamma, levels.green.inWhite / 255], type: 'vec3<f32>' },
          uGreenOut: { value: [levels.green.outBlack / 255, levels.green.outWhite / 255], type: 'vec2<f32>' },
          
          uBlueIn: { value: [levels.blue.inBlack / 255, levels.blue.inGamma, levels.blue.inWhite / 255], type: 'vec3<f32>' },
          uBlueOut: { value: [levels.blue.outBlack / 255, levels.blue.outWhite / 255], type: 'vec2<f32>' },
        })
      }
    });
  }
}

const curvesFragment = `
  in vec2 vTextureCoord;
  uniform sampler2D uTexture;
  uniform sampler2D uCurvesLut;
  out vec4 finalColor;

  void main(void) {
      vec4 color = texture(uTexture, vTextureCoord);
      vec3 rgb = color.rgb;
      
      // 1. Channel curves (Red, Green, Blue in R, G, B of LUT)
      rgb.r = texture(uCurvesLut, vec2(rgb.r, 0.5)).r;
      rgb.g = texture(uCurvesLut, vec2(rgb.g, 0.5)).g;
      rgb.b = texture(uCurvesLut, vec2(rgb.b, 0.5)).b;
      
      // 2. Master curve (stored in Alpha of LUT)
      rgb.r = texture(uCurvesLut, vec2(rgb.r, 0.5)).a;
      rgb.g = texture(uCurvesLut, vec2(rgb.g, 0.5)).a;
      rgb.b = texture(uCurvesLut, vec2(rgb.b, 0.5)).a;
      
      finalColor = vec4(rgb, color.a);
  }
`;

export class CurvesFilter extends Filter {
  constructor(lutTexture: Texture) {
    super({
      glProgram: GlProgram.from({
        fragment: curvesFragment,
        vertex: defaultFilterVert,
      }),
      resources: {
        uCurvesLut: lutTexture.source,
      }
    });
  }
}

/**
 * Applies WebGL-based filters to an image element and returns a base64 png data URL.
 */
export async function applyPixiAdjustments(
  imageElement: HTMLImageElement | HTMLCanvasElement,
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

  // Store previous children for cleanup
  const previousChildren = [...app.stage.children];

  // Clear the stage
  app.stage.removeChildren();

  // Destroy previous sprites/textures to prevent memory leaks
  previousChildren.forEach((child) => {
    if (child instanceof Sprite && child.texture) {
      child.texture.destroy(true);
    }
    child.destroy({ children: true });
  });

  // Create texture and sprite
  const texture = Texture.from(imageElement);
  const sprite = new Sprite(texture);

  // Setup color matrix filter (brightness, contrast, etc.)
  const colorMatrix = new ColorMatrixFilter();
  
  // Custom filters list to apply
  const customFilters: Filter[] = [];
  let curvesLutTexture: Texture | null = null;

  // Instantiate specific adjustments
  if (settings.exposure) {
    customFilters.push(new ExposureFilter(settings.exposure.exposure, settings.exposure.offset, settings.exposure.gamma));
  }
  if (settings.vibrance !== undefined && settings.vibrance !== 0) {
    customFilters.push(new VibranceFilter(settings.vibrance / 100)); // Scale -100..100 to -1..1
  }
  if (settings.colorBalance) {
    customFilters.push(new ColorBalanceFilter(settings.colorBalance));
  }
  if (settings.levels) {
    customFilters.push(new LevelsFilter(settings.levels));
  }
  if (settings.curves) {
    curvesLutTexture = createCurvesLutTexture(settings.curves);
    customFilters.push(new CurvesFilter(curvesLutTexture));
  }

  // Chain filters
  sprite.filters = [colorMatrix, ...customFilters];

  app.stage.addChild(sprite);

  let resultDataUrl: string;

  try {
    // Apply default transformations
    colorMatrix.reset();

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
    resultDataUrl = await app.renderer.extract.base64(app.stage);
  } catch (error) {
    throw error;
  } finally {
    // Guaranteed GPU cleanup
    try {
      if (sprite.parent) {
        sprite.parent.removeChild(sprite);
      }
      texture.destroy(true);
      sprite.destroy({ children: true });
      colorMatrix.destroy();
      
      customFilters.forEach((f) => f.destroy());
      if (curvesLutTexture) {
        curvesLutTexture.destroy(true);
      }
    } catch (cleanupError) {
      console.warn('PIXI resource cleanup warning:', cleanupError);
    }
  }

  return resultDataUrl;
}

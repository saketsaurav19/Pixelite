import { getGPUDevice } from './gpuDevice';
import { generateNormalMap } from './NormalGenerator';
import { LightingRenderer } from './LightingRenderer';
import { DepthProcessor } from '../ml/DepthProcessor';
import type { Light } from '../../store/types';

export class LightManager {
  private depthProcessor = new DepthProcessor();
  private lightingRenderer = new LightingRenderer();
  private depthCache = new Map<string, GPUTexture>();
  private normalCache = new Map<string, GPUTexture>();
  private depthDataCache = new Map<string, { data: Float32Array; width: number; height: number }>();

  async processLayer(
    layerId: string, 
    imageCanvas: HTMLCanvasElement, 
    quality: 'low' | 'medium' | 'high' = 'medium', 
    isHQ: boolean = false,
    onStatus?: (step: 'depth' | 'simulation', status: 'loading' | 'completed' | 'error') => void
  ) {
    console.log(`[Lighting] processLayer start layer=${layerId} quality=${quality} hq=${isHQ}`);
    const device = await getGPUDevice();
    
    // For HQ, we use larger resolution, otherwise keep it small for real-time
    const res = isHQ ? 512 : quality === 'high' ? 384 : quality === 'low' ? 192 : 256;

    // 1. Get depth map
    let depthTexture: GPUTexture;
    let normalTexture: GPUTexture;

    onStatus?.('depth', 'loading');
    try {
      const depthResult = await this.depthProcessor.estimateDepth(imageCanvas);
      this.depthDataCache.set(layerId, depthResult);
      console.log(`[Lighting] Depth cache stored for layer=${layerId}`);
      depthTexture = this.createTextureFromFloat32(device, depthResult.data, depthResult.width, depthResult.height);
      this.depthCache.set(layerId, depthTexture);
      console.log(`[Lighting] Depth texture created for layer=${layerId}`);
      onStatus?.('depth', 'completed');
    } catch (e) {
      onStatus?.('depth', 'error');
      throw e;
    }

    // 2. Generate normal map
    onStatus?.('simulation', 'loading');
    try {
      normalTexture = await generateNormalMap(depthTexture, res, res);
      this.normalCache.set(layerId, normalTexture);
      console.log(`[Lighting] Normal map generated at ${res}x${res} for layer=${layerId}`);
      // Don't mark simulation as completed yet, as the lighting pass follows
    } catch (e) {
      onStatus?.('simulation', 'error');
      throw e;
    }

    return { depthTexture, normalTexture };
  }

  async render(
    layerId: string,
    albedoCanvas: HTMLCanvasElement,
    lights: Light[],
    layerPosition: { x: number, y: number } = { x: 0, y: 0 },
    ambientIntensity: number = 0.1,
    ambientColor: string = '#ffffff',
    depthScale: number = 200,
    quality: 'low' | 'medium' | 'high' = 'medium',
    isHQ: boolean = false,
    onStatus?: (step: 'depth' | 'simulation' | 'refinement' | 'output', status: 'loading' | 'completed' | 'error') => void
  ): Promise<string> {
    const visibleLights = lights.filter((light) => light.visible);
    console.log(`[Lighting] Render requested layer=${layerId} visibleLights=${visibleLights.length} quality=${quality} hq=${isHQ}`);
    if (visibleLights.length === 0) {
      console.log('[Lighting] No visible lights, returning original layer image');
      return albedoCanvas.toDataURL();
    }

    try {
      const device = await getGPUDevice();
      const width = albedoCanvas.width;
      const height = albedoCanvas.height;

      let depthTexture = this.depthCache.get(layerId);
      let normalTexture = this.normalCache.get(layerId);

      if (!depthTexture || !normalTexture || isHQ) {
        console.log(`[Lighting] Cache miss or HQ rerender for layer=${layerId}, rebuilding depth and normals`);
        const result = await this.processLayer(layerId, albedoCanvas, quality, isHQ, onStatus);
        depthTexture = result.depthTexture;
        normalTexture = result.normalTexture;
      } else {
        console.log(`[Lighting] Reusing cached depth and normal textures for layer=${layerId}`);
        onStatus?.('depth', 'completed');
      }

      onStatus?.('simulation', 'loading');
      const albedoTexture = this.createTextureFromCanvas(device, albedoCanvas);
      console.log(`[Lighting] Albedo texture created ${width}x${height}`);

      const resultTexture = await this.lightingRenderer.renderLighting(
        albedoTexture,
        normalTexture,
        visibleLights,
        width,
        height,
        layerPosition.x,
        layerPosition.y,
        ambientIntensity,
        ambientColor,
        depthScale
      );
      console.log(`[Lighting] GPU lighting pass complete for layer=${layerId}`);
      onStatus?.('simulation', 'completed');

      // 3. Refinement Pass
      onStatus?.('refinement', 'loading');
      const litDataUrl = await this.textureToDataUrl(device, resultTexture, width, height);
      const refinedDataUrl = await this.applyRefinement(litDataUrl);
      onStatus?.('refinement', 'completed');

      onStatus?.('output', 'completed');
      return refinedDataUrl;
    } catch (error) {
      console.error('[Lighting] GPU lighting failed, falling back to CPU renderer', error);
      onStatus?.('simulation', 'error');
      
      const depthResult = this.depthDataCache.get(layerId) ?? await this.depthProcessor.estimateDepth(albedoCanvas);
      this.depthDataCache.set(layerId, depthResult);
      
      console.log(`[Lighting] CPU fallback render start for layer=${layerId}`);
      const fallbackResult = await this.renderFallback2D(albedoCanvas, depthResult, visibleLights, ambientIntensity);
      
      onStatus?.('refinement', 'completed');
      onStatus?.('output', 'completed');
      return fallbackResult;
    }
  }

  private async applyRefinement(dataUrl: string): Promise<string> {
    console.log('[Lighting] Applying AI-inspired refinement pass');
    // Simulated refinement: slight sharpening and contrast enhancement
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        
        // Apply a subtle contrast boost using globalCompositeOperation
        ctx.globalCompositeOperation = 'overlay';
        ctx.globalAlpha = 0.15;
        ctx.drawImage(img, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;

        resolve(canvas.toDataURL());
      };
      img.src = dataUrl;
    });
  }

  async getDepthPreviewDataUrl(layerId: string, imageCanvas: HTMLCanvasElement): Promise<string> {
    console.log(`[Lighting] Generating depth preview for layer=${layerId}`);
    const depthResult = this.depthDataCache.get(layerId) ?? await this.depthProcessor.estimateDepth(imageCanvas);
    this.depthDataCache.set(layerId, depthResult);
    return this.depthDataToDataUrl(depthResult, imageCanvas.width, imageCanvas.height);
  }

  private renderFallback2D(
    albedoCanvas: HTMLCanvasElement,
    depthResult: { data: Float32Array; width: number; height: number },
    lights: Light[],
    ambientIntensity: number
  ): string {
    console.log('[Lighting] CPU fallback shading in progress');
    const width = albedoCanvas.width;
    const height = albedoCanvas.height;
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;

    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      return albedoCanvas.toDataURL();
    }

    ctx.drawImage(albedoCanvas, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const pixels = imageData.data;
    const { data: depthData, width: depthWidth, height: depthHeight } = depthResult;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const u = Math.min(depthWidth - 1, Math.max(0, Math.round((x / Math.max(1, width - 1)) * (depthWidth - 1))));
        const v = Math.min(depthHeight - 1, Math.max(0, Math.round((y / Math.max(1, height - 1)) * (depthHeight - 1))));
        const center = depthData[v * depthWidth + u] ?? 0;
        const left = depthData[v * depthWidth + Math.max(0, u - 1)] ?? center;
        const right = depthData[v * depthWidth + Math.min(depthWidth - 1, u + 1)] ?? center;
        const top = depthData[Math.max(0, v - 1) * depthWidth + u] ?? center;
        const bottom = depthData[Math.min(depthHeight - 1, v + 1) * depthWidth + u] ?? center;

        const nx = -(right - left) * 5;
        const ny = -(bottom - top) * 5;
        const nz = 1;
        const normalLength = Math.hypot(nx, ny, nz) || 1;
        const normalX = nx / normalLength;
        const normalY = ny / normalLength;
        const normalZ = nz / normalLength;

        let totalLight = ambientIntensity;
        for (const light of lights) {
          const lx = light.position.x - x;
          const ly = light.position.y - y;
          const lz = light.position.z - center * 255;
          const lightDistance = Math.hypot(lx, ly, lz) || 1;
          const dirX = lx / lightDistance;
          const dirY = ly / lightDistance;
          const dirZ = lz / lightDistance;

          let attenuation = 0;
          if (light.falloff === 'linear') {
            attenuation = Math.max(0, 1 - lightDistance / Math.max(light.radius, 1));
          } else {
            const d = lightDistance / Math.max(light.radius, 1);
            attenuation = 1 / (1 + 2 * d + d * d);
          }

          const diffuse = Math.max(0, normalX * dirX + normalY * dirY + normalZ * dirZ);
          
          // Specular (Blinn-Phong)
          const vx = (width / 2) - x;
          const vy = (height / 2) - y;
          const vz = 1000 - center * 255;
          const vLen = Math.hypot(vx, vy, vz) || 1;
          const hx = (dirX + vx / vLen);
          const hy = (dirY + vy / vLen);
          const hz = (dirZ + vz / vLen);
          const hLen = Math.hypot(hx, hy, hz) || 1;
          const spec = Math.pow(Math.max(0, (normalX * hx / hLen + normalY * hy / hLen + normalZ * hz / hLen)), 32);
          const specular = 0.5 * spec;

          totalLight += light.intensity * attenuation * (diffuse + specular);
        }

        const idx = (y * width + x) * 4;
        const lightScale = Math.max(0, totalLight);
        pixels[idx] = Math.min(255, pixels[idx] * lightScale);
        pixels[idx + 1] = Math.min(255, pixels[idx + 1] * lightScale);
        pixels[idx + 2] = Math.min(255, pixels[idx + 2] * lightScale);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    console.log('[Lighting] CPU fallback shading complete');
    return outputCanvas.toDataURL();
  }

  private depthDataToDataUrl(depthResult: { data: Float32Array; width: number; height: number }, outputWidth: number, outputHeight: number): string {
    const { data: depthData, width: sourceWidth, height: sourceHeight } = depthResult;
    const depthCanvas = document.createElement('canvas');
    depthCanvas.width = outputWidth;
    depthCanvas.height = outputHeight;
    const ctx = depthCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not create depth preview canvas');
    }

    const imageData = ctx.createImageData(outputWidth, outputHeight);
    for (let y = 0; y < outputHeight; y++) {
      for (let x = 0; x < outputWidth; x++) {
        const u = Math.min(sourceWidth - 1, Math.max(0, Math.round((x / Math.max(1, outputWidth - 1)) * (sourceWidth - 1))));
        const v = Math.min(sourceHeight - 1, Math.max(0, Math.round((y / Math.max(1, outputHeight - 1)) * (sourceHeight - 1))));
        const value = Math.max(0, Math.min(255, Math.round((depthData[v * sourceWidth + u] ?? 0) * 255)));
        const idx = (y * outputWidth + x) * 4;
        imageData.data[idx] = value;
        imageData.data[idx + 1] = value;
        imageData.data[idx + 2] = value;
        imageData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
    console.log(`[Lighting] Depth preview ready ${outputWidth}x${outputHeight}`);
    return depthCanvas.toDataURL();
  }

  private createTextureFromFloat32(device: GPUDevice, data: Float32Array, width: number, height: number): GPUTexture {
    const texture = device.createTexture({
      size: [width, height],
      format: 'r32float',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    device.queue.writeTexture(
      { texture },
      data as BufferSource,
      { bytesPerRow: width * 4 },
      [width, height]
    );

    return texture;
  }

  private createTextureFromCanvas(device: GPUDevice, canvas: HTMLCanvasElement): GPUTexture {
    const texture = device.createTexture({
      size: [canvas.width, canvas.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture },
      [canvas.width, canvas.height]
    );

    return texture;
  }

  private async textureToDataUrl(device: GPUDevice, texture: GPUTexture, width: number, height: number): Promise<string> {
    console.log(`[Lighting] Reading GPU result texture back to data URL ${width}x${height}`);
    const bytesPerRow = Math.ceil((width * 4) / 256) * 256;
    const buffer = device.createBuffer({
      size: bytesPerRow * height,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
    });

    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer(
      { texture },
      { buffer, bytesPerRow },
      [width, height]
    );
    device.queue.submit([encoder.finish()]);

    await buffer.mapAsync(GPUMapMode.READ);
    const arrayBuffer = buffer.getMappedRange();
    const data = new Uint8ClampedArray(arrayBuffer);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(width, height);

    // Copy data accounting for bytesPerRow padding
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const srcIdx = y * bytesPerRow + x * 4;
        const dstIdx = (y * width + x) * 4;
        imageData.data[dstIdx] = data[srcIdx];
        imageData.data[dstIdx + 1] = data[srcIdx + 1];
        imageData.data[dstIdx + 2] = data[srcIdx + 2];
        imageData.data[dstIdx + 3] = data[srcIdx + 3];
      }
    }

    ctx.putImageData(imageData, 0, 0);
    buffer.unmap();
    console.log('[Lighting] GPU result converted to data URL');

    return canvas.toDataURL();
  }
}

export const lightManager = new LightManager();

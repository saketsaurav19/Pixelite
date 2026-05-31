import * as ort from 'onnxruntime-web';

export class DepthProcessor {
  private session: any = null;
  private sessionProvider: 'webgpu' | 'wasm' | null = null;
  private readonly inputWidth = 256;
  private readonly inputHeight = 256;
  private modelUrls: string[] = [
    '/models/midas-official.onnx',
    '/models/midas-v21-small.onnx'
  ];

  async init() {
    if (this.session) return;

    console.log('[Lighting][Depth] Initializing depth session');

    let lastError: unknown = null;
    for (const modelUrl of this.modelUrls) {
      console.log(`[Lighting][Depth] Trying model source: ${modelUrl}`);
      try {
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm']
        });
        this.sessionProvider = 'wasm';
        console.log(`[Lighting][Depth] Loaded model with WASM: ${modelUrl}`);
        return;
      } catch (e) {
        lastError = e;
        console.warn(`Failed to initialize ONNX model at ${modelUrl} with WASM`, e);
      }

      try {
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['webgpu', 'wasm'],
          graphOptimizationLevel: 'all'
        });
        this.sessionProvider = 'webgpu';
        console.log(`[Lighting][Depth] Loaded model with WebGPU/WASM: ${modelUrl}`);
        return;
      } catch (e) {
        lastError = e;
        console.warn(`Failed to initialize ONNX model at ${modelUrl} with WebGPU/WASM`, e);
      }
    }

    throw new Error(`Unable to load depth model from configured sources. ${String(lastError)}`);
  }

  private async recreateSessionWithWasm() {
    console.warn('[Lighting][Depth] Recreating depth session with WASM fallback');
    this.session = null;
    this.sessionProvider = null;

    let lastError: unknown = null;
    for (const modelUrl of this.modelUrls) {
      try {
        this.session = await ort.InferenceSession.create(modelUrl, {
          executionProviders: ['wasm']
        });
        this.sessionProvider = 'wasm';
        console.log(`[Lighting][Depth] Recovered depth session with WASM: ${modelUrl}`);
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(`Failed to recreate WASM depth session. ${String(lastError)}`);
  }

  async estimateDepth(imageCanvas: HTMLCanvasElement): Promise<{ data: Float32Array; width: number; height: number }> {
    const width = this.inputWidth;
    const height = this.inputHeight;
    console.log(`[Lighting][Depth] Estimating depth for ${imageCanvas.width}x${imageCanvas.height}`);

    // Resize and preprocess image
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const ctx = tempCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context');

    ctx.drawImage(imageCanvas, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);

    try {
      if (!this.session) await this.init();

      // Normalize to [-1, 1] as expected by MiDaS
      const input = new Float32Array(width * height * 3);
      for (let i = 0; i < imageData.data.length / 4; i++) {
        input[i] = (imageData.data[i * 4] / 255.0 - 0.485) / 0.229;
        input[i + width * height] = (imageData.data[i * 4 + 1] / 255.0 - 0.456) / 0.224;
        input[i + width * height * 2] = (imageData.data[i * 4 + 2] / 255.0 - 0.406) / 0.225;
      }

      const inputTensor = new ort.Tensor('float32', input, [1, 3, height, width]);
      const feeds = { [this.session!.inputNames[0]]: inputTensor };
      console.log('[Lighting][Depth] Running ONNX inference');

      let results: any;
      try {
        results = await this.session!.run(feeds);
      } catch (error) {
        console.error(`[Lighting][Depth] Inference failed using provider=${this.sessionProvider ?? 'unknown'}`, error);
        if (this.sessionProvider === 'webgpu') {
          await this.recreateSessionWithWasm();
          console.log('[Lighting][Depth] Retrying inference with WASM');
          results = await this.session!.run(feeds);
        } else {
          throw error;
        }
      }
      const output = results[this.session!.outputNames[0]].data as Float32Array;
      console.log(`[Lighting][Depth] Inference complete with ${output.length} depth samples`);

      // Normalize output to [0, 1]
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < output.length; i++) {
        if (output[i] < min) min = output[i];
        if (output[i] > max) max = output[i];
      }

      const range = max - min;
      const normalizedOutput = new Float32Array(output.length);
      for (let i = 0; i < output.length; i++) {
        normalizedOutput[i] = (output[i] - min) / (range || 1);
      }

      console.log(`[Lighting][Depth] Normalized depth range min=${min.toFixed(4)} max=${max.toFixed(4)}`);

      // Upscale the 256x256 depth map back to the original image dimensions
      const originalWidth = imageCanvas.width;
      const originalHeight = imageCanvas.height;

      const upscaleCanvas = document.createElement('canvas');
      upscaleCanvas.width = originalWidth;
      upscaleCanvas.height = originalHeight;
      const upscaleCtx = upscaleCanvas.getContext('2d')!;

      // Convert normalized float data to grayscale for upscaling
      const depthImage = ctx.createImageData(width, height);
      for (let i = 0; i < normalizedOutput.length; i++) {
        const val = Math.floor(normalizedOutput[i] * 255);
        depthImage.data[i * 4] = val;
        depthImage.data[i * 4 + 1] = val;
        depthImage.data[i * 4 + 2] = val;
        depthImage.data[i * 4 + 3] = 255;
      }
      ctx.putImageData(depthImage, 0, 0);

      // Draw 256x256 depth map onto full-size canvas
      // We first draw it at 0,0 to fill the background and avoid black gaps on the edges
      upscaleCtx.drawImage(tempCanvas, 0, 0, originalWidth, originalHeight);

      // Then apply the 10px right shift for perfect subject alignment as requested
      // This ensures the "color appearance" artifact on the left corner is filled
      upscaleCtx.drawImage(tempCanvas, 10, 0, originalWidth, originalHeight);
      const upscaledData = upscaleCtx.getImageData(0, 0, originalWidth, originalHeight);

      // Convert back to Float32
      const finalDepth = new Float32Array(originalWidth * originalHeight);
      for (let i = 0; i < upscaledData.data.length / 4; i++) {
        finalDepth[i] = upscaledData.data[i * 4] / 255.0;
      }

      return { data: finalDepth, width: originalWidth, height: originalHeight };
    } catch (error) {
      console.warn('[Depth] ONNX depth failed, using heuristic fallback depth map', error);
      return { data: this.createHeuristicDepth(imageData, width, height), width, height };
    }
  }

  private createHeuristicDepth(imageData: ImageData, width: number, height: number): Float32Array {
    const result = new Float32Array(width * height);
    const luminance = new Float32Array(width * height);
    const gradient = new Float32Array(width * height);
    const borderThickness = Math.max(8, Math.floor(Math.min(width, height) * 0.04));
    let borderSum = 0;
    let borderCount = 0;

    for (let i = 0; i < width * height; i++) {
      const r = imageData.data[i * 4] / 255;
      const g = imageData.data[i * 4 + 1] / 255;
      const b = imageData.data[i * 4 + 2] / 255;
      luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (x < borderThickness || x >= width - borderThickness || y < borderThickness || y >= height - borderThickness) {
          borderSum += luminance[y * width + x];
          borderCount++;
        }
      }
    }

    const borderMean = borderSum / Math.max(1, borderCount);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const current = luminance[idx];
        const left = luminance[y * width + Math.max(0, x - 1)];
        const right = luminance[y * width + Math.min(width - 1, x + 1)];
        const top = luminance[Math.max(0, y - 1) * width + x];
        const bottom = luminance[Math.min(height - 1, y + 1) * width + x];
        gradient[idx] = Math.min(1, Math.abs(right - left) + Math.abs(bottom - top));
        const centerX = (x / Math.max(1, width - 1)) * 2 - 1;
        const centerY = (y / Math.max(1, height - 1)) * 2 - 1;
        const radial = Math.max(0, 1 - Math.sqrt(centerX * centerX * 0.9 + centerY * centerY * 1.2));
        const verticalBias = 1 - y / Math.max(1, height - 1);
        const foregroundFromBg = Math.min(1, Math.abs(current - borderMean) * 2.4);
        const detailBoost = Math.min(1, gradient[idx] * 2.2);

        // Favor central textured subjects and de-emphasize flat border-like backgrounds.
        result[idx] = Math.max(
          0,
          Math.min(
            1,
            foregroundFromBg * 0.42 +
            radial * 0.33 +
            detailBoost * 0.17 +
            verticalBias * 0.08
          )
        );
      }
    }

    // Smooth the map so it reads more like depth and less like edge noise.
    const smoothed = new Float32Array(result.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;
        for (let oy = -2; oy <= 2; oy++) {
          for (let ox = -2; ox <= 2; ox++) {
            const sx = Math.min(width - 1, Math.max(0, x + ox));
            const sy = Math.min(height - 1, Math.max(0, y + oy));
            const dist = Math.abs(ox) + Math.abs(oy);
            const weight = dist === 0 ? 4 : dist === 1 ? 2 : 1;
            sum += result[sy * width + sx] * weight;
            weightSum += weight;
          }
        }
        smoothed[y * width + x] = sum / weightSum;
      }
    }

    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < smoothed.length; i++) {
      if (smoothed[i] < min) min = smoothed[i];
      if (smoothed[i] > max) max = smoothed[i];
    }

    const range = max - min || 1;
    for (let i = 0; i < smoothed.length; i++) {
      // Slight gamma curve to make foreground separation more visible.
      result[i] = Math.pow((smoothed[i] - min) / range, 0.82);
    }

    console.log('[Depth] Heuristic depth fallback generated successfully');
    return result;
  }
}

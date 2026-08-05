export class FilterService {
  /**
   * Average Blur: Averages the entire image (or a huge box)
   */
  static average(src: ImageData): ImageData {
    const radius = Math.max(src.width, src.height);
    return this.boxBlur(src, radius);
  }

  /**
   * Box Blur: simple blur
   */
  static boxBlur(src: ImageData, radius: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    if (radius <= 0) {
      dstData.set(srcData);
      return dst;
    }

    const temp = new Uint8ClampedArray(w * h * 4);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const yOffset = y * w * 4;
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const nx = x + k;
          if (nx >= 0 && nx < w) {
            const idx = yOffset + nx * 4;
            r += srcData[idx];
            g += srcData[idx + 1];
            b += srcData[idx + 2];
            a += srcData[idx + 3];
            count++;
          }
        }
        const idx = yOffset + x * 4;
        temp[idx] = r / count;
        temp[idx + 1] = g / count;
        temp[idx + 2] = b / count;
        temp[idx + 3] = a / count;
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const ny = y + k;
          if (ny >= 0 && ny < h) {
            const idx = (ny * w + x) * 4;
            r += temp[idx];
            g += temp[idx + 1];
            b += temp[idx + 2];
            a += temp[idx + 3];
            count++;
          }
        }
        const idx = (y * w + x) * 4;
        dstData[idx] = r / count;
        dstData[idx + 1] = g / count;
        dstData[idx + 2] = b / count;
        dstData[idx + 3] = a / count;
      }
    }

    return dst;
  }

  /**
   * Motion Blur
   */
  static motionBlur(src: ImageData, radius: number, angle: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    if (radius <= 0) {
      dstData.set(srcData);
      return dst;
    }

    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    const dy = Math.sin(radians);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, count = 0;
        for (let k = -radius; k <= radius; k++) {
          const nx = Math.round(x + k * dx);
          const ny = Math.round(y + k * dy);
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const idx = (ny * w + nx) * 4;
            r += srcData[idx];
            g += srcData[idx + 1];
            b += srcData[idx + 2];
            a += srcData[idx + 3];
            count++;
          }
        }
        const idx = (y * w + x) * 4;
        dstData[idx] = r / count;
        dstData[idx + 1] = g / count;
        dstData[idx + 2] = b / count;
        dstData[idx + 3] = a / count;
      }
    }

    return dst;
  }

  /**
   * Add Noise
   */
  static addNoise(src: ImageData, amount: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;

    for (let i = 0; i < srcData.length; i += 4) {
      const noise = (Math.random() - 0.5) * amount * 2.55;
      dstData[i] = Math.min(255, Math.max(0, srcData[i] + noise));
      dstData[i + 1] = Math.min(255, Math.max(0, srcData[i + 1] + noise));
      dstData[i + 2] = Math.min(255, Math.max(0, srcData[i + 2] + noise));
      dstData[i + 3] = srcData[i + 3];
    }
    return dst;
  }

  /**
   * Convolve 3x3
   */
  static convolve(src: ImageData, kernel: number[], offset = 0): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const nx = Math.min(w - 1, Math.max(0, x + kx));
            const ny = Math.min(h - 1, Math.max(0, y + ky));
            const idx = (ny * w + nx) * 4;
            const kVal = kernel[(ky + 1) * 3 + (kx + 1)];
            r += srcData[idx] * kVal;
            g += srcData[idx + 1] * kVal;
            b += srcData[idx + 2] * kVal;
          }
        }
        const idx = (y * w + x) * 4;
        dstData[idx] = Math.min(255, Math.max(0, r + offset));
        dstData[idx + 1] = Math.min(255, Math.max(0, g + offset));
        dstData[idx + 2] = Math.min(255, Math.max(0, b + offset));
        dstData[idx + 3] = srcData[idx + 3];
      }
    }
    return dst;
  }

  /**
   * Median Filter
   */
  static median(src: ImageData, radius: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const rArr: number[] = [];
        const gArr: number[] = [];
        const bArr: number[] = [];
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const idx = (ny * w + nx) * 4;
              rArr.push(srcData[idx]);
              gArr.push(srcData[idx + 1]);
              gArr.push(srcData[idx + 2]);
            }
          }
        }
        rArr.sort((a, b) => a - b);
        gArr.sort((a, b) => a - b);
        bArr.sort((a, b) => a - b);

        const mid = Math.floor(rArr.length / 2);
        const idx = (y * w + x) * 4;
        dstData[idx] = rArr[mid];
        dstData[idx + 1] = gArr[mid];
        dstData[idx + 2] = bArr[mid];
        dstData[idx + 3] = srcData[idx + 3];
      }
    }
    return dst;
  }

  /**
   * High Pass
   */
  static highPass(src: ImageData, radius: number): ImageData {
    const blurred = this.boxBlur(src, radius);
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const blData = blurred.data;
    const dstData = dst.data;

    for (let i = 0; i < srcData.length; i += 4) {
      dstData[i] = Math.min(255, Math.max(0, srcData[i] - blData[i] + 128));
      dstData[i + 1] = Math.min(255, Math.max(0, srcData[i + 1] - blData[i + 1] + 128));
      dstData[i + 2] = Math.min(255, Math.max(0, srcData[i + 2] - blData[i + 2] + 128));
      dstData[i + 3] = srcData[i + 3];
    }
    return dst;
  }

  /**
   * Min/Max Filter (Dilation / Erosion)
   */
  static minMax(src: ImageData, radius: number, findMax: boolean): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let rLimit = findMax ? -1 : 256;
        let gLimit = findMax ? -1 : 256;
        let bLimit = findMax ? -1 : 256;
        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const idx = (ny * w + nx) * 4;
              const rVal = srcData[idx];
              const gVal = srcData[idx + 1];
              const bVal = srcData[idx + 2];
              if (findMax) {
                if (rVal > rLimit) rLimit = rVal;
                if (gVal > gLimit) gLimit = gVal;
                if (bVal > bLimit) bLimit = bVal;
              } else {
                if (rVal < rLimit) rLimit = rVal;
                if (gVal < gLimit) gLimit = gVal;
                if (bVal < bLimit) bLimit = bVal;
              }
            }
          }
        }
        const idx = (y * w + x) * 4;
        dstData[idx] = rLimit;
        dstData[idx + 1] = gLimit;
        dstData[idx + 2] = bLimit;
        dstData[idx + 3] = srcData[idx + 3];
      }
    }
    return dst;
  }

  /**
   * Pinch
   */
  static pinch(src: ImageData, strength: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;
    const cx = w / 2;
    const cy = h / 2;
    const maxRadius = Math.min(cx, cy);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < maxRadius) {
          const progress = dist / maxRadius;
          const factor = Math.pow(progress, strength);
          const sx = Math.round(cx + dx * factor);
          const sy = Math.round(cy + dy * factor);
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
            const srcIdx = (sy * w + sx) * 4;
            const dstIdx = (y * w + x) * 4;
            dstData[dstIdx] = srcData[srcIdx];
            dstData[dstIdx + 1] = srcData[srcIdx + 1];
            dstData[dstIdx + 2] = srcData[srcIdx + 2];
            dstData[dstIdx + 3] = srcData[srcIdx + 3];
          }
        } else {
          const idx = (y * w + x) * 4;
          dstData[idx] = srcData[idx];
          dstData[idx + 1] = srcData[idx + 1];
          dstData[idx + 2] = srcData[idx + 2];
          dstData[idx + 3] = srcData[idx + 3];
        }
      }
    }
    return dst;
  }

  /**
   * Ripple
   */
  static ripple(src: ImageData, wavelength: number, amplitude: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;
    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const shift = amplitude * Math.sin(dist / (wavelength || 1));
        const factor = (dist + shift) / (dist || 1);
        const sx = Math.round(cx + dx * factor);
        const sy = Math.round(cy + dy * factor);

        const dstIdx = (y * w + x) * 4;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const srcIdx = (sy * w + sx) * 4;
          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx + 1] = srcData[srcIdx + 1];
          dstData[dstIdx + 2] = srcData[srcIdx + 2];
          dstData[dstIdx + 3] = srcData[srcIdx + 3];
        }
      }
    }
    return dst;
  }

  /**
   * Wave
   */
  static wave(src: ImageData, frequency: number, amplitude: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x;
        const sy = Math.round(y + amplitude * Math.sin(x / (frequency || 1)));
        const dstIdx = (y * w + x) * 4;
        if (sy >= 0 && sy < h) {
          const srcIdx = (sy * w + sx) * 4;
          dstData[dstIdx] = srcData[srcIdx];
          dstData[dstIdx + 1] = srcData[srcIdx + 1];
          dstData[dstIdx + 2] = srcData[srcIdx + 2];
          dstData[dstIdx + 3] = srcData[srcIdx + 3];
        }
      }
    }
    return dst;
  }

  /**
   * Unsharp Mask (Sharpening by high-pass mixing)
   */
  static unsharpMask(src: ImageData, radius: number, amount: number): ImageData {
    const blurred = this.boxBlur(src, radius);
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const blData = blurred.data;
    const dstData = dst.data;
    const factor = amount / 100;

    for (let i = 0; i < srcData.length; i += 4) {
      dstData[i] = Math.min(255, Math.max(0, srcData[i] + (srcData[i] - blData[i]) * factor));
      dstData[i + 1] = Math.min(255, Math.max(0, srcData[i + 1] + (srcData[i + 1] - blData[i + 1]) * factor));
      dstData[i + 2] = Math.min(255, Math.max(0, srcData[i + 2] + (srcData[i + 2] - blData[i + 2]) * factor));
      dstData[i + 3] = srcData[i + 3];
    }
    return dst;
  }

  /**
   * Oil Paint (simplification: simplified kuwahara or local color bucket grouping)
   */
  static oilPaint(src: ImageData, radius: number, intensity: number): ImageData {
    const dst = new ImageData(src.width, src.height);
    const srcData = src.data;
    const dstData = dst.data;
    const w = src.width;
    const h = src.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const intensityCount = new Int32Array(intensity + 1);
        const avgR = new Float32Array(intensity + 1);
        const avgG = new Float32Array(intensity + 1);
        const avgB = new Float32Array(intensity + 1);

        for (let ky = -radius; ky <= radius; ky++) {
          for (let kx = -radius; kx <= radius; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const idx = (ny * w + nx) * 4;
              const r = srcData[idx];
              const g = srcData[idx + 1];
              const b = srcData[idx + 2];
              
              // Calculate intensity level
              const curIntensity = Math.floor((((r + g + b) / 3) * intensity) / 255);
              intensityCount[curIntensity]++;
              avgR[curIntensity] += r;
              avgG[curIntensity] += g;
              avgB[curIntensity] += b;
            }
          }
        }

        // Find the intensity level with the maximum count
        let maxCount = 0;
        let maxIdx = 0;
        for (let i = 0; i <= intensity; i++) {
          if (intensityCount[i] > maxCount) {
            maxCount = intensityCount[i];
            maxIdx = i;
          }
        }

        const idx = (y * w + x) * 4;
        const count = intensityCount[maxIdx] || 1;
        dstData[idx] = avgR[maxIdx] / count;
        dstData[idx + 1] = avgG[maxIdx] / count;
        dstData[idx + 2] = avgB[maxIdx] / count;
        dstData[idx + 3] = srcData[idx + 3];
      }
    }
    return dst;
  }
}

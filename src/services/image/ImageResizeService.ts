export class ImageResizeService {
  /**
   * Resamples an ImageData object using nearest neighbor interpolation.
   */
  static resampleNearest(src: ImageData, dstW: number, dstH: number): ImageData {
    const dst = new ImageData(dstW, dstH);
    const srcData = src.data;
    const dstData = dst.data;
    const srcW = src.width;
    const srcH = src.height;

    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      const srcY = Math.floor(y * yRatio);
      const dstYOffset = y * dstW * 4;
      const srcYOffset = srcY * srcW * 4;
      for (let x = 0; x < dstW; x++) {
        const srcX = Math.floor(x * xRatio);
        const dstIdx = dstYOffset + x * 4;
        const srcIdx = srcYOffset + srcX * 4;

        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }

    return dst;
  }

  /**
   * Resamples an ImageData object using bilinear interpolation.
   */
  static resampleBilinear(src: ImageData, dstW: number, dstH: number): ImageData {
    const dst = new ImageData(dstW, dstH);
    const srcData = src.data;
    const dstData = dst.data;
    const srcW = src.width;
    const srcH = src.height;

    const xRatio = dstW > 1 ? (srcW - 1) / (dstW - 1) : 0;
    const yRatio = dstH > 1 ? (srcH - 1) / (dstH - 1) : 0;

    for (let y = 0; y < dstH; y++) {
      const srcY = y * yRatio;
      const yL = Math.floor(srcY);
      const yH = Math.ceil(srcY);
      const weightY = srcY - yL;
      const dstYOffset = y * dstW * 4;

      for (let x = 0; x < dstW; x++) {
        const srcX = x * xRatio;
        const xL = Math.floor(srcX);
        const xH = Math.ceil(srcX);
        const weightX = srcX - xL;

        const dstIdx = dstYOffset + x * 4;

        const idx00 = (yL * srcW + xL) * 4;
        const idx10 = (yL * srcW + xH) * 4;
        const idx01 = (yH * srcW + xL) * 4;
        const idx11 = (yH * srcW + xH) * 4;

        for (let c = 0; c < 4; c++) {
          const val =
            srcData[idx00 + c] * (1 - weightX) * (1 - weightY) +
            srcData[idx10 + c] * weightX * (1 - weightY) +
            srcData[idx01 + c] * (1 - weightX) * weightY +
            srcData[idx11 + c] * weightX * weightY;
          dstData[dstIdx + c] = Math.round(val);
        }
      }
    }

    return dst;
  }

  /**
   * Resamples an ImageData object using bicubic interpolation.
   */
  static resampleBicubic(src: ImageData, dstW: number, dstH: number): ImageData {
    const cubic = (x: number) => {
      const ax = Math.abs(x);
      if (ax <= 1) {
        return (1.5 * ax - 2.5) * ax * ax + 1;
      } else if (ax < 2) {
        return ((-0.5 * ax + 2.5) * ax - 4) * ax + 2;
      }
      return 0;
    };

    const dst = new ImageData(dstW, dstH);
    const srcData = src.data;
    const dstData = dst.data;
    const srcW = src.width;
    const srcH = src.height;

    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      const srcY = y * yRatio - 0.5;
      const yL = Math.floor(srcY);
      const dstYOffset = y * dstW * 4;

      for (let x = 0; x < dstW; x++) {
        const srcX = x * xRatio - 0.5;
        const xL = Math.floor(srcX);
        const dstIdx = dstYOffset + x * 4;

        let r = 0, g = 0, b = 0, a = 0;
        let totalWeight = 0;

        for (let j = -1; j <= 2; j++) {
          const yy = Math.max(0, Math.min(srcH - 1, yL + j));
          const weightY = cubic(srcY - (yL + j));
          const srcYOffset = yy * srcW * 4;

          for (let i = -1; i <= 2; i++) {
            const xx = Math.max(0, Math.min(srcW - 1, xL + i));
            const weightX = cubic(srcX - (xL + i));
            const weight = weightX * weightY;

            const idx = srcYOffset + xx * 4;

            r += srcData[idx] * weight;
            g += srcData[idx + 1] * weight;
            b += srcData[idx + 2] * weight;
            a += srcData[idx + 3] * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight === 0) totalWeight = 1;
        dstData[dstIdx] = Math.max(0, Math.min(255, Math.round(r / totalWeight)));
        dstData[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(g / totalWeight)));
        dstData[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(b / totalWeight)));
        dstData[dstIdx + 3] = Math.max(0, Math.min(255, Math.round(a / totalWeight)));
      }
    }

    return dst;
  }

  /**
   * Resamples an ImageData object using Lanczos windowed sinc interpolation.
   */
  static resampleLanczos(src: ImageData, dstW: number, dstH: number): ImageData {
    const a = 3; // Lanczos filter size (3 lobed)
    const sinc = (x: number) => {
      if (x === 0) return 1;
      const pix = Math.PI * x;
      return Math.sin(pix) / pix;
    };
    const lanczos = (x: number) => {
      const ax = Math.abs(x);
      if (ax === 0) return 1;
      if (ax < a) return sinc(ax) * sinc(ax / a);
      return 0;
    };

    const dst = new ImageData(dstW, dstH);
    const srcData = src.data;
    const dstData = dst.data;
    const srcW = src.width;
    const srcH = src.height;

    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      const srcY = y * yRatio - 0.5;
      const yL = Math.floor(srcY);
      const dstYOffset = y * dstW * 4;

      for (let x = 0; x < dstW; x++) {
        const srcX = x * xRatio - 0.5;
        const xL = Math.floor(srcX);
        const dstIdx = dstYOffset + x * 4;

        let r = 0, g = 0, b = 0, aWeight = 0;
        let totalWeight = 0;

        for (let j = -a + 1; j <= a; j++) {
          const yy = yL + j;
          if (yy < 0 || yy >= srcH) continue;
          const weightY = lanczos(srcY - yy);
          const srcYOffset = yy * srcW * 4;

          for (let i = -a + 1; i <= a; i++) {
            const xx = xL + i;
            if (xx < 0 || xx >= srcW) continue;
            const weightX = lanczos(srcX - xx);
            const weight = weightX * weightY;

            const idx = srcYOffset + xx * 4;

            r += srcData[idx] * weight;
            g += srcData[idx + 1] * weight;
            b += srcData[idx + 2] * weight;
            aWeight += srcData[idx + 3] * weight;
            totalWeight += weight;
          }
        }

        if (totalWeight === 0) totalWeight = 1;
        dstData[dstIdx] = Math.max(0, Math.min(255, Math.round(r / totalWeight)));
        dstData[dstIdx + 1] = Math.max(0, Math.min(255, Math.round(g / totalWeight)));
        dstData[dstIdx + 2] = Math.max(0, Math.min(255, Math.round(b / totalWeight)));
        dstData[dstIdx + 3] = Math.max(0, Math.min(255, Math.round(aWeight / totalWeight)));
      }
    }

    return dst;
  }

  /**
   * Resamples using standard Canvas high-quality rendering.
   */
  static resampleHighQuality(
    img: HTMLImageElement | HTMLCanvasElement,
    dstW: number,
    dstH: number
  ): string {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = dstW;
    tempCanvas.height = dstH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = 'high';
      tempCtx.drawImage(img, 0, 0, dstW, dstH);
    }
    return tempCanvas.toDataURL();
  }

  /**
   * Rescales an image / canvas using the selected resampling method.
   */
  static async resampleImage(
    dataUrl: string,
    dstW: number,
    dstH: number,
    method: 'nearest' | 'bilinear' | 'bicubic' | 'lanczos' | 'high-quality'
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (method === 'high-quality') {
          resolve(this.resampleHighQuality(img, dstW, dstH));
          return;
        }

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width;
        srcCanvas.height = img.height;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) {
          resolve(dataUrl);
          return;
        }
        srcCtx.drawImage(img, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, img.width, img.height);

        let dstData: ImageData;
        switch (method) {
          case 'nearest':
            dstData = this.resampleNearest(srcData, dstW, dstH);
            break;
          case 'bilinear':
            dstData = this.resampleBilinear(srcData, dstW, dstH);
            break;
          case 'bicubic':
            dstData = this.resampleBicubic(srcData, dstW, dstH);
            break;
          case 'lanczos':
            dstData = this.resampleLanczos(srcData, dstW, dstH);
            break;
          default:
            dstData = this.resampleBicubic(srcData, dstW, dstH);
            break;
        }

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = dstW;
        dstCanvas.height = dstH;
        const dstCtx = dstCanvas.getContext('2d');
        if (dstCtx) {
          dstCtx.putImageData(dstData, 0, 0);
          resolve(dstCanvas.toDataURL());
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => {
        resolve(dataUrl);
      };
      img.src = dataUrl;
    });
  }
}

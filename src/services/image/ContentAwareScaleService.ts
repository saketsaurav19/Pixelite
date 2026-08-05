export class ContentAwareScaleService {
  /**
   * Resizes an image using seam carving (Content-Aware Scaling).
   * Supports both reduction and expansion.
   */
  static scale(src: ImageData, targetW: number, targetH: number): ImageData {
    let current = src;

    // 1. Resize width (remove or add vertical seams)
    if (targetW !== current.width) {
      if (targetW < current.width) {
        current = this.removeVerticalSeams(current, current.width - targetW);
      } else {
        current = this.addVerticalSeams(current, targetW - current.width);
      }
    }

    // 2. Resize height (remove or add horizontal seams by transposing, running vertical seam operations, and transposing back)
    if (targetH !== current.height) {
      current = this.transpose(current);
      if (targetH < current.width) { // note: transposed width is original height
        current = this.removeVerticalSeams(current, current.width - targetH);
      } else {
        current = this.addVerticalSeams(current, targetH - current.width);
      }
      current = this.transpose(current);
    }

    return current;
  }

  private static transpose(img: ImageData): ImageData {
    const w = img.width;
    const h = img.height;
    const transposed = new ImageData(h, w);
    const srcData = img.data;
    const dstData = transposed.data;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const srcIdx = (y * w + x) * 4;
        const dstIdx = (x * h + y) * 4;
        dstData[dstIdx] = srcData[srcIdx];
        dstData[dstIdx + 1] = srcData[srcIdx + 1];
        dstData[dstIdx + 2] = srcData[srcIdx + 2];
        dstData[dstIdx + 3] = srcData[srcIdx + 3];
      }
    }
    return transposed;
  }

  /**
   * Removes `count` vertical seams from the image.
   */
  private static removeVerticalSeams(img: ImageData, count: number): ImageData {
    let w = img.width;
    let h = img.height;
    let data = new Uint8ClampedArray(img.data);

    for (let s = 0; s < count; s++) {
      if (w <= 2) break; // Don't shrink below 2px width

      // A. Compute energy map
      const energy = this.computeEnergy(data, w, h);

      // B. Find vertical seam of minimum energy
      const seam = this.findVerticalSeam(energy, w, h);

      // C. Remove the seam from image data
      const nextData = new Uint8ClampedArray((w - 1) * h * 4);
      for (let y = 0; y < h; y++) {
        const seamX = seam[y];
        let dstCol = 0;
        for (let x = 0; x < w; x++) {
          if (x === seamX) continue;
          const srcIdx = (y * w + x) * 4;
          const dstIdx = (y * (w - 1) + dstCol) * 4;
          nextData[dstIdx] = data[srcIdx];
          nextData[dstIdx + 1] = data[srcIdx + 1];
          nextData[dstIdx + 2] = data[srcIdx + 2];
          nextData[dstIdx + 3] = data[srcIdx + 3];
          dstCol++;
        }
      }
      data = nextData;
      w--;
    }

    return new ImageData(data, w, h);
  }

  /**
   * Adds `count` vertical seams to the image.
   */
  private static addVerticalSeams(img: ImageData, count: number): ImageData {
    let w = img.width;
    const h = img.height;
    let data = new Uint8ClampedArray(img.data);

    if (w <= 2) return img;

    // Find the seams to duplicate
    const energy = this.computeEnergy(data, w, h);
    const seams: number[][] = [];
    let tempEnergy = new Float32Array(energy);
    let tempW = w;

    for (let s = 0; s < count; s++) {
      const seam = this.findVerticalSeam(tempEnergy, tempW, h);
      seams.push(seam);
      const nextEnergy = new Float32Array((tempW - 1) * h);
      for (let y = 0; y < h; y++) {
        const seamX = seam[y];
        let dstCol = 0;
        for (let x = 0; x < tempW; x++) {
          if (x === seamX) continue;
          nextEnergy[y * (tempW - 1) + dstCol] = tempEnergy[y * tempW + x];
          dstCol++;
        }
      }
      tempEnergy = nextEnergy;
      tempW--;
    }

    const newW = w + count;
    const nextData = new Uint8ClampedArray(newW * h * 4);

    for (let y = 0; y < h; y++) {
      const rowSeamX = seams.map(seam => seam[y]).sort((a, b) => a - b);
      
      let srcX = 0;
      let dstX = 0;
      let seamIdx = 0;

      while (srcX < w) {
        const srcIdx = (y * w + srcX) * 4;
        const dstIdx = (y * newW + dstX) * 4;
        nextData[dstIdx] = data[srcIdx];
        nextData[dstIdx + 1] = data[srcIdx + 1];
        nextData[dstIdx + 2] = data[srcIdx + 2];
        nextData[dstIdx + 3] = data[srcIdx + 3];
        dstX++;

        if (seamIdx < rowSeamX.length && srcX === rowSeamX[seamIdx]) {
          const nextSrcIdx = (y * w + Math.min(w - 1, srcX + 1)) * 4;
          const dupIdx = (y * newW + dstX) * 4;
          nextData[dupIdx] = Math.round((data[srcIdx] + data[nextSrcIdx]) / 2);
          nextData[dupIdx + 1] = Math.round((data[srcIdx + 1] + data[nextSrcIdx + 1]) / 2);
          nextData[dupIdx + 2] = Math.round((data[srcIdx + 2] + data[nextSrcIdx + 2]) / 2);
          nextData[dupIdx + 3] = Math.round((data[srcIdx + 3] + data[nextSrcIdx + 3]) / 2);
          dstX++;
          seamIdx++;
        }
        srcX++;
      }
    }

    return new ImageData(nextData, newW, h);
  }

  private static computeEnergy(data: Uint8ClampedArray, w: number, h: number): Float32Array {
    const energy = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const xL = x > 0 ? x - 1 : 0;
        const xR = x < w - 1 ? x + 1 : w - 1;
        const yU = y > 0 ? y - 1 : 0;
        const yD = y < h - 1 ? y + 1 : h - 1;

        const idxL = (y * w + xL) * 4;
        const idxR = (y * w + xR) * 4;
        const idxU = (yU * w + x) * 4;
        const idxD = (yD * w + x) * 4;

        const rx = data[idxR] - data[idxL];
        const gx = data[idxR + 1] - data[idxL + 1];
        const bx = data[idxR + 2] - data[idxL + 2];
        const ax = data[idxR + 3] - data[idxL + 3];

        const ry = data[idxD] - data[idxU];
        const gy = data[idxD + 1] - data[idxU + 1];
        const by = data[idxD + 2] - data[idxU + 2];
        const ay = data[idxD + 3] - data[idxU + 3];

        const valX = rx * rx + gx * gx + bx * bx + ax * ax;
        const valY = ry * ry + gy * gy + by * by + ay * ay;

        energy[y * w + x] = Math.sqrt(valX + valY);
      }
    }

    return energy;
  }

  private static findVerticalSeam(energy: Float32Array, w: number, h: number): number[] {
    const dp = new Float32Array(w * h);

    for (let x = 0; x < w; x++) {
      dp[x] = energy[x];
    }

    for (let y = 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const val = energy[y * w + x];
        let minPrev = dp[(y - 1) * w + x];
        if (x > 0) {
          minPrev = Math.min(minPrev, dp[(y - 1) * w + (x - 1)]);
        }
        if (x < w - 1) {
          minPrev = Math.min(minPrev, dp[(y - 1) * w + (x + 1)]);
        }
        dp[y * w + x] = val + minPrev;
      }
    }

    let minX = 0;
    let minVal = dp[(h - 1) * w];
    for (let x = 1; x < w; x++) {
      const val = dp[(h - 1) * w + x];
      if (val < minVal) {
        minVal = val;
        minX = x;
      }
    }

    const seam = new Array<number>(h);
    let currX = minX;
    seam[h - 1] = currX;

    for (let y = h - 2; y >= 0; y--) {
      let nextX = currX;
      let minPrev = dp[y * w + currX];

      if (currX > 0) {
        const val = dp[y * w + (currX - 1)];
        if (val < minPrev) {
          minPrev = val;
          nextX = currX - 1;
        }
      }
      if (currX < w - 1) {
        const val = dp[y * w + (currX + 1)];
        if (val < minPrev) {
          minPrev = val;
          nextX = currX + 1;
        }
      }

      currX = nextX;
      seam[y] = currX;
    }

    return seam;
  }
}

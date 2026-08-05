export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CanvasSizeService {
  /**
   * Computes the layer shifting offset (dx, dy) based on the selected anchor.
   */
  static getAnchorOffset(
    oldW: number,
    oldH: number,
    newW: number,
    newH: number,
    anchor: string
  ): Point {
    const diffW = newW - oldW;
    const diffH = newH - oldH;
    let dx = 0;
    let dy = 0;

    if (anchor.includes('center')) {
      dx = Math.round(diffW / 2);
    } else if (anchor.includes('right')) {
      dx = diffW;
    } else {
      dx = 0;
    }

    if (anchor.startsWith('middle') || anchor === 'center') {
      dy = Math.round(diffH / 2);
    } else if (anchor.startsWith('bottom')) {
      dy = diffH;
    } else {
      dy = 0;
    }

    return { x: dx, y: dy };
  }

  /**
   * Crops/extends a layer's image pixels to the new canvas boundaries [0, 0, canvasW, canvasH].
   * Returns the new position, dimensions, and cropped dataUrl.
   */
  static cropLayerImage(
    img: HTMLImageElement | HTMLCanvasElement,
    currentPos: Point,
    canvasW: number,
    canvasH: number
  ): { position: Point; width: number; height: number; dataUrl: string } {
    const layerW = img.width;
    const layerH = img.height;

    // Bounding boxes
    const layerLeft = currentPos.x;
    const layerTop = currentPos.y;
    const layerRight = layerLeft + layerW;
    const layerBottom = layerTop + layerH;

    // Intersection with [0, 0, canvasW, canvasH]
    const intersectLeft = Math.max(0, layerLeft);
    const intersectTop = Math.max(0, layerTop);
    const intersectRight = Math.min(canvasW, layerRight);
    const intersectBottom = Math.min(canvasH, layerBottom);

    const intersectW = intersectRight - intersectLeft;
    const intersectH = intersectBottom - intersectTop;

    if (intersectW <= 0 || intersectH <= 0) {
      // Return a 1x1 transparent placeholder
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      return {
        position: { x: 0, y: 0 },
        width: 1,
        height: 1,
        dataUrl: tempCanvas.toDataURL()
      };
    }

    const cropX = intersectLeft - layerLeft;
    const cropY = intersectTop - layerTop;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = intersectW;
    tempCanvas.height = intersectH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.drawImage(
        img,
        cropX,
        cropY,
        intersectW,
        intersectH,
        0,
        0,
        intersectW,
        intersectH
      );
    }

    return {
      position: { x: intersectLeft, y: intersectTop },
      width: intersectW,
      height: intersectH,
      dataUrl: tempCanvas.toDataURL()
    };
  }

  /**
   * Resizes the background layer to the full canvas size and fills it with fillColor.
   */
  static resizeBackgroundLayer(
    img: HTMLImageElement | HTMLCanvasElement | null,
    dx: number,
    dy: number,
    canvasW: number,
    canvasH: number,
    fillColor: string
  ): HTMLCanvasElement {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasW;
    tempCanvas.height = canvasH;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      if (fillColor && fillColor !== 'transparent') {
        tempCtx.fillStyle = fillColor;
        tempCtx.fillRect(0, 0, canvasW, canvasH);
      } else {
        tempCtx.clearRect(0, 0, canvasW, canvasH);
      }

      if (img) {
        tempCtx.drawImage(img, dx, dy);
      }
    }
    return tempCanvas;
  }
}

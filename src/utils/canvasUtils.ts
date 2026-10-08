export const normalizeColor = (color: string): string => {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color.length <= 7 ? color : color.slice(0, 7);
  if (color.startsWith('rgb')) {
    const m = color.match(/(\d+)/g);
    if (m && m.length >= 3) {
      const r = Math.min(255, parseInt(m[0], 10)).toString(16).padStart(2, '0');
      const g = Math.min(255, parseInt(m[1], 10)).toString(16).padStart(2, '0');
      const b = Math.min(255, parseInt(m[2], 10)).toString(16).padStart(2, '0');
      return `#${r}${g}${b}`;
    }
  }
  return color;
};

export const hexToRgba = (hex: string, opacity: number): string => {
  let cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;

  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(char => char + char).join('');
  }

  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Parses an SVG path string of the form produced by `buildSvgPathFromContours`
 * or the fontkit service (absolute `M x y [L|Q|C] ... Z` subpaths, one per
 * contour) into the `vectorPaths` shape that the Pen / Path-Select tools work
 * with.
 *
 * Every subpath becomes a closed `VectorPath` (the path tool hit-tests closed
 * paths with the ray-casting rule; glyph holes are preserved as separate closed
 * subpaths that combine with `fillRule: 'evenodd'` to render as holes).
 *
 * Bézier handles are carried through: a `Q cpx cpy x y` sets `handleOut` on
 * the previous anchor and `handleIn` on the new anchor; a `C cp1x cp1y cp2x
 * cp2y x y` does the same with both control points. Subpaths containing any
 * curve command are flagged `smooth: true` so re-emission produces curves
 * instead of polylines.
 *
 * An optional `offset` (typically `layer.position`) is added to every point so
 * the result lives in document space — the same space the tools and
 * `VectorOverlay` operate in.
 */
export const parseSvgPathToVectorPaths = (
  svgPath: string,
  offset?: { x: number; y: number }
): {
  points: { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } }[];
  closed: boolean;
  smooth?: boolean;
}[] => {
  if (!svgPath) return [];
  const ox = offset?.x ?? 0;
  const oy = offset?.y ?? 0;

  // Tokens: command letter (M/L/C/Q/Z) or a number. Accept lowercase too.
  const re = /([MLCQZmlcqz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;
  const tokens: (string | number)[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(svgPath)) !== null) {
    if (m[1] !== undefined) tokens.push(m[1].toUpperCase());
    else if (m[2] !== undefined) tokens.push(parseFloat(m[2]));
  }

  type Anchor = { x: number; y: number; handleIn?: { x: number; y: number }; handleOut?: { x: number; y: number } };

  const out: { points: Anchor[]; closed: boolean; smooth?: boolean }[] = [];
  let current: Anchor[] = [];
  let hasCurrent = false;
  let smooth = false;

  const closeCurrent = () => {
    if (hasCurrent && current.length > 0) {
      out.push({ points: current, closed: true, smooth: smooth || undefined });
    }
    current = [];
    hasCurrent = false;
    smooth = false;
  };

  // Returns the last anchor that can accept a handleOut, or null if there is
  // no current subpath yet. We use the last anchor in `current` — pen position
  // is conceptually at that point.
  const lastAnchor = (): Anchor | null => {
    return current.length > 0 ? current[current.length - 1] : null;
  };

  let i = 0;
  const takeNum = (): number | null => {
    const v = tokens[i];
    if (typeof v === 'number' && Number.isFinite(v)) {
      i += 1;
      return v;
    }
    return null;
  };
  const takePair = (): { x: number; y: number } | null => {
    const x = takeNum();
    if (x == null) return null;
    const y = takeNum();
    if (y == null) return null;
    return { x, y };
  };

  // SVG implicit-continuation: after L/C/Q, further coord pairs reuse the same
  // command. (T/S can also implicitly continue, but L/C/Q are the common cases
  // for paths this app generates.)

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      // M / L
      if (t === 'M' || t === 'L') {
        i += 1;
        let cmd: 'M' | 'L' = t;
        while (i < tokens.length) {
          const p = takePair();
          if (!p) break;
          if (cmd === 'M' && hasCurrent) {
            // Implicit Z: an M after a subpath closes the prior one.
            closeCurrent();
          }
          if (!hasCurrent) hasCurrent = true;
          current.push({ x: p.x + ox, y: p.y + oy });
          // In SVG, M followed by extra coord pairs is implicit L.
          if (cmd === 'M') cmd = 'L';
        }
        continue;
      }
      // C (cubic)
      if (t === 'C') {
        i += 1;
        while (i < tokens.length) {
          const cp1 = takePair();
          if (!cp1) break;
          const cp2 = takePair();
          if (!cp2) break;
          const p = takePair();
          if (!p) break;
          if (!hasCurrent) hasCurrent = true;
          const prev = lastAnchor();
          if (prev) {
            prev.handleOut = { x: cp1.x + ox, y: cp1.y + oy };
          }
          current.push({
            x: p.x + ox,
            y: p.y + oy,
            handleIn: { x: cp2.x + ox, y: cp2.y + oy },
          });
          smooth = true;
        }
        continue;
      }
      // Q (quadratic)
      if (t === 'Q') {
        i += 1;
        while (i < tokens.length) {
          const cp = takePair();
          if (!cp) break;
          const p = takePair();
          if (!p) break;
          if (!hasCurrent) hasCurrent = true;
          const prev = lastAnchor();
          if (prev) {
            prev.handleOut = { x: cp.x + ox, y: cp.y + oy };
          }
          current.push({
            x: p.x + ox,
            y: p.y + oy,
            handleIn: { x: cp.x + ox, y: cp.y + oy },
          });
          smooth = true;
        }
        continue;
      }
      // Z
      if (t === 'Z') {
        closeCurrent();
        i += 1;
        continue;
      }
      // Unknown command: skip its letter.
      i += 1;
      continue;
    }
    // Bare number — implicit repeat of the previous command. If we don't
    // have a previous command, drop the token. (T/S implicit-repeats are not
    // implemented; the fontkit output never emits them, so this is fine.)
    // We can recover the implicit command from the last string token seen
    // before this number. For simplicity, we look at the most recent command
    // letter by re-scanning — but that's expensive. Instead, we handle the
    // common case: after an M's coord pairs, the same command is implicit-L.
    // The loop above already consumed all coord pairs for an M/L/C/Q by
    // looping until it can't take a pair, so a bare number reaching here
    // means our parser lost sync. Skip one token to recover.
    i += 1;
  }
  closeCurrent();
  return out;
};

export const findContour = (
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number,
  offset?: { x: number, y: number }
) => {
  const contour: { x: number, y: number }[] = [];
  let currX = -1, currY = -1;

  // 1. Find a boundary pixel (a pixel that is 1 and has a 0 neighbor)
  // Search in a widening square around the start point
  let found = false;
  for (let r = 0; r < Math.max(width, height) && !found; r += 5) {
    for (let y = Math.max(0, startY - r); y <= Math.min(height - 1, startY + r) && !found; y += (r > 0 ? r : 1)) {
      for (let x = Math.max(0, startX - r); x <= Math.min(width - 1, startX + r); x++) {
        if (mask[y * width + x]) {
          // Check if it's a boundary pixel
          const hasZeroNeighbor = (
            (x > 0 && !mask[y * width + (x - 1)]) ||
            (x < width - 1 && !mask[y * width + (x + 1)]) ||
            (y > 0 && !mask[(y - 1) * width + x]) ||
            (y < height - 1 && !mask[(y + 1) * width + x])
          );
          if (hasZeroNeighbor) {
            currX = x; currY = y;
            found = true;
            break;
          }
        }
      }
    }
  }

  if (!found) return [];

  const sX = currX, sY = currY;
  let prevX = currX - 1, prevY = currY;
  let limit = 50000; // Increased limit for complex shapes

  // 2. Moore Neighborhood Tracing
  do {
    contour.push({ x: currX + (offset?.x || 0), y: currY + (offset?.y || 0) });
    
    // Relative directions (clockwise)
    const dirs = [
      [currX - 1, currY - 1], [currX, currY - 1], [currX + 1, currY - 1],
      [currX + 1, currY], [currX + 1, currY + 1], [currX, currY + 1],
      [currX - 1, currY + 1], [currX - 1, currY]
    ];

    let startDir = 0;
    for (let i = 0; i < 8; i++) {
      if (dirs[i][0] === prevX && dirs[i][1] === prevY) {
        startDir = (i + 1) % 8;
        break;
      }
    }

    let nextFound = false;
    for (let i = 0; i < 8; i++) {
      const idx = (startDir + i) % 8;
      const [nx, ny] = dirs[idx];
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && mask[ny * width + nx]) {
        prevX = currX; prevY = currY;
        currX = nx; currY = ny;
        nextFound = true;
        break;
      }
    }

    if (!nextFound) break;
    limit--;
  } while ((currX !== sX || currY !== sY) && limit > 0);

  // 3. Douglas-Peucker simplification.
  //    The raw trace keeps a node for every boundary pixel, so straight edges
  //    and gentle curves end up with hundreds of redundant anchors. DP keeps a
  //    point only where the contour deviates from the line between its
  //    neighbours — i.e. the *end of a straight run* and the *bend of a curve*.
  //    This collapses colinear runs to their two endpoints and leaves real
  //    shape detail intact, drastically cutting node count.
  const tolerance = 1.5; // Max deviation (px) before a point is kept.
  const simplified = simplifyContour(contour, tolerance);

  // Drop the duplicated closing node (the trace re-visits the start pixel),
  // which would otherwise leave a zero-length edge on the closed path.
  if (simplified.length > 1) {
    const a = simplified[0];
    const b = simplified[simplified.length - 1];
    if (a.x === b.x && a.y === b.y) simplified.pop();
  }

  return simplified;
};

/**
 * Douglas-Peucker polygon simplification.
 * Keeps a vertex only when its perpendicular distance from the line segment
 * joining two kept vertices exceeds `epsilon`; otherwise the whole span is
 * treated as a straight line. Runs iteratively (no recursion) so very large
 * traced outlines don't blow the stack.
 */
function simplifyContour(
  points: { x: number; y: number }[],
  epsilon: number
): { x: number; y: number }[] {
  if (points.length <= 2) return points.slice();

  // Remove consecutive duplicate pixels (Moore tracing can revisit a cell).
  const pts: { x: number; y: number }[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const q = pts[pts.length - 1];
    if (p.x !== q.x || p.y !== q.y) pts.push(p);
  }
  if (pts.length <= 2) return pts;

  const keep = new Array<boolean>(pts.length).fill(false);
  keep[0] = true;
  keep[pts.length - 1] = true;

  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop()!;
    let maxDist = 0;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpendicularDistance(pts[i], pts[s], pts[e]);
      if (d > maxDist) {
        maxDist = d;
        idx = i;
      }
    }
    if (maxDist > epsilon && idx !== -1) {
      keep[idx] = true;
      stack.push([s, idx]);
      stack.push([idx, e]);
    }
  }

  return pts.filter((_, i) => keep[i]);
}

function perpendicularDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

export const findAllContours = (
  mask: Uint8Array,
  width: number,
  height: number,
  offset?: { x: number, y: number }
) => {
  const allContours: { x: number, y: number }[][] = [];
  const tempMask = new Uint8Array(mask);
  const queue: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (tempMask[idx]) {
        const contour = findContour(tempMask, width, height, x, y, offset);
        if (contour.length > 3) {
          allContours.push(contour);
        }

        // Flood-fill this connected foreground blob away so it isn't traced again.
        queue.length = 0;
        queue.push(idx);
        tempMask[idx] = 0;

        while (queue.length > 0) {
          const current = queue.pop()!;
          const cx = current % width;
          const cy = Math.floor(current / width);

          const neighbors = [
            current - 1,
            current + 1,
            current - width,
            current + width,
          ];

          if (cx === 0) neighbors[0] = -1;
          if (cx === width - 1) neighbors[1] = -1;
          if (cy === 0) neighbors[2] = -1;
          if (cy === height - 1) neighbors[3] = -1;

          for (const next of neighbors) {
            if (next >= 0 && tempMask[next]) {
              tempMask[next] = 0;
              queue.push(next);
            }
          }
        }
      }
    }
  }

  // Interior holes (the counters in "A", "B", "P", "D", "o", …). These are
  // background pixels enclosed by a glyph, so the foreground-only trace above
  // never reaches them and the letters would render filled. A hole is exactly a
  // connected background component that does NOT touch the image border, so we
  // flood the exterior background away and trace whatever background remains.
  const holeContours = findHoleContours(mask, width, height, offset);
  for (const hc of holeContours) {
    if (hc.length > 3) allContours.push(hc);
  }

  return allContours;
};

/**
 * Traces the contours of interior holes (enclosed background regions) in a mask.
 * A hole is a connected background component that does not reach the image
 * border — so we flood-fill the exterior background away (starting from every
 * border pixel), then trace each surviving background component. Each becomes a
 * closed subpath that, under the 'evenodd' fill rule, renders as a hole.
 */
function findHoleContours(
  mask: Uint8Array,
  width: number,
  height: number,
  offset?: { x: number; y: number }
): { x: number, y: number }[][] {
  const out: { x: number, y: number }[][] = [];
  // Inverted mask: background (of original) becomes foreground to trace.
  const inv = new Uint8Array(width * height);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;

  // Flood exterior background from every border pixel.
  const queue: number[] = [];
  for (let x = 0; x < width; x++) {
    if (inv[x]) { inv[x] = 0; queue.push(x); }
    const b = (height - 1) * width + x;
    if (inv[b]) { inv[b] = 0; queue.push(b); }
  }
  for (let y = 0; y < height; y++) {
    const l = y * width;
    if (inv[l]) { inv[l] = 0; queue.push(l); }
    const r = y * width + (width - 1);
    if (inv[r]) { inv[r] = 0; queue.push(r); }
  }
  while (queue.length) {
    const cur = queue.pop()!;
    const cx = cur % width;
    const cy = Math.floor(cur / width);
    const ns = [cur - 1, cur + 1, cur - width, cur + width];
    if (cx === 0) ns[0] = -1;
    if (cx === width - 1) ns[1] = -1;
    if (cy === 0) ns[2] = -1;
    if (cy === height - 1) ns[3] = -1;
    for (const nx of ns) {
      if (nx >= 0 && inv[nx]) {
        inv[nx] = 0;
        queue.push(nx);
      }
    }
  }

  // Whatever background remains is enclosed — trace each component.
  for (let i = 0; i < inv.length; i++) {
    if (!inv[i]) continue;
    const sx = i % width;
    const sy = Math.floor(i / width);
    const contour = findContour(inv, width, height, sx, sy, offset);
    if (contour.length > 3) out.push(contour);
    // Flood the traced hole away so nested holes are handled on the next pass.
    const q: number[] = [i];
    inv[i] = 0;
    while (q.length) {
      const cur = q.pop()!;
      const cx = cur % width;
      const cy = Math.floor(cur / width);
      const ns = [cur - 1, cur + 1, cur - width, cur + width];
      if (cx === 0) ns[0] = -1;
      if (cx === width - 1) ns[1] = -1;
      if (cy === 0) ns[2] = -1;
      if (cy === height - 1) ns[3] = -1;
      for (const nx of ns) {
        if (nx >= 0 && inv[nx]) {
          inv[nx] = 0;
          q.push(nx);
        }
      }
    }
  }
  return out;
}

/**
 * Builds an SVG path string from a list of contours (each a list of points).
 * Subpaths are concatenated; callers should use the 'evenodd' fill rule so that
 * interior contours (e.g. the hole in "o", "e", "a") render as holes.
 */
export const buildSvgPathFromContours = (
  contours: { x: number, y: number }[][]
): string => {
  if (!contours.length) return '';
  let d = '';
  for (const contour of contours) {
    if (contour.length < 3) continue;
    d += `M ${contour[0].x.toFixed(2)} ${contour[0].y.toFixed(2)} `;
    for (let i = 1; i < contour.length; i++) {
      d += `L ${contour[i].x.toFixed(2)} ${contour[i].y.toFixed(2)} `;
    }
    d += 'Z ';
  }
  return d.trim();
};

/**
 * Traces the opaque pixels of a rendered text layer canvas into an SVG path
 * that reproduces the glyph shapes (including interior holes). Returns an empty
 * string when nothing was traced.
 */
export const traceLayerCanvasToSvgPath = (
  source: HTMLCanvasElement,
  width: number,
  height: number,
  alphaThreshold = 10
): string => {
  // Snap to integer pixels. Canvas APIs floor fractional sizes silently, so
  // passing floats through produces a mask sized to floor(w*h) but a contour
  // grid of w*h — the index math then mismatches and finds no contours.
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d');
  if (!sctx) return '';
  sctx.drawImage(source, 0, 0, w, h);

  const { data } = sctx.getImageData(0, 0, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = data[i * 4 + 3] > alphaThreshold ? 1 : 0;
  }

  const contours = findAllContours(mask, w, h);
  return buildSvgPathFromContours(contours);
};

/**
 * Rasterizes a text layer using the same parameters the canvas renderer uses,
 * then traces the glyph outlines into an SVG path. The result preserves
 * interior holes (e.g. the counters in "o", "e", "a") via the evenodd fill
 * rule. Returns an empty string if the layer has no text content.
 *
 * The returned path is in the layer's local (unrotated, pre-position) pixel
 * coordinate space, i.e. the same space used by the shape renderer.
 */
export const convertTextLayerToPath = (layer: {
  textContent?: string;
  fontSize?: number;
  fontFamily?: string;
  fontChecksum?: string;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  isVertical?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  fontStyle?: 'normal' | 'italic';
  fontWeight?: string;
  rotation?: number;
  width?: number;
  height?: number;
}): string => {
  if (!layer.textContent) return '';

  // Round to integer pixels: the layer's reported width/height is fractional
  // (it was sized to fit the rendered glyphs), and passing those floats down
  // to the canvas API + contour tracer yields zero contours (the mask size
  // and the trace grid end up mismatched).
  const width = Math.max(1, Math.round(layer.width || 1));
  const height = Math.max(1, Math.round(layer.height || 1));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.clearRect(0, 0, width, height);

  const fs = layer.fontSize || 40;
  const origW = width;
  const fontFamily = getFontFamilyString(layer.fontFamily, layer.fontChecksum);

  ctx.fillStyle = layer.color || '#000000';
  ctx.textAlign = layer.textAlign || 'left';
  ctx.font = `${layer.fontStyle || 'normal'} ${layer.fontWeight || 'normal'} ${fs}px ${fontFamily}`;
  ctx.textBaseline = 'alphabetic';

  const metrics = ctx.measureText('M');
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  const baselineOffset = (ascent !== undefined && descent !== undefined)
    ? (fs + ascent - descent) / 2
    : fs * 0.85;

  // Apply rotation around the canvas so the traced outline matches the
  // rendered (rotated) glyphs. The shape renderer re-applies this rotation.
  if (layer.rotation) {
    const rad = (layer.rotation * Math.PI) / 180;
    const normalizedRot = ((layer.rotation % 360) + 360) % 360;
    if (normalizedRot === 90) ctx.translate(width, 0);
    else if (normalizedRot === 180) ctx.translate(width, height);
    else if (normalizedRot === 270) ctx.translate(0, height);
    ctx.rotate(rad);
  }

  layer.textContent.split('\n').forEach((line, i) => {
    if (layer.isVertical) {
      const chars = line.split('');
      const xPos = i * fs * 1.2;
      chars.forEach((char, j) => {
        const yPos = j * fs + baselineOffset;
        if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
          ctx.strokeStyle = layer.strokeColor;
          ctx.lineWidth = layer.strokeWidth;
          ctx.strokeText(char, xPos, yPos);
        }
        ctx.fillText(char, xPos, yPos);
      });
    } else {
      const yPos = i * fs + baselineOffset;
      let xPos = 0;
      if (layer.textAlign === 'center') xPos = origW / 2;
      else if (layer.textAlign === 'right') xPos = origW;
      if (layer.strokeColor && layer.strokeWidth && layer.strokeWidth > 0) {
        ctx.strokeStyle = layer.strokeColor;
        ctx.lineWidth = layer.strokeWidth;
        ctx.strokeText(line, xPos, yPos);
      }
      ctx.fillText(line, xPos, yPos);
    }
  });

  return traceLayerCanvasToSvgPath(canvas, width, height);
};

/**
 * Async variant of `convertTextLayerToPath`. Tries the high-fidelity
 * fontkit path first (true Bézier outlines from Google Fonts) and falls back
 * to the synchronous rasterize+trace path on any failure (offline, CORS,
 * missing @font-face block, embedded PDF font, parse error, missing
 * network). Never throws — the caller can treat the result identically to
 * the sync version.
 */
export const convertTextLayerToPathAsync = async (layer: Parameters<typeof convertTextLayerToPath>[0]): Promise<string> => {
  try {
    const { textLayerToBezierSvgPath } = await import('../services/fonts/fontkitFontService');
    const d = await textLayerToBezierSvgPath(layer as any);
    if (d) return d;
  } catch {
    // Fall through to the synchronous trace path.
  }
  return convertTextLayerToPath(layer);
};

export const getHomography = (src: { x: number, y: number }[], dst: { x: number, y: number }[]) => {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    A.push([src[i].x, src[i].y, 1, 0, 0, 0, -dst[i].x * src[i].x, -dst[i].x * src[i].y]);
    A.push([0, 0, 0, src[i].x, src[i].y, 1, -dst[i].y * src[i].x, -dst[i].y * src[i].y]);
  }
  const B = [dst[0].x, dst[0].y, dst[1].x, dst[1].y, dst[2].x, dst[2].y, dst[3].x, dst[3].y];
  
  // Gaussian elimination solver
  const n = B.length;
  for (let i = 0; i < n; i++) {
    let max = i;
    for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j;
    [A[i], A[max]] = [A[max], A[i]]; [B[i], B[max]] = [B[max], B[i]];
    if (Math.abs(A[i][i]) < 1e-10) return null;
    for (let j = i + 1; j < n; j++) {
      const factor = A[j][i] / A[i][i];
      B[j] -= factor * B[i];
      for (let k = i; k < n; k++) A[j][k] -= factor * A[i][k];
    }
  }
  const X = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) sum += A[i][j] * X[j];
    X[i] = (B[i] - sum) / A[i][i];
  }
  return [...X, 1];
};

export const warpPerspective = (
  ctx: CanvasRenderingContext2D,
  points: { x: number, y: number }[], // 4 corners: TL, TR, BR, BL
  targetWidth: number,
  targetHeight: number
) => {
  const canvas = ctx.canvas;
  const srcData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = targetWidth;
  dstCanvas.height = targetHeight;
  const dstCtx = dstCanvas.getContext('2d')!;
  const dstData = dstCtx.createImageData(targetWidth, targetHeight);

  const dstPoints = [{x:0, y:0}, {x:targetWidth, y:0}, {x:targetWidth, y:targetHeight}, {x:0, y:targetHeight}];
  const h = getHomography(dstPoints, points);
  if (!h) return dstData;

  const src = srcData.data, dst = dstData.data;
  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const z = h[6] * x + h[7] * y + h[8];
      if (Math.abs(z) < 0.0001) continue;
      const px = (h[0] * x + h[1] * y + h[2]) / z;
      const py = (h[3] * x + h[4] * y + h[5]) / z;
      
      if (px >= 0 && px < canvas.width - 1 && py >= 0 && py < canvas.height - 1) {
        const ix = Math.floor(px), iy = Math.floor(py);
        const idx1 = (iy * canvas.width + ix) * 4, idx2 = idx1 + 4, idx3 = idx1 + canvas.width * 4, idx4 = idx3 + 4;
        const fx = px - ix, fy = py - iy;
        for (let c = 0; c < 4; c++) {
          dst[(y * targetWidth + x) * 4 + c] = 
            src[idx1 + c] * (1-fx) * (1-fy) + src[idx2 + c] * fx * (1-fy) +
            src[idx3 + c] * (1-fx) * fy + src[idx4 + c] * fx * fy;
        }
      }
    }
  }
  return dstData;
};

export const warpQuad = (
  srcCanvas: HTMLCanvasElement | HTMLImageElement,
  dstPoints: { x: number; y: number }[],
  dstWidth: number,
  dstHeight: number
) => {
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = dstWidth;
  dstCanvas.height = dstHeight;
  const dstCtx = dstCanvas.getContext('2d')!;

  const srcWidth = srcCanvas.width;
  const srcHeight = srcCanvas.height;

  let srcCanvasElement: HTMLCanvasElement;
  if (srcCanvas instanceof HTMLCanvasElement) {
    srcCanvasElement = srcCanvas;
  } else {
    srcCanvasElement = document.createElement('canvas');
    srcCanvasElement.width = srcWidth;
    srcCanvasElement.height = srcHeight;
    srcCanvasElement.getContext('2d')!.drawImage(srcCanvas, 0, 0);
  }

  const srcCtx = srcCanvasElement.getContext('2d')!;
  const srcData = srcCtx.getImageData(0, 0, srcWidth, srcHeight);
  const dstData = dstCtx.createImageData(dstWidth, dstHeight);

  const srcPoints = [
    { x: 0, y: 0 },
    { x: srcWidth, y: 0 },
    { x: srcWidth, y: srcHeight },
    { x: 0, y: srcHeight }
  ];

  const h = getHomography(dstPoints, srcPoints);
  if (!h) return dstCanvas;

  const src = srcData.data, dst = dstData.data;
  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const z = h[6] * x + h[7] * y + h[8];
      if (Math.abs(z) < 0.0001) continue;
      const px = (h[0] * x + h[1] * y + h[2]) / z;
      const py = (h[3] * x + h[4] * y + h[5]) / z;

      if (px >= 0 && px < srcWidth - 1 && py >= 0 && py < srcHeight - 1) {
        const ix = Math.floor(px), iy = Math.floor(py);
        const idx1 = (iy * srcWidth + ix) * 4, idx2 = idx1 + 4, idx3 = idx1 + srcWidth * 4, idx4 = idx3 + 4;
        const fx = px - ix, fy = py - iy;
        const dIdx = (y * dstWidth + x) * 4;
        for (let c = 0; c < 4; c++) {
          dst[dIdx + c] = 
            src[idx1 + c] * (1-fx) * (1-fy) + src[idx2 + c] * fx * (1-fy) +
            src[idx3 + c] * (1-fx) * fy + src[idx4 + c] * fx * fy;
        }
      }
    }
  }
  dstCtx.putImageData(dstData, 0, 0);
  return dstCanvas;
};

export const findBestEdgePoint = (
  ctx: CanvasRenderingContext2D | null,
  x: number,
  y: number,
  radius: number
) => {
  if (!ctx) return { x, y };
  const rx = Math.round(x);
  const ry = Math.round(y);
  const size = radius * 2;
  try {
    const imageData = ctx.getImageData(rx - radius, ry - radius, size, size);
    const data = imageData.data;
    let maxGrad = -1, bestX = x, bestY = y;
    const getScore = (i: number, j: number) => {
      const idx = (j * size + i) * 4;
      return idx < 0 || idx >= data.length ? 0 : (data[idx] + data[idx+1] + data[idx+2]) * (data[idx+3] / 255);
    };
    for (let j = 1; j < size - 1; j++) {
      for (let i = 1; i < size - 1; i++) {
        const gx = getScore(i + 1, j) - getScore(i - 1, j);
        const gy = getScore(i, j + 1) - getScore(i, j - 1);
        const grad = gx * gx + gy * gy;
        if (grad > maxGrad) { maxGrad = grad; bestX = rx - radius + i; bestY = ry - radius + j; }
      }
    }
    return { x: bestX, y: bestY };
  } catch { return { x, y }; }
};

export const drawTrianglesWarp = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | HTMLCanvasElement,
  srcGrid: { x: number; y: number }[],
  dstGrid: { x: number; y: number }[],
  gridWidth: number,
  gridHeight: number
) => {
  const applyTriangle = (
    s0: { x: number; y: number },
    s1: { x: number; y: number },
    s2: { x: number; y: number },
    d0: { x: number; y: number },
    d1: { x: number; y: number },
    d2: { x: number; y: number }
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();
    const delta = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
    if (Math.abs(delta) < 0.0001) { ctx.restore(); return; }
    const a = ((d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y)) / delta;
    const c = ((s0.x - s2.x) * (d1.x - d2.x) - (s1.x - s2.x) * (d0.x - d2.x)) / delta;
    const e = d2.x - a * s2.x - c * s2.y;
    const b = ((d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y)) / delta;
    const d = ((s0.x - s2.x) * (d1.y - d2.y) - (s1.x - s2.x) * (d0.y - d2.y)) / delta;
    const f = d2.y - b * s2.x - d * s2.y;
    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let y = 0; y < gridHeight - 1; y++) {
    for (let x = 0; x < gridWidth - 1; x++) {
      const i00 = y * gridWidth + x;
      const i10 = y * gridWidth + (x + 1);
      const i01 = (y + 1) * gridWidth + x;
      const i11 = (y + 1) * gridWidth + (x + 1);
      applyTriangle(srcGrid[i00], srcGrid[i10], srcGrid[i01], dstGrid[i00], dstGrid[i10], dstGrid[i01]);
      applyTriangle(srcGrid[i10], srcGrid[i11], srcGrid[i01], dstGrid[i10], dstGrid[i11], dstGrid[i01]);
    }
  }
};


export const loadGoogleFont = (family: string) => {
  if (typeof window === 'undefined') return;
  const linkId = `google-font-${family.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(linkId)) return;

  const link = document.createElement('link');
  link.id = linkId;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&display=swap`;
  document.head.appendChild(link);
};

export const getFontFamilyString = (
  fontFamily: string | undefined,
  fontChecksum: string | undefined
): string => {
  const hasCustomFont = !!fontChecksum;
  const customFontKey = hasCustomFont ? `pdf-font-${fontChecksum}` : '';
  const genericFallback = `"Nirmala UI", "Noto Sans Devanagari", "Mangal", "Arial Unicode MS", "Noto Sans", sans-serif`;

  if (hasCustomFont) {
    return `"${customFontKey}", "${fontFamily || ''}", ${genericFallback}`;
  }

  const baseFont = fontFamily && !['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'].includes(fontFamily.toLowerCase())
    ? `"${fontFamily}", `
    : '';

  return `${baseFont}${genericFallback}`;
};

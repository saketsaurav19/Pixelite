import type { TextWarp } from '../store/types';

export const applyWarpDeformation = (
  u: number, // 0 to 1
  v: number, // 0 to 1
  w: number, // width of original text bounding box
  h: number, // height of original text bounding box
  warp: TextWarp
): { x: number; y: number } => {
  const { style, orientation, bend, horizontalDistortion, verticalDistortion } = warp;

  // 1. Swap axes if Vertical orientation.
  // This simplifies vertical warp to just computing horizontal formulas and mapping back.
  let tu = orientation === 'Vertical' ? v : u;
  let tv = orientation === 'Vertical' ? u : v;

  // Map to range [-1, 1] relative to center
  let nx = tu * 2 - 1;
  let ny = tv * 2 - 1;
  const b = bend / 100; // factor between -1 and 1

  // Final deformed coordinates (in [0,1] range)
  let du = tu;
  let dv = tv;

  switch (style) {
    case 'Arc': {
      // Curving the baseline and top line.
      // dy is parabolic: peaks at nx = 0 with value -b * 0.35
      const dy = -b * 0.35 * (1 - nx * nx);
      dv = tv + dy;
      break;
    }
    case 'Arc Lower': {
      // Only bottom curves. Bottom is tv = 1. Top tv = 0 is flat.
      // Displacement scales with tv (the vertical position).
      const dy = b * 0.4 * tv * (1 - nx * nx);
      dv = tv + dy;
      break;
    }
    case 'Arc Upper': {
      // Only top curves. Top is tv = 0. Bottom tv = 1 is flat.
      // Displacement scales with (1 - tv).
      const dy = -b * 0.4 * (1 - tv) * (1 - nx * nx);
      dv = tv + dy;
      break;
    }
    case 'Arch': {
      // Curves like an arch, and side vertical edges are compressed/slanted.
      const dy = -b * 0.35 * (1 - nx * nx);
      dv = tv + dy;
      // Slant/scale width: squeeze at the edges
      const edgeSqueeze = 1 - Math.abs(b) * 0.25 * (nx * nx);
      dv = 0.5 + (dv - 0.5) * edgeSqueeze;
      break;
    }
    case 'Bulge': {
      // Puffs out (or squeezes in if bend is negative) in the center.
      // Both top and bottom edges bulge out.
      const scale = 1 + b * 0.35 * (1 - nx * nx);
      dv = 0.5 + (tv - 0.5) * scale;
      break;
    }
    case 'Shell Lower': {
      // Bottom edge curves out, top is flat, width expands towards bottom.
      const dy = b * 0.35 * tv * (1 - nx * nx);
      dv = tv + dy;
      // Stretches horizontally as tv increases:
      const stretch = 1 + b * 0.25 * tv;
      du = 0.5 + (tu - 0.5) * stretch;
      break;
    }
    case 'Shell Upper': {
      // Top edge curves, bottom is flat, width expands towards top.
      const dy = -b * 0.35 * (1 - tv) * (1 - nx * nx);
      dv = tv + dy;
      // Stretches horizontally as tv decreases:
      const stretch = 1 + b * 0.25 * (1 - tv);
      du = 0.5 + (tu - 0.5) * stretch;
      break;
    }
    case 'Flag': {
      // Sine wave deformation vertically.
      const dy = -b * 0.22 * Math.sin(nx * Math.PI);
      dv = tv + dy;
      break;
    }
    case 'Wave': {
      // S-like sine wave deformation vertically and minor horizontal shift.
      const dy = -b * 0.2 * Math.sin(nx * Math.PI * 1.5);
      dv = tv + dy;
      const dx = -b * 0.05 * Math.cos(ny * Math.PI);
      du = tu + dx;
      break;
    }
    case 'Fish': {
      // One side stretches vertically, other side squeezes, creating a fish shape.
      // Scale height linearly based on nx (left/right)
      const scale = 1 + b * 0.5 * nx;
      dv = 0.5 + (tv - 0.5) * scale;
      // Minor horizontal bulge
      const bulge = 1 + Math.abs(b) * 0.1 * (1 - nx * nx);
      du = 0.5 + (tu - 0.5) * bulge;
      break;
    }
    case 'Rise': {
      // Curves upward/downward slanting.
      // We can use a simple cubic/sinusoidal transition for rising curve.
      const dy = -b * 0.35 * nx;
      dv = tv + dy;
      break;
    }
    case 'Fish Eye': {
      // Magnifies center circularly.
      const rx = nx;
      const ry = ny;
      const dist = Math.sqrt(rx * rx + ry * ry);
      if (dist < 1) {
        const factor = 1 + b * 0.45 * (1 - dist);
        du = 0.5 + (tu - 0.5) * factor;
        dv = 0.5 + (tv - 0.5) * factor;
      }
      break;
    }
    case 'Inflate': {
      // Swells in all directions.
      const stretchX = 1 + b * 0.3 * (1 - nx * nx);
      const stretchY = 1 + b * 0.3 * (1 - ny * ny);
      du = 0.5 + (tu - 0.5) * stretchX;
      dv = 0.5 + (tv - 0.5) * stretchY;
      break;
    }
    case 'Squeeze': {
      // Opposite of bulge: pinches in the middle.
      const scale = 1 - b * 0.35 * (1 - nx * nx);
      dv = 0.5 + (tv - 0.5) * scale;
      const scaleX = 1 - b * 0.15 * (1 - ny * ny);
      du = 0.5 + (tu - 0.5) * scaleX;
      break;
    }
    case 'Twist': {
      // Spiral twist rotation around center.
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist < 1.414) {
        const angle = b * Math.PI * 0.3 * (1.414 - dist);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rx = tu - 0.5;
        const ry = tv - 0.5;
        du = 0.5 + rx * cos - ry * sin;
        dv = 0.5 + rx * sin + ry * cos;
      }
      break;
    }
    default:
      break;
  }

  // Map back to [-1, 1] for distortions using the modified coordinate
  const dnx = du * 2 - 1;
  const dny = dv * 2 - 1;

  // Apply horizontal and vertical distortion
  // In horizontal warp, horizontal distortion causes a perspective vertical stretching
  // on one side and squeezing on the other side.
  if (horizontalDistortion !== 0) {
    const hdFactor = horizontalDistortion / 100;
    // Scale vertical range based on horizontal position (dnx)
    dv = 0.5 + (dv - 0.5) * (1 + dnx * hdFactor * 0.5);
  }

  if (verticalDistortion !== 0) {
    const vdFactor = verticalDistortion / 100;
    // Scale horizontal range based on vertical position (dny)
    du = 0.5 + (du - 0.5) * (1 + dny * vdFactor * 0.5);
  }

  // 2. Transpose back if Vertical orientation.
  if (orientation === 'Vertical') {
    return {
      x: dv * w,
      y: du * h
    };
  }

  return {
    x: du * w,
    y: dv * h
  };
};

export const normalMapShader = `
struct Params {
  width: u32,
  height: u32,
  strength: f32,
};

@group(0) @binding(0) var depthTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= params.width || global_id.y >= params.height) {
    return;
  }

  let x = global_id.x;
  let y = global_id.y;
  let w = params.width;
  let h = params.height;

  // Use textureLoad for exact texel sampling (prevents edge ramps)
  let center = textureLoad(depthTexture, vec2<u32>(x, y), 0).r;
  let left   = textureLoad(depthTexture, vec2<u32>(select(0u, x - 1u, x > 0u), y), 0).r;
  let right  = textureLoad(depthTexture, vec2<u32>(select(w - 1u, x + 1u, x < w - 1u), y), 0).r;
  let top    = textureLoad(depthTexture, vec2<u32>(x, select(0u, y - 1u, y > 0u)), 0).r;
  let bottom = textureLoad(depthTexture, vec2<u32>(x, select(h - 1u, y + 1u, y < h - 1u)), 0).r;
  
  // Boundary detection threshold (prevents black outlines at depth jumps)
  let threshold = 0.1; 
  
  var dx = 0.0;
  let dL = center - left;
  let dR = right - center;
  
  // If both sides are smooth, use central difference for high quality
  if (abs(dL) < threshold && abs(dR) < threshold) {
    dx = (right - left) * 0.5;
  } else if (abs(dR) < threshold) {
    // Only right is valid, use one-sided difference
    dx = dR;
  } else if (abs(dL) < threshold) {
    // Only left is valid, use one-sided difference
    dx = dL;
  }
  
  var dy = 0.0;
  let dT = center - top;
  let dB = bottom - center;
  
  if (abs(dT) < threshold && abs(dB) < threshold) {
    dy = (bottom - top) * 0.5;
  } else if (abs(dB) < threshold) {
    dy = dB;
  } else if (abs(dT) < threshold) {
    dy = dT;
  }

  let normal = normalize(vec3<f32>(-dx * params.strength, -dy * params.strength, 1.0));
  let encodedNormal = vec4<f32>(normal * 0.5 + 0.5, center);

  textureStore(normalTexture, global_id.xy, encodedNormal);
}
`;

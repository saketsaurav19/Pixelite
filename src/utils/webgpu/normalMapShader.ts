export const normalMapShader = `
struct Params {
  width: u32,
  height: u32,
  strength: f32,
};

@group(0) @binding(0) var depthTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var samplerLinear: sampler;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= params.width || global_id.y >= params.height) {
    return;
  }

  let uv = vec2<f32>(f32(global_id.x) + 0.5, f32(global_id.y) + 0.5) / vec2<f32>(f32(params.width), f32(params.height));
  let texelSize = 1.0 / vec2<f32>(f32(params.width), f32(params.height));
  let aspect = f32(params.width) / f32(params.height);

  // Sample depth with bilinear filtering
  let left   = textureSampleLevel(depthTexture, samplerLinear, uv + vec2<f32>(-texelSize.x, 0.0), 0.0).r;
  let right  = textureSampleLevel(depthTexture, samplerLinear, uv + vec2<f32>( texelSize.x, 0.0), 0.0).r;
  let top    = textureSampleLevel(depthTexture, samplerLinear, uv + vec2<f32>(0.0, -texelSize.y), 0.0).r;
  let bottom = textureSampleLevel(depthTexture, samplerLinear, uv + vec2<f32>(0.0,  texelSize.y), 0.0).r;

  let dx = (right - left) * params.strength;
  let dy = (bottom - top) * params.strength * aspect;

  let centerDepth = textureSampleLevel(depthTexture, samplerLinear, uv, 0.0).r;
  let normal = normalize(vec3<f32>(-dx, -dy, 1.0));
  let encodedNormal = vec4<f32>(normal * 0.5 + 0.5, centerDepth);

  textureStore(normalTexture, global_id.xy, encodedNormal);
}
`;

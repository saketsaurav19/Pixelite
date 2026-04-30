export const lightingShader = `
struct Light {
  position: vec3<f32>,
  intensity: f32,
  color: vec3<f32>,
  radius: f32,
  lightType: f32,
  angle: f32,
  falloffType: f32,
  _padding1: f32,
  direction: vec3<f32>,
  _padding2: f32,
};

struct Params {
  canvasWidth: f32,
  canvasHeight: f32,
  layerX: f32,
  layerY: f32,
  numLights: u32,
  ambientIntensity: f32,
  depthScale: f32,
  _pad1: f32,
  ambientColor: vec3<f32>,
  _pad2: f32,
};

@group(0) @binding(0) var albedoTexture: texture_2d<f32>;
@group(0) @binding(1) var normalTexture: texture_2d<f32>;
@group(0) @binding(2) var samplerLinear: sampler;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var<storage, read> lights: array<Light>;
@group(0) @binding(5) var outputTexture: texture_storage_2d<rgba8unorm, write>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= u32(params.canvasWidth) || global_id.y >= u32(params.canvasHeight)) {
    return;
  }

  let uv = vec2<f32>(f32(global_id.x) + 0.5, f32(global_id.y) + 0.5) / vec2<f32>(params.canvasWidth, params.canvasHeight);
  let albedo = textureLoad(albedoTexture, vec2<u32>(global_id.xy), 0);
  
  // Normal map now contains depth in the alpha channel
  let sampledNormal = textureSampleLevel(normalTexture, samplerLinear, uv, 0.0);
  let normal = normalize(sampledNormal.rgb * 2.0 - 1.0);
  let depth = sampledNormal.a;

  // Pixel position in document coordinates
  let pixelPos = vec3<f32>(
    params.layerX + f32(global_id.x), 
    params.layerY + f32(global_id.y), 
    depth * params.depthScale
  );

  // View vector (assume camera is looking straight down from some distance)
  let viewPos = vec3<f32>(params.layerX + params.canvasWidth * 0.5, params.layerY + params.canvasHeight * 0.5, 1000.0);
  let V = normalize(viewPos - pixelPos);

  var totalLighting = params.ambientColor * params.ambientIntensity;

  for (var i = 0u; i < params.numLights; i++) {
    let light = lights[i];
    
    let lightDirVec = light.position - pixelPos;
    let distance = length(lightDirVec);
    let L = normalize(lightDirVec);
    
    // Attenuation
    var attenuation = 0.0;
    let d = distance / light.radius;
    if (light.falloffType > 0.5) {
      // Quadratic (Aggressive)
      attenuation = 1.0 / (1.0 + 2.0 * d + d * d);
    } else {
      // Linear/Smooth (Softer for Fill)
      attenuation = max(0.0, 1.0 - d);
      attenuation = attenuation * attenuation * (3.0 - 2.0 * attenuation); // Smoothstep-like
    }
    
    // Additional boost for broad fill lights
    if (light.radius > 1000.0) {
        attenuation = pow(attenuation, 0.7); // Makes the falloff even slower for large radii
    }
    
    // Light type specific calculations
    if (light.lightType > 0.5 && light.lightType < 1.5) { // Spotlight
      let spotDir = normalize(light.direction);
      let cosAngle = dot(-L, spotDir);
      let minCos = cos(light.angle);
      let outerCos = cos(light.angle + 0.2); // Soft edge
      let spotIntensity = smoothstep(outerCos, minCos, cosAngle);
      attenuation *= spotIntensity;
    }
    
    // Diffuse Calculation (Wrapped lighting for a fuller 360-degree feel)
    var diffuse = 0.0;
    if (light.lightType > 1.5) { // Area Light (Soft/Wrapped)
      diffuse = max(dot(normal, L) * 0.7 + 0.3, 0.0);
    } else {
      // Point/Spot: Use a standard Wrap factor to prevent harsh cutoffs
      diffuse = max(dot(normal, L) * 0.5 + 0.5, 0.0);
    }
    
    // Blinn-Phong Specular (Hardcoded shininess and intensity for stability)
    let H = normalize(L + V);
    let spec = pow(max(dot(normal, H), 0.0), 32.0);
    let specular = 0.5 * spec;
    
    totalLighting += light.color * light.intensity * (diffuse + specular) * attenuation;
  }

  let finalColor = vec4<f32>(albedo.rgb * totalLighting, albedo.a);
  textureStore(outputTexture, vec2<u32>(global_id.xy), finalColor);
}
`;

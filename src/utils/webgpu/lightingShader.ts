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
  showLightSource: f32, // 1.0 for true, 0.0 for false
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
  
  // Sample albedo with linear filtering for soft, anti-aliased edges
  let albedo = textureSampleLevel(albedoTexture, samplerLinear, uv, 0.0);
  
  // Sample normal with textureLoad for exact angles (prevents black outlines)
  let sampledNormal = textureLoad(normalTexture, vec2<u32>(global_id.xy), 0);
  let normal = normalize(sampledNormal.rgb * 2.0 - 1.0);
  let depth = sampledNormal.a;

  // Pixel position in document coordinates
  let pixelPos = vec3<f32>(
    params.layerX + f32(global_id.x), 
    params.layerY + f32(global_id.y), 
    (depth - 0.5) * params.depthScale
  );

  // View vector (camera is looking straight down at the center of the document)
  let viewPos = vec3<f32>(params.canvasWidth * 0.5, params.canvasHeight * 0.5, 1000.0);
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
    var omni = 0.0;
    if (light.lightType > 1.5) { // Area Light (Soft/Wrapped)
      diffuse = max(dot(normal, L) * 0.7 + 0.3, 0.0);
    } else {
      // Point/Spot: Use a standard Wrap factor to prevent harsh cutoffs
      diffuse = max(dot(normal, L) * 0.4 + 0.6, 0.0);
      
      // If point light (type 0), add an omnidirectional 'glow' that ignores normals
      if (light.lightType < 0.5) {
        omni = pow(max(0.0, 1.0 - d), 3.0) * 0.4 * params.showLightSource;
      }
    }
    let H = normalize(L + V);
    let spec = pow(max(dot(normal, H), 0.0), 32.0);
    var specular = 0.5 * spec;

    // Rim Lighting & Silhouette Logic
    // If the light is behind the subject (zDiff > 0), we want a silhouette on the front 
    // but a glowing 'Rim' on the edges.
    let zDiff = pixelPos.z - light.position.z;
    var rimBoost = 0.0;
    
    // Smooth transition into the silhouette (over 40 depth units)
    let behindFactor = smoothstep(-20.0, 20.0, zDiff);
    
    if (behindFactor > 0.0) {
        // As the light moves behind, we transition from Wrapped Diffuse to a sharp Silhouette
        let wrapDiffuse = diffuse;
        let sharpDiffuse = max(dot(normal, L), 0.0);
        diffuse = mix(wrapDiffuse, sharpDiffuse, behindFactor);
        
        // Rim Light: Boost the edges where the normal points toward the light (Fresnel effect)
        // Softened the power to reduce pixelation on high-contrast edges.
        let fresnel = pow(1.0 - max(dot(normal, V), 0.0), 3.0);
        rimBoost = fresnel * max(dot(normal, L), 0.0) * 2.5 * behindFactor;
        
        // Specular is generally blocked by the subject when light is behind
        specular *= (1.0 - behindFactor);
    }
    
    totalLighting += light.color * light.intensity * (diffuse + specular + omni + rimBoost) * attenuation;
  }

  let finalColor = vec4<f32>(albedo.rgb * totalLighting, albedo.a);
  textureStore(outputTexture, vec2<u32>(global_id.xy), finalColor);
}
`;

import { getGPUDevice } from './gpuDevice';
import { lightingShader } from './lightingShader';
import type { Light } from '../../store/types';

export class LightingRenderer {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;

  async init() {
    this.device = await getGPUDevice();
    const shaderModule = this.device.createShaderModule({
      code: lightingShader
    });

    this.pipeline = await this.device.createComputePipelineAsync({
      layout: 'auto',
      compute: {
        module: shaderModule,
        entryPoint: 'main'
      }
    });
  }

  async renderLighting(
    albedoTexture: GPUTexture,
    normalTexture: GPUTexture,
    lights: Light[],
    width: number,
    height: number,
    layerX: number = 0,
    layerY: number = 0,
    ambientIntensity: number = 0.1,
    ambientColor: string = '#ffffff',
    depthScale: number = 200.0
  ): Promise<GPUTexture> {
    if (!this.device || !this.pipeline) await this.init();
    const device = this.device!;

    const outputTexture = device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
    });

    const paramsBuffer = device.createBuffer({
      size: 64, // 16-byte aligned for vec3 at offset 48
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });


    // Use a single buffer write for all params to ensure alignment
    const paramsData = new ArrayBuffer(64);
    const f32View = new Float32Array(paramsData);
    const u32View = new Uint32Array(paramsData);

    f32View[0] = width;
    f32View[1] = height;
    f32View[2] = layerX;
    f32View[3] = layerY;
    u32View[4] = lights.length;
    f32View[5] = ambientIntensity;
    f32View[6] = depthScale;
    f32View[7] = 0; // _pad1

    // Ambient Color (vec3 needs 16-byte alignment, starts at byte 32 / offset 8)
    const rgb = this.parseHexColor(ambientColor);
    f32View[8] = rgb.r;
    f32View[9] = rgb.g;
    f32View[10] = rgb.b;
    f32View[11] = 0; // _pad2

    device.queue.writeBuffer(paramsBuffer, 0, paramsData);

    // Light struct size: 
    // position: vec3 (12) + intensity (4) = 16
    // color: vec3 (12) + radius (4) = 16
    // type: f32 (4) + direction: vec3 (12) = 16
    // angle: f32 (4) + falloff: f32 (4) + padding (8) = 16
    // Total: 64 bytes per light
    const lightBufferSize = Math.max(1, lights.length) * 64;
    const lightBuffer = device.createBuffer({
      size: lightBufferSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });

    const lightData = new Float32Array(lights.length * 16);
    lights.forEach((light, i) => {
      const offset = i * 16;
      // 0-3: pos.xyz, intensity
      lightData[offset + 0] = light.position.x;
      lightData[offset + 1] = light.position.y;
      lightData[offset + 2] = light.position.z;
      lightData[offset + 3] = light.intensity;

      // 4-7: color.rgb, radius
      const color = this.parseHexColor(light.color);
      lightData[offset + 4] = color.r;
      lightData[offset + 5] = color.g;
      lightData[offset + 6] = color.b;
      lightData[offset + 7] = light.radius;

      // 8-11: type, angle, falloff, pad
      lightData[offset + 8] = light.type === 'point' ? 0 : (light.type === 'spot' ? 1 : 2);
      lightData[offset + 9] = (light.angle || 45) * (Math.PI / 180);
      lightData[offset + 10] = light.falloff === 'linear' ? 0 : 1;
      lightData[offset + 11] = 0; // padding

      // 12-15: direction.xyz, pad
      lightData[offset + 12] = light.direction?.x || 0;
      lightData[offset + 13] = light.direction?.y || 0;
      lightData[offset + 14] = light.direction?.z || -1;
      lightData[offset + 15] = 0; // padding
    });

    device.queue.writeBuffer(lightBuffer, 0, lightData);

    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });

    const bindGroup = device.createBindGroup({
      layout: this.pipeline!.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: albedoTexture.createView() },
        { binding: 1, resource: normalTexture.createView() },
        { binding: 2, resource: sampler },
        { binding: 3, resource: { buffer: paramsBuffer } },
        { binding: 4, resource: { buffer: lightBuffer } },
        { binding: 5, resource: outputTexture.createView() }
      ]
    });

    const commandEncoder = device.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline!);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
    passEncoder.end();

    device.queue.submit([commandEncoder.finish()]);

    return outputTexture;
  }

  private parseHexColor(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return { r, g, b };
  }
}

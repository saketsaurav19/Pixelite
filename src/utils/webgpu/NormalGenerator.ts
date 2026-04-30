import { getGPUDevice } from './gpuDevice';
import { normalMapShader } from './normalMapShader';

export async function generateNormalMap(
  depthTexture: GPUTexture,
  width: number,
  height: number,
  strength: number = 5.0
): Promise<GPUTexture> {
  const device = await getGPUDevice();

  const normalTexture = device.createTexture({
    size: [width, height],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC
  });

  const paramsBuffer = device.createBuffer({
    size: 16, // u32, u32, f32, padding
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const paramsData = new Uint32Array([width, height]);
  const paramsFloatData = new Float32Array([strength]);

  device.queue.writeBuffer(paramsBuffer, 0, paramsData);
  device.queue.writeBuffer(paramsBuffer, 8, paramsFloatData);

  const shaderModule = device.createShaderModule({
    code: normalMapShader
  });

  const computePipeline = device.createComputePipeline({
    layout: 'auto',
    compute: {
      module: shaderModule,
      entryPoint: 'main'
    }
  });

  const sampler = device.createSampler({
    magFilter: 'linear',
    minFilter: 'linear'
  });

  const bindGroup = device.createBindGroup({
    layout: computePipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: depthTexture.createView() },
      { binding: 1, resource: normalTexture.createView() },
      { binding: 2, resource: sampler },
      { binding: 3, resource: { buffer: paramsBuffer } }
    ]
  });

  const commandEncoder = device.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(computePipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(Math.ceil(width / 16), Math.ceil(height / 16));
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);

  return normalTexture;
}

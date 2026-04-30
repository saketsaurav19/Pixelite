let device: GPUDevice | null = null;

export async function getGPUDevice(): Promise<GPUDevice> {
  if (device) return device;

  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: 'high-performance'
  });

  if (!adapter) {
    throw new Error('No appropriate GPU adapter found.');
  }

  device = await adapter.requestDevice();
  
  device.lost.then((info) => {
    console.error(`WebGPU device was lost: ${info.message}`);
    device = null;
  });

  return device;
}

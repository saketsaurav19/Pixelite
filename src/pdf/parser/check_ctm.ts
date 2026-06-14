import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Polyfills
if (typeof Promise !== 'undefined' && !(Promise as any).try) {
  (Promise as any).try = function (fn: Function, ...args: any[]) {
    return new Promise((resolve, reject) => {
      try { resolve(fn(...args)); } catch (err) { reject(err); }
    });
  };
}
if (typeof global !== 'undefined' && !(global as any).DOMMatrix) {
  (global as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: any) {
      if (Array.isArray(init)) {
        this.a = init[0] ?? 1;
        this.b = init[1] ?? 0;
        this.c = init[2] ?? 0;
        this.d = init[3] ?? 1;
        this.e = init[4] ?? 0;
        this.f = init[5] ?? 0;
      }
    }
  };
}

async function run() {
  const pdfjsLib = await import('pdfjs-dist');
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  // Set worker via pathToFileURL
  const workerPath = path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  const doc = await pdfjsLib.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  
  const opList = await page.getOperatorList();
  
  // Print all transform, save, restore, and image operators with their args and current CTM
  const OPS = pdfjsLib.OPS;
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  
  function matMul(m1: number[], m2: number[]): number[] {
    const [a1, b1, c1, d1, e1, f1] = m1;
    const [a2, b2, c2, d2, e2, f2] = m2;
    return [
      a1 * a2 + c1 * b2,
      b1 * a2 + d1 * b2,
      a1 * c2 + c1 * d2,
      b1 * c2 + d1 * d2,
      a1 * e2 + c1 * f2 + e1,
      b1 * e2 + d1 * f2 + f1,
    ];
  }

  console.log("=== OPERATOR LIST TRACE ===");
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    let args = opList.argsArray[i];
    
    if (fn === OPS.save) {
      stack.push([...ctm]);
      console.log(`[SAVE] Stack depth: ${stack.length}, CTM:`, ctm);
    } else if (fn === OPS.restore) {
      if (stack.length > 0) {
        ctm = stack.pop()!;
      }
      console.log(`[RESTORE] Stack depth: ${stack.length}, CTM:`, ctm);
    } else if (fn === OPS.transform) {
      // Handle array-like or Float32Array in args
      if (args && args.length === 1 && typeof args[0] === 'object' && args[0] !== null && 'length' in args[0]) {
        args = Array.from(args[0]);
      }
      ctm = matMul(ctm, args);
      console.log(`[TRANSFORM] Args:`, args, `-> CTM:`, ctm);
    } else if (
      fn === OPS.paintImageXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageXObjectRepeat ||
      fn === OPS.paintImageMaskXObject
    ) {
      console.log(`[IMAGE] Fn: ${fn}, Name: ${args[0]}, CTM:`, ctm);
    }
  }
  
  await doc.cleanup();
}

run().catch(console.error);

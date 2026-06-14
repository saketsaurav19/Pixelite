// Polyfill Promise.try (needed by PDF.js v6 in some Node.js versions)
if (typeof Promise !== 'undefined' && !(Promise as any).try) {
  (Promise as any).try = function (fn: Function, ...args: any[]) {
    return new Promise((resolve, reject) => {
      try {
        resolve(fn(...args));
      } catch (err) {
        reject(err);
      }
    });
  };
}

// Polyfill DOMMatrix for PDF.js Node environment support
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

import { createCanvas } from 'canvas';

// Polyfill document.createElement for canvas support in headless Node.js
if (typeof global !== 'undefined' && !(global as any).document) {
  (global as any).document = {
    createElement(tagName: string) {
      if (tagName.toLowerCase() === 'canvas') {
        return createCanvas(1, 1);
      }
      return null;
    }
  };
}

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx src/pdf/parser/cli-extractor.ts <pdf-file-path> [output-json-path]');
    process.exit(1);
  }

  const pdfPath = path.resolve(args[0]);
  const outputPath = args[1] ? path.resolve(args[1]) : pdfPath.replace(/\.pdf$/i, '') + '-extracted.json';

  console.log(`[CLI] Reading PDF from: ${pdfPath}`);
  if (!fs.existsSync(pdfPath)) {
    console.error(`Error: File not found: ${pdfPath}`);
    process.exit(1);
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  console.log(`[CLI] Loaded file buffer, length: ${data.byteLength} bytes`);

  // Dynamically load dependencies after the global polyfill is established
  console.log('[CLI] Loading parser engines...');
  const pdfjsLib = await import('pdfjs-dist');
  const { PdfFullExtractor } = await import('./PdfFullExtractor');

  // Resolve path to the PDF.js legacy worker in node_modules and convert to a valid file:// URL for Windows
  const workerPath = path.resolve(__dirname, '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;

  console.log('[CLI] Parsing PDF document...');
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;

  console.log(`[CLI] Document loaded successfully: ${doc.numPages} pages.`);
  console.log('[CLI] Extracting structural data and assets...');
  
  const result = await PdfFullExtractor.extractAll(doc);

  console.log(`[CLI] Extraction completed. Writing JSON output to: ${outputPath}`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log('[CLI] Done!');
  
  await doc.cleanup();
  process.exit(0);
}

run().catch(err => {
  console.error('[CLI] Critical Error:', err);
  process.exit(1);
});

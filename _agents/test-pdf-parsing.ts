import * as fs from 'fs';
import * as path from 'path';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PdfjsParser } from '../src/pdf/parser/PdfjsParser';

async function main() {
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at ${pdfPath}`);
    return;
  }

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjsLib.getDocument({ data }).promise;
  console.log(`PDF loaded. Pages: ${doc.numPages}`);

  const page = await doc.getPage(1);
  const parser = new PdfjsParser(page);
  const nodes = await parser.parseObjects();

  console.log(`Parsed ${nodes.length} nodes`);
  const textNodes = nodes.filter(n => n.type === 'text');
  console.log(`Found ${textNodes.length} text nodes`);

  const zeroOpacityNodes = textNodes.filter((n: any) => n.opacity === 0 || n.geometry.opacity === 0 || n.geometry.runs?.some((r: any) => r.opacity === 0));
  console.log(`Found ${zeroOpacityNodes.length} text nodes with opacity 0`);

  for (let i = 0; i < zeroOpacityNodes.length; i++) {
    const node = zeroOpacityNodes[i] as any;
    console.log(`Zero Opacity Node ${i}: "${node.geometry.text}"`);
    console.log(`  Layer Opacity: ${node.opacity}`);
    console.log(`  Geometry Opacity: ${node.geometry.opacity}`);
    console.log(`  Runs count: ${node.geometry.runs?.length}`);
    console.log(`  Zero opacity runs:`, node.geometry.runs?.filter((r: any) => r.opacity === 0).map((r: any) => r.str));
  }
}

main().catch(console.error);

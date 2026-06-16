const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { FontRegistry } = await import('../src/pdf/worker/engines/FontRegistry.js');
  const { shapeTextWasm } = await import('../src/pdf/worker/engines/WasmShaper.js');
  
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  
  console.log('--- Phase 1: Load PDF with fontExtraProperties: true ---');
  const doc = await pdfjs.getDocument({ data, fontExtraProperties: true }).promise;
  const page = await doc.getPage(1);
  
  console.log('Fetching text content to find referenced fonts...');
  const textContent = await page.getTextContent();
  const fontNames = new Set();
  for (const item of textContent.items) {
    if (item.fontName) {
      fontNames.add(item.fontName);
    }
  }
  console.log('Referenced font names in page 1:', Array.from(fontNames));
  
  console.log('Fetching operator list to load resources...');
  await page.getOperatorList();
  
  console.log('--- Phase 2: Register fonts in FontRegistry ---');
  for (const key of fontNames) {
    if (page.commonObjs.has(key)) {
      const f = page.commonObjs.get(key);
      if (f && f.data) {
        const fData = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : f.data;
        const checksum = await FontRegistry.computeSha256(fData);
        FontRegistry.register(checksum, f.name, fData, f.mimetype);
      }
    }
  }
  
  console.log('\n--- Phase 3: Shape text using the registered font ---');
  const allFonts = FontRegistry.getAll();
  const checksums = Object.keys(allFonts);
  console.log('All registered fonts:', Object.values(allFonts).map(f => f.name));
  
  if (checksums.length > 0) {
    const targetChecksum = checksums[0];
    const targetFont = allFonts[targetChecksum];
    console.log(`Shaping Devanagari text using font: ${targetFont.name} (SHA-256: ${targetChecksum})...`);
    
    // Devanagari text from PDF: "अंजनी बाबू"
    const textToShape = "अंजनी बाबू";
    const result = await shapeTextWasm(textToShape, 16, targetChecksum, targetFont.name);
    console.log(`Shaped successfully!`);
    console.log(`Result width: ${result.width}`);
    console.log(`Glyphs shaped: ${result.glyphs.length}`);
    for (let i = 0; i < Math.min(result.glyphs.length, 5); i++) {
      const g = result.glyphs[i];
      console.log(`  Glyph ${i}: x=${g.x.toFixed(2)}, xAdvance=${g.xAdvance.toFixed(2)}, pathLength=${g.path.length}`);
    }
  } else {
    throw new Error('No fonts registered in FontRegistry');
  }
}

main().catch(console.error);

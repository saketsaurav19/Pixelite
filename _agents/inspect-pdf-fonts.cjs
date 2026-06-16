const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  console.log('Loading PDF document...');
  const doc = await pdfjs.getDocument({ data, fontExtraProperties: true }).promise;
  const page = await doc.getPage(1);
  
  console.log('Fetching text content...');
  const textContent = await page.getTextContent();
  const fontNames = new Set();
  for (const item of textContent.items) {
    if (item.fontName) {
      fontNames.add(item.fontName);
    }
  }
  
  console.log(`Found referenced font keys:`, Array.from(fontNames));
  
  // Also trigger operator list parsing so they are loaded into commonObjs
  console.log('Fetching operator list...');
  await page.getOperatorList();

  console.log('\nExtracted Fonts from PDF Page 1:');
  for (const key of fontNames) {
    if (page.commonObjs.has(key)) {
      const f = page.commonObjs.get(key);
      if (f && f.data) {
        const fData = f.data instanceof ArrayBuffer ? new Uint8Array(f.data) : f.data;
        console.log(`Key: ${key}`);
        console.log(`  Name: ${f.name}`);
        console.log(`  Mimetype: ${f.mimetype}`);
        console.log(`  Size: ${fData.length} bytes`);
        console.log(`  SHA-256: ${sha256(fData)}`);
      } else {
        console.log(`Key: ${key} exists in commonObjs, but has no data.`);
      }
    } else {
      console.log(`Key: ${key} is not present in commonObjs.`);
    }
  }
}

main().catch(console.error);

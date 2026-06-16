const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at ${pdfPath}`);
    return;
  }
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const opList = await page.getOperatorList();
  const OPS = pdfjs.OPS;

  function getFlatArgs(args) {
    if (!args || args.length === 0) return [];
    const first = args[0];
    if (first !== null && typeof first === 'object') {
      if ('0' in first) {
        const list = [];
        let i = 0;
        while (String(i) in first) {
          list.push(first[String(i)]);
          i++;
        }
        return list;
      }
      if ('length' in first && typeof first.length === 'number') {
        return Array.from(first);
      }
    }
    return args;
  }

  function getColorComponents(args) {
    if (!args || args.length === 0) return [];
    const first = args[0];
    if (first !== null && typeof first === 'object' && 'length' in first && typeof first.length === 'number') {
      return Array.from(first);
    }
    return args.filter(x => typeof x === 'number');
  }

  console.log("Analyzing Color Operators...");
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const rawArgs = opList.argsArray[i];
    const args = getFlatArgs(rawArgs);

    if (
      fn === OPS.setFillRGBColor ||
      fn === OPS.setFillGray ||
      fn === OPS.setFillCMYKColor ||
      fn === OPS.setFillColor ||
      fn === OPS.setFillColorN ||
      fn === OPS.setStrokeRGBColor ||
      fn === OPS.setStrokeGray ||
      fn === OPS.setStrokeCMYKColor ||
      fn === OPS.setStrokeColor ||
      fn === OPS.setStrokeColorN
    ) {
      const opName = Object.keys(OPS).find(key => OPS[key] === fn);
      const comps = getColorComponents(args);
      console.log(`Op: ${opName} (fn: ${fn})`);
      console.log(`  Raw Args:`, JSON.stringify(rawArgs));
      console.log(`  Flat Args:`, JSON.stringify(args));
      console.log(`  Color Comps:`, JSON.stringify(comps));
      
      const hasNaN = comps.some(c => typeof c !== 'number' || Number.isNaN(c));
      if (hasNaN || comps.length === 0) {
        console.warn(`  ⚠️ Warning: empty or NaN color components!`);
      }
    }
  }
}

main().catch(console.error);

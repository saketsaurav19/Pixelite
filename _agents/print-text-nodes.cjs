const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.0 });
  const pageHeight = viewport.height;
  
  console.log(`Page Dimensions: ${viewport.width} x ${viewport.height}`);
  
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
  
  const state = {
    current: {
      ctm: [1, 0, 0, 1, 0, 0],
      textMatrix: [1, 0, 0, 1, 0, 0],
      fontSize: 12
    },
    stack: [],
    save() {
      this.stack.push({ ...this.current, ctm: [...this.current.ctm], textMatrix: [...this.current.textMatrix] });
    },
    restore() {
      if (this.stack.length > 0) this.current = this.stack.pop();
    },
    transform(a, b, c, d, e, f) {
      this.current.ctm = pdfjs.Util.transform(this.current.ctm, [a, b, c, d, e, f]);
    },
    setTextMatrix(a, b, c, d, e, f) {
      this.current.textMatrix = [a, b, c, d, e, f];
    },
    moveTextPosition(tx, ty) {
      const [a, b, c, d, e, f] = this.current.textMatrix;
      this.current.textMatrix = [a, b, c, d, e + tx * a + ty * c, f + tx * b + ty * d];
    },
    setFont(fontName, fontSize) {
      this.current.fontSize = fontSize;
    }
  };
  
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    
    if (fn === OPS.save) state.save();
    else if (fn === OPS.restore) state.restore();
    else if (fn === OPS.transform) {
      const flat = getFlatArgs(args);
      state.transform(flat[0], flat[1], flat[2], flat[3], flat[4], flat[5]);
    } else if (fn === OPS.setTextMatrix) {
      const flat = getFlatArgs(args);
      state.setTextMatrix(flat[0], flat[1], flat[2], flat[3], flat[4], flat[5]);
    } else if (fn === OPS.moveText) {
      const flat = getFlatArgs(args);
      state.moveTextPosition(flat[0], flat[1]);
    } else if (fn === OPS.setFont) {
      const flat = getFlatArgs(args);
      state.setFont(flat[0], flat[1]);
    }
  }
  
  const textContent = await page.getTextContent();
  const parsedItems = [];
  
  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const transform = item.transform;
    const x = transform[4];
    const inferredFontSize = Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]) || 0;
    const fontSize = Math.max(item.height || 0, inferredFontSize, 12);
    const baselineY = pageHeight - transform[5];
    const y = baselineY - fontSize * 0.85;
    
    parsedItems.push({
      str: item.str,
      x,
      y,
      fontSize,
      width: item.width,
      height: item.height
    });
  }
  
  console.log("Sample Text Nodes (first 15 items):");
  parsedItems.slice(0, 15).forEach((node, idx) => {
    console.log(`[${idx}] "${node.str}" at x=${node.x.toFixed(1)}, y=${node.y.toFixed(1)}, fs=${node.fontSize.toFixed(1)}, width=${node.width.toFixed(1)}`);
  });
}

main().catch(console.error);

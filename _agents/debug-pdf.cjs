const fs = require('fs');
const path = require('path');

async function main() {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdfPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
  
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const opList = await page.getOperatorList();
  const OPS = pdfjs.OPS;
  
  function rgbToHex(r, g, b) {
    const toHex = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  function cmykToHex(c, m, y, k) {
    const r = 1 - Math.min(1, c + k);
    const g = 1 - Math.min(1, m + k);
    const b = 1 - Math.min(1, y + k);
    return rgbToHex(r, g, b);
  }
  
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
      fillColor: '#000000',
      fillColorSpace: 'rgb'
    },
    stack: [],
    save() {
      this.stack.push({
        ...this.current,
        ctm: [...this.current.ctm],
        textMatrix: [...this.current.textMatrix]
      });
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
    setFillColorString(color) {
      this.current.fillColor = color;
    },
    setFillRGBColor(r, g, b) {
      this.current.fillColor = rgbToHex(r, g, b);
      this.current.fillColorSpace = 'rgb';
    },
    setFillGray(gray) {
      this.current.fillColor = rgbToHex(gray, gray, gray);
      this.current.fillColorSpace = 'gray';
    },
    setFillCMYK(c, m, y, k) {
      this.current.fillColor = cmykToHex(c, m, y, k);
      this.current.fillColorSpace = 'cmyk';
    },
    setFillColorSpace(cs) {
      this.current.fillColorSpace = cs === 'DeviceGray' ? 'gray' : cs === 'DeviceCMYK' ? 'cmyk' : 'rgb';
    },
    setFillColorComponents(comps) {
      if (this.current.fillColorSpace === 'gray' && comps.length >= 1) {
        this.setFillGray(comps[0]);
      } else if (this.current.fillColorSpace === 'cmyk' && comps.length >= 4) {
        this.setFillCMYK(comps[0], comps[1], comps[2], comps[3]);
      } else if (comps.length >= 3) {
        this.setFillRGBColor(comps[0], comps[1], comps[2]);
      }
    }
  };

  function applyStateOp(fn, rawArgs) {
    const args = getFlatArgs(rawArgs);
    
    if (fn === OPS.save) state.save();
    else if (fn === OPS.restore) state.restore();
    else if (fn === OPS.transform) {
      state.transform(args[0], args[1], args[2], args[3], args[4], args[5]);
    } else if (fn === OPS.setTextMatrix) {
      state.setTextMatrix(args[0], args[1], args[2], args[3], args[4], args[5]);
    } else if (fn === OPS.moveText) {
      state.moveTextPosition(args[0], args[1]);
    } else if (fn === OPS.setFillColorSpace) {
      state.setFillColorSpace(args[0]);
    } else if (fn === OPS.setFillRGBColor) {
      if (typeof args[0] === 'string') {
        state.setFillColorString(args[0]);
      } else {
        state.setFillRGBColor(args[0], args[1], args[2]);
      }
    } else if (fn === OPS.setFillGray) {
      if (typeof args[0] === 'string') {
        state.setFillColorString(args[0]);
      } else {
        state.setFillGray(args[0]);
      }
    } else if (fn === OPS.setFillCMYKColor) {
      if (typeof args[0] === 'string') {
        state.setFillColorString(args[0]);
      } else {
        state.setFillCMYK(args[0], args[1], args[2], args[3]);
      }
    } else if (fn === OPS.setFillColor || fn === OPS.setFillColorN) {
      if (typeof args[0] === 'string') {
        state.setFillColorString(args[0]);
      } else {
        if (args.length > 0) {
          state.setFillColorComponents(args);
        }
      }
    }
  }

  const textItemStates = [];
  
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    applyStateOp(fn, args);
    if (
      fn === OPS.showText ||
      fn === OPS.showSpacedText ||
      fn === OPS.nextLineShowText ||
      fn === OPS.nextLineSetSpacingShowText
    ) {
      textItemStates.push({
        opIndex: i,
        ctm: [...state.current.ctm],
        textMatrix: [...state.current.textMatrix],
        fillColor: state.current.fillColor
      });
    }
  }
  
  const textContent = await page.getTextContent();
  const colorMap = new Map();
  
  for (const item of textContent.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    
    let matchedState = null;
    let minDistance = Infinity;
    const itemX = item.transform[4];
    const itemY = item.transform[5];
    
    for (let s = 0; s < textItemStates.length; s++) {
      const snap = textItemStates[s];
      const snapTransform = pdfjs.Util.transform(snap.ctm, snap.textMatrix);
      const snapX = snapTransform[4];
      const snapY = snapTransform[5];
      
      const dx = snapX - itemX;
      const dy = snapY - itemY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < minDistance) {
        minDistance = dist;
        matchedState = snap;
      }
    }
    
    // If matched at a reasonable distance (e.g. < 25px)
    const color = (matchedState && minDistance < 25) ? matchedState.fillColor : 'unmatched';
    const list = colorMap.get(color) || [];
    list.push(item.str);
    colorMap.set(color, list);
  }
  
  console.log("Global Color Extraction Summary:");
  for (const [color, list] of colorMap.entries()) {
    console.log(`Color ${color}: ${list.length} items. Sample: "${list.slice(0, 5).join(' | ')}"`);
  }
}

main().catch(console.error);

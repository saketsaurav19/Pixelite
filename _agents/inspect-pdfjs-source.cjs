const fs = require('fs');
const path = require('path');

const pdfjsPath = require.resolve('pdfjs-dist/legacy/build/pdf.mjs');
const content = fs.readFileSync(pdfjsPath, 'utf8');
const lines = content.split('\n');

let found = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('class PDFObjects')) {
    found = i;
    console.log(`Found PDFObjects at line ${i + 1}:`);
    for (let j = i; j < i + 40; j++) {
      console.log(`${j + 1}: ${lines[j]}`);
    }
    break;
  }
}

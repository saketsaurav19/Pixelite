import piexif from 'piexifjs';

function crc32(buffer: Uint8Array): number {
  let c;
  let crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }

  let crc = 0 ^ (-1);
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

export function insertExifToPng(pngDataUrl: string, exifObj: any): string {
  const base64Data = pngDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const exifStr = piexif.dump(exifObj);
  const tiffStr = exifStr.substring(6); // strip "Exif\0\0"

  const exifBytes = new Uint8Array(tiffStr.length);
  for (let i = 0; i < tiffStr.length; i++) {
    exifBytes[i] = tiffStr.charCodeAt(i);
  }

  const chunkType = new Uint8Array([101, 88, 73, 102]); // eXIf
  const chunkLength = exifBytes.length;

  const chunkTypeAndData = new Uint8Array(4 + chunkLength);
  chunkTypeAndData.set(chunkType, 0);
  chunkTypeAndData.set(exifBytes, 4);

  const crc = crc32(chunkTypeAndData);

  const eXIfChunk = new Uint8Array(4 + 4 + chunkLength + 4);
  new DataView(eXIfChunk.buffer).setUint32(0, chunkLength, false); // Length
  eXIfChunk.set(chunkTypeAndData, 4); // Type + Data
  new DataView(eXIfChunk.buffer).setUint32(4 + 4 + chunkLength, crc, false); // CRC

  const ihdrEnd = 8 + 4 + 4 + 13 + 4; // Magic (8) + IHDR length (4) + 'IHDR' (4) + Data (13) + CRC (4)

  const newPngBytes = new Uint8Array(bytes.length + eXIfChunk.length);
  newPngBytes.set(bytes.subarray(0, ihdrEnd), 0);
  newPngBytes.set(eXIfChunk, ihdrEnd);
  newPngBytes.set(bytes.subarray(ihdrEnd), ihdrEnd + eXIfChunk.length);

  let newBinaryString = '';
  for (let i = 0; i < newPngBytes.length; i++) {
    newBinaryString += String.fromCharCode(newPngBytes[i]);
  }

  return 'data:image/png;base64,' + btoa(newBinaryString);
}

export function insertExifToWebp(webpDataUrl: string, exifObj: any): string {
  const base64Data = webpDataUrl.split(',')[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const exifStr = piexif.dump(exifObj);
  const tiffStr = exifStr.substring(6); // strip "Exif\0\0"
  const exifBytes = new Uint8Array(tiffStr.length);
  for (let i = 0; i < tiffStr.length; i++) {
    exifBytes[i] = tiffStr.charCodeAt(i);
  }

  // Find VP8X chunk
  let offset = 12;
  let vp8xOffset = -1;
  let hasVP8X = false;

  while (offset < bytes.length) {
    const chunkId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
    const chunkLength = new DataView(bytes.buffer).getUint32(offset + 4, true);

    if (chunkId === 'VP8X') {
      hasVP8X = true;
      vp8xOffset = offset;
      break;
    }

    offset += 8 + chunkLength;
    if (chunkLength % 2 !== 0) offset++; // padding
  }

  let newBytes;
  if (hasVP8X) {
    newBytes = new Uint8Array(bytes.length);
    newBytes.set(bytes);
    // set EXIF flag (bit 3 of first byte of VP8X chunk data)
    newBytes[vp8xOffset + 8] |= 0x08;
  } else {
    let w = 0, h = 0;
    let imgChunkOffset = 12;
    let imgChunkId = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);

    if (imgChunkId === 'VP8 ') {
       const wAndH = new Uint8Array(bytes.buffer, imgChunkOffset + 8 + 6, 4);
       w = wAndH[0] | ((wAndH[1] & 0x3f) << 8);
       h = wAndH[2] | ((wAndH[3] & 0x3f) << 8);
    } else if (imgChunkId === 'VP8L') {
       const b0 = bytes[imgChunkOffset + 8 + 1];
       const b1 = bytes[imgChunkOffset + 8 + 2];
       const b2 = bytes[imgChunkOffset + 8 + 3];
       const b3 = bytes[imgChunkOffset + 8 + 4];
       w = 1 + (((b1 & 0x3F) << 8) | b0);
       h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
    }

    const vp8xChunk = new Uint8Array(18);
    vp8xChunk[0] = 86; vp8xChunk[1] = 80; vp8xChunk[2] = 56; vp8xChunk[3] = 88; // VP8X
    new DataView(vp8xChunk.buffer).setUint32(4, 10, true); // size 10
    vp8xChunk[8] = 0x08; // EXIF flag

    // Width and Height minus 1 (24-bit)
    const mw = w - 1;
    const mh = h - 1;
    vp8xChunk[12] = mw & 0xFF;
    vp8xChunk[13] = (mw >> 8) & 0xFF;
    vp8xChunk[14] = (mw >> 16) & 0xFF;
    vp8xChunk[15] = mh & 0xFF;
    vp8xChunk[16] = (mh >> 8) & 0xFF;
    vp8xChunk[17] = (mh >> 16) & 0xFF;

    newBytes = new Uint8Array(bytes.length + 18);
    newBytes.set(bytes.subarray(0, 12), 0); // RIFF header + WEBP
    newBytes.set(vp8xChunk, 12);
    newBytes.set(bytes.subarray(12), 12 + 18);
  }

  const exifChunkSize = exifBytes.length;
  const exifChunkSizePadded = exifChunkSize + (exifChunkSize % 2);
  const exifChunk = new Uint8Array(8 + exifChunkSizePadded);
  exifChunk[0] = 69; exifChunk[1] = 88; exifChunk[2] = 73; exifChunk[3] = 70; // EXIF
  new DataView(exifChunk.buffer).setUint32(4, exifChunkSize, true);
  exifChunk.set(exifBytes, 8);

  const finalBytes = new Uint8Array(newBytes.length + exifChunk.length);
  finalBytes.set(newBytes, 0);
  finalBytes.set(exifChunk, newBytes.length);

  // Update RIFF file size
  new DataView(finalBytes.buffer).setUint32(4, finalBytes.length - 8, true);

  let newBinaryString = '';
  for (let i = 0; i < finalBytes.length; i++) {
    newBinaryString += String.fromCharCode(finalBytes[i]);
  }

  return 'data:image/webp;base64,' + btoa(newBinaryString);
}

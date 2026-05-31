export function mapExifrToPiexif(parsed: any) {
  const piexifData: any = { "0th": {}, "1st": {}, "Exif": {}, "GPS": {}, "Interop": {} };

  if (!parsed) return piexifData;

  const mapping: { [key: string]: string } = {
    ifd0: '0th',
    ifd1: '1st',
    exif: 'Exif',
    gps: 'GPS',
    interop: 'Interop'
  };

  for (const [exifrKey, piexifKey] of Object.entries(mapping)) {
    if (parsed[exifrKey]) {
      for (const [tag, value] of Object.entries(parsed[exifrKey])) {
        const tagNum = parseInt(tag);
        if (!isNaN(tagNum)) {
          // If value is a Uint8Array, piexif dump might expect Array or binary string depending on the tag, but usually Array is safe.
          let processedValue = value;
          if (value instanceof Uint8Array) {
              processedValue = Array.from(value);
          }
          piexifData[piexifKey][tagNum] = processedValue;
        }
      }
    }
  }
  return piexifData;
}

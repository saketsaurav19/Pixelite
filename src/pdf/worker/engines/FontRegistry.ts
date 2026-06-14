export interface RegisteredFont {
  name: string;
  data: Uint8Array;
  mimetype: string;
}

export class FontRegistry {
  private static fonts: Record<string, RegisteredFont> = {};

  /**
   * Registers a font in the global registry.
   */
  static register(checksum: string, name: string, data: Uint8Array, mimetype: string): void {
    this.fonts[checksum] = { name, data, mimetype };
    console.log(`[FontRegistry] Registered font: ${name} (SHA-256: ${checksum}, size: ${data.length} bytes)`);
  }

  /**
   * Look up a font by its checksum.
   */
  static get(checksum: string): RegisteredFont | undefined {
    return this.fonts[checksum];
  }

  /**
   * Look up a font by its original PostScript name (stripping PDF subset prefix like 'AAAAAA+').
   */
  static getByName(name: string): RegisteredFont | undefined {
    const cleanName = name.replace(/^[A-Z]{6}\+/, '').toLowerCase();
    return Object.values(this.fonts).find(f => {
      const fClean = f.name.replace(/^[A-Z]{6}\+/, '').toLowerCase();
      return fClean === cleanName;
    });
  }

  /**
   * Get all registered fonts.
   */
  static getAll(): Record<string, RegisteredFont> {
    return this.fonts;
  }

  /**
   * Computes the SHA-256 hash of a Uint8Array.
   * Works in browser environments, workers, and Node.js.
   */
  static async computeSha256(data: Uint8Array): Promise<string> {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      try {
        const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        console.warn('[FontRegistry] Web Crypto digest failed, using fallback:', e);
      }
    }

    // Node.js dynamic require fallback (useful for tests/build scripts)
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const cryptoMod = require('crypto');
      if (cryptoMod && cryptoMod.createHash) {
        return cryptoMod.createHash('sha256').update(data).digest('hex');
      }
    } catch (e) {
      // ignore
    }

    // Simple FNV-1a non-cryptographic fallback hash for safety
    let hash = 2166136261;
    for (let i = 0; i < data.length; i++) {
      hash ^= data[i];
      hash = Math.imul(hash, 16777619);
    }
    return 'simple-' + Math.abs(hash).toString(16);
  }
}

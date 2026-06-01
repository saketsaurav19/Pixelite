export class FileSystemService {
  /**
   * Opens a file picker dialog and returns the selected files.
   */
  static async openFiles(options: { multiple?: boolean, accept?: string } = {}): Promise<File[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = options.multiple || false;
      if (options.accept) {
        input.accept = options.accept;
      }

      input.onchange = (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
          resolve(Array.from(files));
        } else {
          resolve([]);
        }
        input.remove();
      };

      // Handle cancellation (not fully reliable across all browsers, but good practice)
      input.oncancel = () => {
        resolve([]);
        input.remove();
      };

      input.click();
    });
  }

  /**
   * Triggers a download for a Blob.
   */
  static downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Slight delay to ensure download starts before revoking
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  }
}

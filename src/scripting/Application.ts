import { Document } from './Document';
import { useStore } from '../store/useStore';

export class Application {
  get activeDocument(): Document {
    return new Document();
  }

  get documents(): Document[] {
      // In the current architecture we only have one active document at a time
      return [new Document()];
  }

  // Expose store for advanced debugging or bypassing the abstraction
  get _store() {
      return useStore;
  }
}

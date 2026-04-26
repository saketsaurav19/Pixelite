export const shouldClear = (mode: string, shift: boolean, alt: boolean) => 
  mode === 'new' && !shift && !alt;

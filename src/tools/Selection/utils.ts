export const shouldClear = (mode: string, shift: boolean, alt: boolean) =>
  mode === 'replace' && !shift && !alt;

export const getSelectionOp = (mode: string, shift: boolean, alt: boolean): 'replace' | 'subtract' | 'intersect' | 'unite' => {
  if (mode === 'replace' && !shift && !alt) return 'replace';
  if (mode === 'unite' || (mode === 'replace' && shift && !alt)) return 'unite';
  if (mode === 'subtract' || alt) return 'subtract';
  if (mode === 'intersect' || (mode === 'replace' && shift && alt)) return 'intersect';
  return 'replace';
};

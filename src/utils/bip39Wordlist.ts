import { wordlist as englishWordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Generates a 3-word mnemonic phrase using official BIP39 wordlist library (@scure/bip39)
 * Example: "apple-river-forest"
 */
export function generateThreeWordMnemonic(): string {
  const getRandomWord = () => englishWordlist[Math.floor(Math.random() * englishWordlist.length)];
  const w1 = getRandomWord();
  let w2 = getRandomWord();
  while (w2 === w1) w2 = getRandomWord();
  let w3 = getRandomWord();
  while (w3 === w1 || w3 === w2) w3 = getRandomWord();

  return `${w1}-${w2}-${w3}`;
}

/**
 * Normalizes user input room code (e.g. "Apple River Forest" -> "apple-river-forest").
 */
export function normalizeRoomCode(input: string): string {
  if (!input) return '';
  let clean = input.toLowerCase().trim();
  if (clean.includes('room=')) {
    const match = clean.match(/[?&]room=([^&]+)/);
    if (match) clean = match[1];
  }
  return clean.replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '');
}

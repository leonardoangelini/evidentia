/**
 * Text normalisation and counting. One algorithm for the whole system so
 * that snapshots, diffs, pastes and metrics are comparable.
 */

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF\u2060\u00AD]/g;
const NBSP = /[\u00A0\u202F\u2007]/g;
const MULTI_SPACE = /[ \t]+/g;

/** Normalise a single line/paragraph of text. */
export function normalizeLine(text: string): string {
  return text.replace(ZERO_WIDTH, '').replace(NBSP, ' ').replace(MULTI_SPACE, ' ').trim();
}

/** Normalise a whole document: paragraphs separated by single newlines. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(normalizeLine)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split normalised text into words (whitespace-delimited tokens). */
export function tokenizeWords(text: string): string[] {
  const normalized = normalizeLine(text.replace(/\n/g, ' '));
  if (normalized === '') return [];
  return normalized.split(' ').filter((w) => w.length > 0);
}

export function countWords(text: string): number {
  return tokenizeWords(text).length;
}

export function countCharacters(text: string): number {
  return normalizeText(text).length;
}

/** Split normalised text into non-empty paragraphs. */
export function splitParagraphs(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/** Truncate for excerpts, keeping whole words where possible. */
export function excerpt(text: string, maxChars = 200): string {
  const normalized = normalizeLine(text.replace(/\n/g, ' '));
  if (normalized.length <= maxChars) return normalized;
  const cut = normalized.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

/** Approximate UTF-8 byte size without allocating. */
export function approxUtf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** Locale-aware integer formatting used in the UI (it-IT style separators). */
export function formatInt(n: number): string {
  return new Intl.NumberFormat('it-IT').format(Math.round(n));
}

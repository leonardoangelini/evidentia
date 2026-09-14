import { countWords, normalizeText, splitParagraphs, tokenizeWords, excerpt, approxUtf8Bytes } from '@/utils/text';

describe('word counting', () => {
  it('counts whitespace-delimited words', () => {
    expect(countWords('Uno due  tre\nquattro')).toBe(4);
  });
  it('ignores NBSP, zero-width chars and leading/trailing spaces', () => {
    expect(countWords('​  ciao mondo ﻿')).toBe(2);
  });
  it('returns 0 for empty text', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n  ')).toBe(0);
  });
  it('splits paragraphs dropping empty lines', () => {
    expect(splitParagraphs('a\n\n\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });
  it('normalises consistently', () => {
    expect(normalizeText('a  b\r\n\r\n\r\nc')).toBe('a b\n\nc');
    expect(tokenizeWords('a-b c')).toEqual(['a-b', 'c']);
  });
  it('excerpts on word boundaries', () => {
    const e = excerpt('parola '.repeat(50), 40);
    expect(e.length).toBeLessThanOrEqual(41);
    expect(e.endsWith('…')).toBe(true);
  });
  it('estimates utf-8 bytes', () => {
    expect(approxUtf8Bytes('abc')).toBe(3);
    expect(approxUtf8Bytes('è')).toBe(2);
  });
});

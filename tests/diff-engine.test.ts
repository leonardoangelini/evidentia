import { computeDiff } from '@/analysis/diff-engine';
import type { Snapshot } from '@/models';

function snap(index: number, text: string | null, extra: Partial<Snapshot> = {}): Snapshot {
  const paragraphs = text ? text.split('\n') : [];
  return {
    id: `s${index}`,
    documentId: 'd',
    index,
    versionId: String(512 + index),
    versionLabel: `${index + 1}.0`,
    timestamp: new Date(Date.parse('2026-09-12T09:00:00+02:00') + index * 60_000).toISOString(),
    authorLabel: 'Autore 1',
    isCurrent: false,
    sizeBytes: null,
    wordCount: text ? text.split(/\s+/).filter(Boolean).length : 0,
    characterCount: text?.length ?? 0,
    paragraphCount: paragraphs.length,
    text,
    textHash: text ? `h${index}` : '',
    paragraphHashes: paragraphs.map((p) => `p:${p}`),
    headings: [],
    extractionStatus: text === null ? 'UNAVAILABLE' : 'FULL',
    extractionNotes: [],
    sourceHash: null,
    hash: '',
    ...extra,
  };
}

describe('diff engine', () => {
  it('classifies pure additions', () => {
    const d = computeDiff(snap(0, 'uno due tre'), snap(1, 'uno due tre\nquattro cinque sei sette otto nove dieci'));
    expect(d.classification).toBe('ADDING');
    expect(d.paragraphsAdded).toBe(1);
    expect(d.wordsAdded).toBe(7);
    expect(d.wordsDeleted).toBe(0);
    expect(d.addedBlocks[0]?.words).toBe(7);
    expect(d.elapsedMs).toBe(60_000);
    expect(d.basis).toBe('TEXT');
  });
  it('classifies deletions', () => {
    const d = computeDiff(snap(0, 'a b c d e f g h\nx y'), snap(1, 'x y'));
    expect(d.classification).toBe('DELETING');
    expect(d.paragraphsDeleted).toBe(1);
    expect(d.deletedBlocks).toHaveLength(1);
  });
  it('detects rewriting of a paragraph with replaced words', () => {
    const d = computeDiff(snap(0, 'intro\nla scuola promuove il pensiero critico\nfine'), snap(1, 'intro\nla scuola sostiene il pensiero autonomo\nfine'));
    expect(d.paragraphsModified).toBe(1);
    expect(d.wordsAdded).toBe(2);
    expect(d.wordsDeleted).toBe(2);
    expect(d.wordsReplaced).toBe(2);
    expect(d.classification).toBe('REWRITING');
    expect(d.wordCountDelta).toBe(0);
  });
  it('reports UNCHANGED for identical text', () => {
    const d = computeDiff(snap(0, 'a b'), snap(1, 'a b'));
    expect(d.classification).toBe('UNCHANGED');
  });
  it('falls back to paragraph hashes without text', () => {
    const a = snap(0, 'p1\np2', { text: null, extractionStatus: 'FULL' });
    const b = snap(1, 'p1\np2 changed\np3', { text: null, extractionStatus: 'FULL' });
    const d = computeDiff(a, b);
    expect(d.basis).toBe('PARAGRAPH_HASHES');
    expect(d.paragraphsModified).toBe(1);
    expect(d.paragraphsAdded).toBe(1);
    expect(d.addedBlocks).toHaveLength(0);
  });
  it('is UNKNOWN when a side is unavailable', () => {
    const d = computeDiff(snap(0, null), snap(1, 'a b c'));
    expect(d.basis).toBe('COUNTS_ONLY');
    expect(d.classification).toBe('UNKNOWN');
  });
});

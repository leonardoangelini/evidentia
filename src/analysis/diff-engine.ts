/**
 * Diff between two consecutive snapshots.
 *
 * Paragraph level first (Myers diff on paragraph strings or hashes), then
 * word level inside paragraphs that were replaced by a comparable block.
 * Classification describes the shape of the change, not intent.
 */
import { diffArrays } from 'diff';
import type { DiffBasis, DiffClassification, Snapshot, SnapshotDiff, TextBlock } from '@/models';
import { newId } from '@/utils/id';
import { excerpt, splitParagraphs, tokenizeWords } from '@/utils/text';
import { diffMs } from '@/utils/time';

const MAX_BLOCKS = 8;
const MIN_BLOCK_WORDS = 6;

export interface DiffOptions {
  maxBlocks?: number;
}

export function computeDiff(from: Snapshot, to: Snapshot, options: DiffOptions = {}): SnapshotDiff {
  const maxBlocks = options.maxBlocks ?? MAX_BLOCKS;
  const base: Omit<SnapshotDiff, 'wordsAdded' | 'wordsDeleted' | 'wordsReplaced' | 'paragraphsAdded' | 'paragraphsDeleted' | 'paragraphsModified' | 'classification' | 'addedBlocks' | 'deletedBlocks' | 'basis'> = {
    id: newId('diff'),
    documentId: to.documentId,
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    fromIndex: from.index,
    toIndex: to.index,
    elapsedMs: Math.max(0, diffMs(from.timestamp, to.timestamp)),
    wordCountDelta: to.wordCount - from.wordCount,
  };

  const basis = chooseBasis(from, to);

  if (basis === 'COUNTS_ONLY') {
    const delta = base.wordCountDelta;
    return {
      ...base,
      basis,
      wordsAdded: Math.max(0, delta),
      wordsDeleted: Math.max(0, -delta),
      wordsReplaced: 0,
      paragraphsAdded: Math.max(0, to.paragraphCount - from.paragraphCount),
      paragraphsDeleted: Math.max(0, from.paragraphCount - to.paragraphCount),
      paragraphsModified: 0,
      classification: from.extractionStatus === 'UNAVAILABLE' || to.extractionStatus === 'UNAVAILABLE' ? 'UNKNOWN' : classifyByCounts(delta),
      addedBlocks: [],
      deletedBlocks: [],
    };
  }

  const fromParas = basis === 'TEXT' ? splitParagraphs(from.text as string) : from.paragraphHashes;
  const toParas = basis === 'TEXT' ? splitParagraphs(to.text as string) : to.paragraphHashes;
  const changes = diffArrays(fromParas, toParas);

  let paragraphsAdded = 0;
  let paragraphsDeleted = 0;
  let paragraphsModified = 0;
  let wordsAdded = 0;
  let wordsDeleted = 0;
  let wordsReplaced = 0;
  const addedBlocks: TextBlock[] = [];
  const deletedBlocks: TextBlock[] = [];

  let toIndex = 0;
  let pendingRemoved: { items: string[]; index: number } | null = null;

  const flushRemoved = (): void => {
    if (!pendingRemoved) return;
    paragraphsDeleted += pendingRemoved.items.length;
    if (basis === 'TEXT') {
      for (const p of pendingRemoved.items) {
        const w = tokenizeWords(p).length;
        wordsDeleted += w;
        if (w >= MIN_BLOCK_WORDS) deletedBlocks.push({ paragraphIndex: pendingRemoved.index, words: w, excerpt: excerpt(p, 300) });
      }
    }
    pendingRemoved = null;
  };

  for (const change of changes) {
    const items = change.value as string[];
    if (change.removed) {
      flushRemoved();
      pendingRemoved = { items, index: toIndex };
      continue;
    }
    if (change.added) {
      if (pendingRemoved) {
        // Removed block immediately followed by added block: pair them as modifications.
        const pairs = Math.min(pendingRemoved.items.length, items.length);
        paragraphsModified += pairs;
        for (let i = 0; i < pairs; i++) {
          const before = pendingRemoved.items[i] as string;
          const after = items[i] as string;
          if (basis === 'TEXT') {
            const w = wordDiff(before, after);
            wordsAdded += w.added;
            wordsDeleted += w.deleted;
            wordsReplaced += Math.min(w.added, w.deleted);
            for (const run of w.addedRuns) {
              if (run.length >= MIN_BLOCK_WORDS) addedBlocks.push({ paragraphIndex: toIndex + i, words: run.length, excerpt: excerpt(run.join(' '), 300) });
            }
            for (const run of w.deletedRuns) {
              if (run.length >= MIN_BLOCK_WORDS) deletedBlocks.push({ paragraphIndex: toIndex + i, words: run.length, excerpt: excerpt(run.join(' '), 300) });
            }
          }
        }
        const extraRemoved = pendingRemoved.items.slice(pairs);
        const extraAdded = items.slice(pairs);
        pendingRemoved = extraRemoved.length > 0 ? { items: extraRemoved, index: toIndex + pairs } : null;
        flushRemoved();
        paragraphsAdded += extraAdded.length;
        if (basis === 'TEXT') {
          extraAdded.forEach((p, i) => {
            const w = tokenizeWords(p).length;
            wordsAdded += w;
            if (w >= MIN_BLOCK_WORDS) addedBlocks.push({ paragraphIndex: toIndex + pairs + i, words: w, excerpt: excerpt(p, 300) });
          });
        }
      } else {
        paragraphsAdded += items.length;
        if (basis === 'TEXT') {
          items.forEach((p, i) => {
            const w = tokenizeWords(p).length;
            wordsAdded += w;
            if (w >= MIN_BLOCK_WORDS) addedBlocks.push({ paragraphIndex: toIndex + i, words: w, excerpt: excerpt(p, 300) });
          });
        }
      }
      toIndex += items.length;
      continue;
    }
    flushRemoved();
    toIndex += items.length;
  }
  flushRemoved();

  if (basis === 'PARAGRAPH_HASHES') {
    // No word-level visibility: attribute the net delta as the best available estimate.
    const delta = base.wordCountDelta;
    wordsAdded = Math.max(0, delta);
    wordsDeleted = Math.max(0, -delta);
    wordsReplaced = 0;
  }

  const classification = classify({
    basis,
    wordsAdded,
    wordsDeleted,
    wordsReplaced,
    paragraphsAdded,
    paragraphsDeleted,
    paragraphsModified,
    delta: base.wordCountDelta,
  });

  return {
    ...base,
    basis,
    wordsAdded,
    wordsDeleted,
    wordsReplaced,
    paragraphsAdded,
    paragraphsDeleted,
    paragraphsModified,
    classification,
    addedBlocks: topBlocks(addedBlocks, maxBlocks),
    deletedBlocks: topBlocks(deletedBlocks, maxBlocks),
  };
}

function chooseBasis(from: Snapshot, to: Snapshot): DiffBasis {
  if (from.extractionStatus === 'UNAVAILABLE' || to.extractionStatus === 'UNAVAILABLE') return 'COUNTS_ONLY';
  if (typeof from.text === 'string' && typeof to.text === 'string') return 'TEXT';
  if (from.paragraphHashes.length > 0 || to.paragraphHashes.length > 0) return 'PARAGRAPH_HASHES';
  return 'COUNTS_ONLY';
}

interface WordDiffResult {
  added: number;
  deleted: number;
  addedRuns: string[][];
  deletedRuns: string[][];
}

function wordDiff(before: string, after: string): WordDiffResult {
  const a = tokenizeWords(before);
  const b = tokenizeWords(after);
  const result: WordDiffResult = { added: 0, deleted: 0, addedRuns: [], deletedRuns: [] };
  for (const change of diffArrays(a, b)) {
    const items = change.value as string[];
    if (change.added) {
      result.added += items.length;
      result.addedRuns.push(items);
    } else if (change.removed) {
      result.deleted += items.length;
      result.deletedRuns.push(items);
    }
  }
  return result;
}

function classifyByCounts(delta: number): DiffClassification {
  if (delta === 0) return 'UNCHANGED';
  return delta > 0 ? 'ADDING' : 'DELETING';
}

function classify(x: {
  basis: DiffBasis;
  wordsAdded: number;
  wordsDeleted: number;
  wordsReplaced: number;
  paragraphsAdded: number;
  paragraphsDeleted: number;
  paragraphsModified: number;
  delta: number;
}): DiffClassification {
  if (x.basis === 'PARAGRAPH_HASHES') {
    const a = x.paragraphsAdded > 0;
    const d = x.paragraphsDeleted > 0;
    const m = x.paragraphsModified > 0;
    if (!a && !d && !m) return 'UNCHANGED';
    if (a && !d && !m) return 'ADDING';
    if (d && !a && !m) return 'DELETING';
    if (m && !a && !d) return 'REWRITING';
    return 'MIXED';
  }
  const { wordsAdded: added, wordsDeleted: deleted } = x;
  if (added === 0 && deleted === 0 && x.paragraphsModified === 0) return 'UNCHANGED';
  if (deleted <= added * 0.1) return 'ADDING';
  if (added <= deleted * 0.1) return 'DELETING';
  const smaller = Math.min(added, deleted);
  const larger = Math.max(added, deleted);
  if (x.paragraphsModified > 0 && smaller >= larger * 0.4) return 'REWRITING';
  return 'MIXED';
}

function topBlocks(blocks: TextBlock[], max: number): TextBlock[] {
  return [...blocks].sort((a, b) => b.words - a.words).slice(0, max).sort((a, b) => a.paragraphIndex - b.paragraphIndex);
}

/** Recompute all consecutive diffs for a snapshot list (used by demo data and tests). */
export function computeAllDiffs(snapshots: Snapshot[]): SnapshotDiff[] {
  const sorted = [...snapshots].sort((a, b) => a.index - b.index);
  const out: SnapshotDiff[] = [];
  for (let i = 1; i < sorted.length; i++) out.push(computeDiff(sorted[i - 1] as Snapshot, sorted[i] as Snapshot));
  return out;
}

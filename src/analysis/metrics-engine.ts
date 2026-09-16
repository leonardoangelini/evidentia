/**
 * Deterministic metrics over the version history. No scores, no
 * probabilities, no interpretation.
 */
import type { DocumentDataset, Metrics, Session, Snapshot } from '@/models';
import { parseIso } from '@/utils/time';

/** A version reaching this fraction of the final word count counts as a first complete draft. */
export const COMPLETE_DRAFT_RATIO = 0.9;

export interface MetricsOptions {
  largeInsertionWords: number;
}

export function computeMetrics(dataset: DocumentDataset, sessions: Session[], options: MetricsOptions): Metrics {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const diffs = [...dataset.diffs].sort((a, b) => a.toIndex - b.toIndex);
  const readable = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE');
  const final = readable[readable.length - 1] ?? null;
  const first = readable[0] ?? null;
  const finalWordCount = final?.wordCount ?? 0;

  const intervals = snapshots.slice(1).map((s, i) => parseIso(s.timestamp) - parseIso((snapshots[i] as Snapshot).timestamp));
  const wordsAdded = sum(diffs.map((d) => d.wordsAdded));
  const wordsDeleted = sum(diffs.map((d) => d.wordsDeleted));
  const wordsRewritten = sum(diffs.map((d) => d.wordsReplaced));
  const revisionDiffs = diffs.filter((d) => d.classification === 'REWRITING' || d.classification === 'DELETING' || d.classification === 'MIXED');
  const increases = diffs.filter((d) => d.wordCountDelta > 0);
  const large = diffs.filter((d) => d.wordCountDelta >= options.largeInsertionWords);
  const largeWords = large.map((d) => d.wordCountDelta);
  const spans = sessions.map((s) => s.spanMs);
  const multi = sessions.filter((s) => s.versionCount > 1);

  const versionsPerAuthor: Record<string, number> = {};
  for (const s of snapshots) {
    const key = s.authorLabel ?? 'sconosciuto';
    versionsPerAuthor[key] = (versionsPerAuthor[key] ?? 0) + 1;
  }

  return {
    document: {
      finalWordCount,
      finalCharacterCount: final?.characterCount ?? 0,
      finalParagraphCount: final?.paragraphCount ?? 0,
    },
    versions: {
      numberOfVersions: snapshots.length,
      numberOfReadableVersions: readable.length,
      firstVersionAt: snapshots[0]?.timestamp ?? null,
      lastVersionAt: snapshots.at(-1)?.timestamp ?? null,
      totalSpanMs: snapshots.length > 1 ? parseIso((snapshots.at(-1) as Snapshot).timestamp) - parseIso((snapshots[0] as Snapshot).timestamp) : 0,
      medianIntervalMs: intervals.length ? median(intervals) : null,
      numberOfAuthors: Object.keys(versionsPerAuthor).filter((k) => k !== 'sconosciuto').length,
      versionsPerAuthor,
      firstVersionWordCount: first?.wordCount ?? null,
    },
    sessions: {
      numberOfSessions: sessions.length,
      averageSessionSpanMs: multi.length ? Math.round(sum(multi.map((s) => s.spanMs)) / multi.length) : 0,
      longestSessionSpanMs: spans.length ? Math.max(...spans) : 0,
      singleVersionSessions: sessions.length - multi.length,
    },
    writing: {
      estimatedWordsAdded: wordsAdded,
      estimatedWordsDeleted: wordsDeleted,
      estimatedWordsRewritten: wordsRewritten,
      netWordGrowth: final && first ? final.wordCount - first.wordCount : 0,
    },
    insertions: {
      numberOfLargeInsertions: large.length,
      largestInsertionWords: largeWords.length ? Math.max(...largeWords) : 0,
      totalWordsInLargeInsertions: sum(largeWords),
      thresholdWords: options.largeInsertionWords,
    },
    revision: {
      numberOfRevisionEvents: revisionDiffs.length,
      paragraphsRewritten: sum(diffs.map((d) => d.paragraphsModified)),
      revisionIntensity: round3(wordsRewritten / Math.max(1, finalWordCount)),
      proportionOfVersionsAfterFirstCompleteDraft: proportionAfterFirstDraft(readable, finalWordCount),
    },
    timeline: {
      largestWordIncreaseBetweenVersions: increases.length ? Math.max(...increases.map((d) => d.wordCountDelta)) : 0,
      shortestIntervalWithLargeIncreaseMs: large.length ? Math.min(...large.map((d) => d.elapsedMs)) : null,
      longestGapBetweenVersionsMs: intervals.length ? Math.max(...intervals) : 0,
    },
  };
}

function proportionAfterFirstDraft(readable: Snapshot[], finalWordCount: number): number | null {
  if (finalWordCount === 0 || readable.length < 2) return null;
  const idx = readable.findIndex((s) => s.wordCount >= finalWordCount * COMPLETE_DRAFT_RATIO);
  if (idx < 0) return null;
  return round3((readable.length - 1 - idx) / (readable.length - 1));
}

function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2);
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

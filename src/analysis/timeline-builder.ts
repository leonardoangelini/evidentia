/**
 * Normalised timeline and major transitions over the version history.
 */
import type { DocumentDataset, MajorTransition, ObservationGap, Session, SnapshotDiff, TimelineEntry } from '@/models';
import { parseIso } from '@/utils/time';

/** Diffs with at least this many deleted+replaced words appear as REVISION entries. */
export const REVISION_ENTRY_MIN_WORDS = 30;

export interface TimelineOptions {
  largeInsertionWords: number;
}

export function buildTimeline(dataset: DocumentDataset, sessions: Session[], gaps: ObservationGap[], options: TimelineOptions): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const byId = new Map(snapshots.map((s) => [s.id, s]));

  for (const s of snapshots) {
    entries.push({
      time: s.timestamp,
      type: 'VERSION',
      wordCount: s.extractionStatus === 'UNAVAILABLE' ? undefined : s.wordCount,
      snapshotIndex: s.index,
      versionLabel: s.versionLabel,
      author: s.authorLabel ?? undefined,
      label: s.extractionStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : s.isCurrent ? 'versione corrente' : undefined,
    });
  }
  for (const s of sessions) {
    entries.push({ time: s.startedAt, type: 'SESSION_START', label: `${s.versionCount} versioni` });
    if (s.versionCount > 1) entries.push({ time: s.endedAt, type: 'SESSION_END', durationMs: s.spanMs });
  }
  for (const d of dataset.diffs) {
    const to = byId.get(d.toSnapshotId);
    if (!to) continue;
    if (d.wordCountDelta >= options.largeInsertionWords) {
      entries.push({ time: to.timestamp, type: 'LARGE_INSERTION', words: d.wordCountDelta, snapshotIndex: to.index, versionLabel: to.versionLabel, label: `+${d.wordCountDelta} parole in ${Math.round(d.elapsedMs / 60000)} min` });
    }
    const revised = d.wordsDeleted + d.wordsReplaced;
    if ((d.classification === 'REWRITING' || d.classification === 'MIXED' || d.classification === 'DELETING') && revised >= REVISION_ENTRY_MIN_WORDS) {
      entries.push({ time: to.timestamp, type: 'REVISION', words: revised, snapshotIndex: to.index, versionLabel: to.versionLabel, label: `${d.classification}: -${d.wordsDeleted} / +${d.wordsAdded} parole, ${d.paragraphsModified} paragrafi modificati` });
    }
  }
  for (const g of gaps) entries.push({ time: g.from, type: 'GAP', durationMs: g.durationMs ?? undefined, label: `${g.type}: ${g.description}` });

  return entries.sort((a, b) => parseIso(a.time) - parseIso(b.time) || order(a.type) - order(b.type));
}

function order(type: TimelineEntry['type']): number {
  const rank: Record<TimelineEntry['type'], number> = { SESSION_START: 0, GAP: 1, VERSION: 2, LARGE_INSERTION: 3, REVISION: 4, SESSION_END: 5 };
  return rank[type];
}

export interface MajorTransitionOptions {
  minWords?: number;
  minFraction?: number;
  minParagraphChanges?: number;
  max?: number;
}

export function computeMajorTransitions(dataset: DocumentDataset, options: MajorTransitionOptions = {}): MajorTransition[] {
  const minWords = options.minWords ?? 100;
  const minFraction = options.minFraction ?? 0.1;
  const minParagraphs = options.minParagraphChanges ?? 5;
  const max = options.max ?? 10;
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const byId = new Map(snapshots.map((s) => [s.id, s]));
  const finalWords = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE').at(-1)?.wordCount ?? 0;
  const threshold = Math.max(minWords, Math.round(finalWords * minFraction));

  const qualifying = dataset.diffs.filter((d) => {
    const paragraphChanges = d.paragraphsAdded + d.paragraphsDeleted + d.paragraphsModified;
    return Math.abs(d.wordCountDelta) >= threshold || d.wordsDeleted + d.wordsAdded >= threshold || paragraphChanges >= minParagraphs;
  });
  return qualifying
    .map((d) => ({ d, score: Math.abs(d.wordCountDelta) + d.wordsAdded + d.wordsDeleted + 10 * (d.paragraphsAdded + d.paragraphsDeleted + d.paragraphsModified) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((x) => x.d)
    .sort((a, b) => a.toIndex - b.toIndex)
    .map((d) => toTransition(d, byId));
}

function toTransition(d: SnapshotDiff, byId: Map<string, DocumentDataset['snapshots'][number]>): MajorTransition {
  const from = byId.get(d.fromSnapshotId);
  const to = byId.get(d.toSnapshotId);
  return {
    fromSnapshot: d.fromIndex,
    toSnapshot: d.toIndex,
    fromVersion: from?.versionLabel ?? '',
    toVersion: to?.versionLabel ?? '',
    fromTime: from?.timestamp ?? '',
    toTime: to?.timestamp ?? '',
    elapsedMinutes: Math.round(d.elapsedMs / 60000),
    wordsBefore: from?.wordCount ?? 0,
    wordsAfter: to?.wordCount ?? 0,
    netChange: d.wordCountDelta,
    wordsAdded: d.wordsAdded,
    wordsDeleted: d.wordsDeleted,
    addedParagraphs: d.paragraphsAdded,
    deletedParagraphs: d.paragraphsDeleted,
    modifiedParagraphs: d.paragraphsModified,
    classification: d.classification,
    author: to?.authorLabel ?? null,
  };
}

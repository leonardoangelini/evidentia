/**
 * Sessions inferred from version timestamps: versions saved within
 * `gapMs` of each other belong to the same session. Pure function.
 *
 * Nothing about keyboard activity is observed, so a session has a span
 * (first to last version) but no active/idle time.
 */
import type { Session, Snapshot } from '@/models';
import { diffMs, parseIso } from '@/utils/time';

export interface SessionOptions {
  gapMs: number;
}

export function deriveSessions(snapshots: Snapshot[], options: SessionOptions): Session[] {
  const sorted = [...snapshots].sort((a, b) => parseIso(a.timestamp) - parseIso(b.timestamp) || a.index - b.index);
  const sessions: Session[] = [];
  let cluster: Snapshot[] = [];

  const flush = (): void => {
    if (cluster.length === 0) return;
    const first = cluster[0] as Snapshot;
    const last = cluster[cluster.length - 1] as Snapshot;
    const readable = cluster.filter((s) => s.extractionStatus !== 'UNAVAILABLE');
    const wordsStart = readable[0]?.wordCount ?? null;
    const wordsEnd = readable[readable.length - 1]?.wordCount ?? null;
    const index = sessions.length;
    sessions.push({
      id: `${first.documentId}:session:${index}`,
      documentId: first.documentId,
      index,
      startedAt: first.timestamp,
      endedAt: last.timestamp,
      spanMs: Math.max(0, diffMs(first.timestamp, last.timestamp)),
      versionCount: cluster.length,
      fromSnapshotIndex: Math.min(...cluster.map((s) => s.index)),
      toSnapshotIndex: Math.max(...cluster.map((s) => s.index)),
      wordCountStart: wordsStart,
      wordCountEnd: wordsEnd,
      authorLabels: Array.from(new Set(cluster.map((s) => s.authorLabel).filter((a): a is string => a !== null))),
    });
    cluster = [];
  };

  for (const s of sorted) {
    const prev = cluster[cluster.length - 1];
    if (prev && diffMs(prev.timestamp, s.timestamp) > options.gapMs) flush();
    cluster.push(s);
  }
  flush();
  return sessions;
}

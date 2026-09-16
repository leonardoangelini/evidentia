/**
 * A session is a cluster of versions saved close together in time. It is
 * inferred from version timestamps only: nothing about keyboard activity is
 * observed, so there is no active/idle time.
 */
export interface Session {
  id: string;
  documentId: string;
  index: number;
  startedAt: string;
  endedAt: string;
  /** Time from the first to the last version of the cluster. */
  spanMs: number;
  versionCount: number;
  fromSnapshotIndex: number;
  toSnapshotIndex: number;
  wordCountStart: number | null;
  wordCountEnd: number | null;
  authorLabels: string[];
}

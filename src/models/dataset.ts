import type { AnalyzedDocument } from './document';
import type { AnyTrackingEvent } from './events';
import type { Snapshot } from './snapshot';
import type { SnapshotDiff } from './diff';

/** Everything persisted about one document. Input to all analysis functions. */
export interface DocumentDataset {
  document: AnalyzedDocument;
  events: AnyTrackingEvent[];
  snapshots: Snapshot[];
  diffs: SnapshotDiff[];
}

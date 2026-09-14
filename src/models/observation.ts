import type { VersionSourceId } from './document';

export type ObservationGapType =
  /** The first stored version already contains substantial text: its creation was not observed. */
  | 'BEFORE_FIRST_VERSION'
  /** Nothing is known between two versions; the interval is long. */
  | 'LONG_INTERVAL'
  /** A version exists on the server but could not be downloaded or parsed. */
  | 'VERSION_UNAVAILABLE'
  /** The server returned no version history at all. */
  | 'NO_VERSION_HISTORY';

export interface ObservationGap {
  type: ObservationGapType;
  from: string;
  to: string | null;
  durationMs: number | null;
  description: string;
  evidence?: Record<string, number | string | null>;
}

export interface ExtractionFailure {
  at: string;
  versionLabel: string;
  reason: string;
  snapshotId?: string;
}

export interface ContinuityWarning {
  at: string;
  type: 'DUPLICATE_CONTENT' | 'NON_MONOTONIC_TIMESTAMP' | 'HASH_CHAIN_BREAK' | 'PARTIAL_IMPORT';
  description: string;
}

export interface ObservationCoverage {
  /** What the analysis is based on. */
  source: VersionSourceId;
  firstVersionAt: string | null;
  lastVersionAt: string | null;
  versionsOnServer: number;
  versionsStored: number;
  versionsReadable: number;
  lastAnalyzedAt: string | null;
  knownGaps: ObservationGap[];
  extractionFailures: ExtractionFailure[];
  continuityWarnings: ContinuityWarning[];
  /** Structural limits of version-history analysis, always stated. */
  limitations: string[];
}

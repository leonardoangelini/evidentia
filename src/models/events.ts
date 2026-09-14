/**
 * The event log records what Evidentia itself did while analysing a
 * document (listing and fetching versions). It is the hash-chained audit
 * trail of the dataset, not a record of the student's activity.
 */
export type EventType =
  | 'ANALYSIS_START'
  | 'VERSIONS_LISTED'
  | 'VERSION_FETCHED'
  | 'VERSION_FETCH_FAILED'
  | 'ANALYSIS_END';

export interface AnalysisStartPayload {
  privacyMode: 'FULL' | 'METRICS_ONLY';
  trigger: 'MANUAL' | 'REFRESH';
  extensionVersion: string;
}

export interface VersionsListedPayload {
  versionsOnServer: number;
  includingCurrent: number;
  alreadyStored: number;
}

export interface VersionFetchedPayload {
  versionId: string;
  versionLabel: string;
  created: string;
  bytes: number;
  textHash: string;
  wordCount: number;
  extractionStatus: 'FULL' | 'UNAVAILABLE';
}

export interface VersionFetchFailedPayload {
  versionId: string;
  versionLabel: string;
  created: string;
  reason: string;
  httpStatus: number | null;
}

export interface AnalysisEndPayload {
  fetched: number;
  failed: number;
  skipped: number;
  durationMs: number;
}

export type EventPayloadMap = {
  ANALYSIS_START: AnalysisStartPayload;
  VERSIONS_LISTED: VersionsListedPayload;
  VERSION_FETCHED: VersionFetchedPayload;
  VERSION_FETCH_FAILED: VersionFetchFailedPayload;
  ANALYSIS_END: AnalysisEndPayload;
};

export interface RawEvent<T extends EventType = EventType> {
  type: T;
  timestamp: string;
  payload: EventPayloadMap[T];
}

/** A persisted event: sequenced per document and linked in a hash chain. */
export interface TrackingEvent<T extends EventType = EventType> extends RawEvent<T> {
  id: string;
  documentId: string;
  /** Analysis run this event belongs to. */
  runId: string;
  seq: number;
  previousHash: string | null;
  hash: string;
}

export type AnyRawEvent = { [K in EventType]: RawEvent<K> }[EventType];
export type AnyTrackingEvent = { [K in EventType]: TrackingEvent<K> }[EventType];

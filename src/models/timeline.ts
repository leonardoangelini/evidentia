export type TimelineEntryType =
  | 'VERSION'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'LARGE_INSERTION'
  | 'REVISION'
  | 'GAP';

export interface TimelineEntry {
  time: string;
  type: TimelineEntryType;
  wordCount?: number;
  words?: number;
  durationMs?: number;
  label?: string;
  snapshotIndex?: number;
  versionLabel?: string;
  author?: string;
}

/** A significant transition between two consecutive versions (for LLM input and reports). */
export interface MajorTransition {
  fromSnapshot: number;
  toSnapshot: number;
  fromVersion: string;
  toVersion: string;
  fromTime: string;
  toTime: string;
  elapsedMinutes: number;
  wordsBefore: number;
  wordsAfter: number;
  netChange: number;
  wordsAdded: number;
  wordsDeleted: number;
  addedParagraphs: number;
  deletedParagraphs: number;
  modifiedParagraphs: number;
  classification: string;
  author: string | null;
}

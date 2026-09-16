export interface DocumentMetrics {
  finalWordCount: number;
  finalCharacterCount: number;
  finalParagraphCount: number;
}

export interface VersionMetrics {
  numberOfVersions: number;
  numberOfReadableVersions: number;
  firstVersionAt: string | null;
  lastVersionAt: string | null;
  /** From the first to the last version. */
  totalSpanMs: number;
  medianIntervalMs: number | null;
  numberOfAuthors: number;
  versionsPerAuthor: Record<string, number>;
  firstVersionWordCount: number | null;
}

export interface SessionMetrics {
  numberOfSessions: number;
  averageSessionSpanMs: number;
  longestSessionSpanMs: number;
  /** Sessions with a single version have no measurable span. */
  singleVersionSessions: number;
}

export interface WritingMetrics {
  estimatedWordsAdded: number;
  estimatedWordsDeleted: number;
  estimatedWordsRewritten: number;
  netWordGrowth: number;
}

/**
 * Large insertions between two consecutive versions. They are observations
 * about size and timing only; the origin of the text is not observed.
 */
export interface InsertionMetrics {
  numberOfLargeInsertions: number;
  largestInsertionWords: number;
  totalWordsInLargeInsertions: number;
  thresholdWords: number;
}

export interface RevisionMetrics {
  numberOfRevisionEvents: number;
  paragraphsRewritten: number;
  revisionIntensity: number;
  proportionOfVersionsAfterFirstCompleteDraft: number | null;
}

export interface TimelineMetrics {
  largestWordIncreaseBetweenVersions: number;
  shortestIntervalWithLargeIncreaseMs: number | null;
  longestGapBetweenVersionsMs: number;
}

/** All values are deterministic. None of them is a suspicion score. */
export interface Metrics {
  document: DocumentMetrics;
  versions: VersionMetrics;
  sessions: SessionMetrics;
  writing: WritingMetrics;
  insertions: InsertionMetrics;
  revision: RevisionMetrics;
  timeline: TimelineMetrics;
}

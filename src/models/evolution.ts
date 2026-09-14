/**
 * Time estimates and content evolution derived from the version history.
 *
 * Every number here is an estimate computed from version timestamps and
 * texts. Nothing about keyboard activity is observed, so "active time" is a
 * modelled quantity (stated as such wherever it is shown), never a fact.
 */

export interface SessionTimeEstimate {
  /** 0-based, matches Session.index. */
  sessionIndex: number;
  startedAt: string;
  endedAt: string;
  versionCount: number;
  /** First to last version of the session: observed lower bound. */
  observedSpanMs: number;
  /** Allowance for the work done before the first version of the session was saved. */
  leadInMs: number;
  /** observedSpanMs + leadInMs. */
  estimatedActiveMs: number;
  /**
   * Word count at the end of the session minus the count of the last readable
   * version before the session (so the changes carried by the session's first
   * version count for this session). For the first session, the content of
   * the very first version is not observed and is excluded.
   */
  netWords: number;
  wordsAdded: number;
  wordsDeleted: number;
  /** Null when the estimated time is too short for a meaningful rate. */
  wordsPerHourNet: number | null;
  wordsPerHourAdded: number | null;
  includesFirstVersionContent: boolean;
  authorLabels: string[];
}

export interface DayActivity {
  /** Local calendar day, YYYY-MM-DD. */
  date: string;
  sessions: number;
  versions: number;
  estimatedActiveMs: number;
  netWords: number;
  wordsAdded: number;
  wordsDeleted: number;
  authorLabels: string[];
}

export interface IntervalRate {
  fromIndex: number;
  toIndex: number;
  fromVersion: string;
  toVersion: string;
  elapsedMs: number;
  netWords: number;
  wordsAdded: number;
  wordsDeleted: number;
  withinSession: boolean;
  /** Only for intervals inside a session and at least minIntervalForRateMs long. */
  wordsPerHourNet: number | null;
}

export interface TimeEstimates {
  /** Parameters, reported so numbers are reproducible. */
  leadInMinutes: number;
  minSessionForRateMinutes: number;
  minIntervalForRateMinutes: number;
  /** First to last version. */
  calendarSpanMs: number;
  daysWithVersions: number;
  /** Sum of session spans: what the timestamps show directly. */
  observedTotalMs: number;
  /** observedTotalMs + lead-in per session. */
  estimatedActiveTotalMs: number;
  sessions: SessionTimeEstimate[];
  days: DayActivity[];
  intervals: IntervalRate[];
  /** Net growth (final − first readable version) over estimated active hours. */
  wordsPerHourNet: number | null;
  /** Estimated words added over estimated active hours. */
  wordsPerHourAdded: number | null;
  medianSessionWordsPerHourNet: number | null;
  maxIntervalRate: { fromVersion: string; toVersion: string; elapsedMs: number; netWords: number; wordsPerHourNet: number } | null;
  caveats: string[];
}

// ---------------------------------------------------------------- content

export interface SectionChange {
  section: string;
  wordsBefore: number;
  wordsAfter: number;
  wordsAdded: number;
  wordsDeleted: number;
  paragraphsAdded: number;
  paragraphsDeleted: number;
  paragraphsModified: number;
}

export interface VersionContentChange {
  fromIndex: number;
  toIndex: number;
  fromVersion: string;
  toVersion: string;
  at: string;
  /** Only sections with at least one change. */
  sections: SectionChange[];
}

export interface PhaseContentChange {
  sessionIndex: number;
  startedAt: string;
  endedAt: string;
  /** Last readable version before the session (null for the first session). */
  fromIndex: number | null;
  toIndex: number;
  sections: SectionChange[];
  /** Final-text paragraphs already present in the very first readable version (only the first session; their writing was not observed). */
  presentInFirstVersionParagraphs: number;
  presentInFirstVersionWords: number;
  /** Paragraphs of the final text that first appeared in this session. */
  newFinalParagraphs: number;
  newFinalWords: number;
  /** Paragraphs of the final text whose last change happened in this session. */
  revisedFinalParagraphs: number;
  /** Paragraphs removed in this session and never present in the final text. */
  abandonedParagraphs: number;
  abandonedWords: number;
  /** Neutral one-line description in Italian. */
  summary: string;
}

export interface ParagraphProvenance {
  /** 0-based position in the final text. */
  position: number;
  section: string | null;
  isHeading: boolean;
  words: number | null;
  excerpt: string | null;
  firstSeenIndex: number;
  firstSeenVersion: string;
  firstSeenSession: number;
  lastChangedIndex: number;
  lastChangedVersion: string;
  lastChangedSession: number;
  /** Number of earlier variants of this paragraph found in previous versions. */
  revisions: number;
}

export interface AbandonedParagraph {
  words: number | null;
  excerpt: string | null;
  section: string | null;
  firstSeenIndex: number;
  firstSeenVersion: string;
  lastSeenIndex: number;
  lastSeenVersion: string;
  removedIndex: number;
  removedVersion: string;
  removedSession: number;
}

export interface SectionSummary {
  section: string;
  level: number;
  finalWords: number;
  finalParagraphs: number;
  firstSeenIndex: number;
  firstSeenVersion: string;
  firstSeenSession: number;
  /** Sessions in which this section changed. */
  sessionsTouched: number[];
  /** Word count of the section at the end of each session. */
  wordsByPhase: Array<{ sessionIndex: number; words: number }>;
}

export interface ContentEvolution {
  /** TEXT: full texts available; PARAGRAPH_HASHES: METRICS_ONLY mode; NONE: no readable version. */
  basis: 'TEXT' | 'PARAGRAPH_HASHES' | 'NONE';
  hasSections: boolean;
  sections: SectionSummary[];
  phases: PhaseContentChange[];
  versionChanges: VersionContentChange[];
  finalParagraphs: ParagraphProvenance[];
  abandoned: AbandonedParagraph[];
  notes: string[];
}

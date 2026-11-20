import type { PrivacyMode, StudentFields } from './document';

export interface Settings {
  privacyMode: PrivacyMode;
  /** Versions further apart than this belong to different sessions. */
  sessionGapMinutes: number;
  /** Net word increase between consecutive versions that counts as a large insertion. */
  largeInsertionWords: number;
  /** Interval between versions reported as an observation gap. */
  longIntervalHours: number;
  /** Estimated work before the first version of each session (time estimates only). */
  sessionLeadInMinutes: number;
  /** Maximum versions to download per analysis. */
  maxVersions: number;
  student: StudentFields;
}

export const DEFAULT_SETTINGS: Settings = {
  privacyMode: 'FULL',
  sessionGapMinutes: 30,
  largeInsertionWords: 300,
  longIntervalHours: 24,
  sessionLeadInMinutes: 5,
  maxVersions: 500,
  student: {},
};

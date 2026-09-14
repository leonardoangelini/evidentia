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
  /**
   * OAuth 2.0 client id used for Google Docs (Drive API). Empty: use the id
   * compiled into the build (WXT_GOOGLE_CLIENT_ID), if any. A school can set
   * its own internal client here without rebuilding the extension.
   */
  googleClientId: string;
  student: StudentFields;
}

export const DEFAULT_SETTINGS: Settings = {
  privacyMode: 'FULL',
  sessionGapMinutes: 30,
  largeInsertionWords: 300,
  longIntervalHours: 24,
  sessionLeadInMinutes: 5,
  maxVersions: 500,
  googleClientId: '',
  student: {},
};

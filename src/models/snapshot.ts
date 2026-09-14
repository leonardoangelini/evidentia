/** FULL: text extracted from the DOCX; UNAVAILABLE: version could not be downloaded or parsed. */
export type ExtractionStatus = 'FULL' | 'UNAVAILABLE';

export interface Heading {
  level: number;
  text: string;
}

/** Text extracted from one DOCX version. */
export interface ExtractedDocument {
  status: ExtractionStatus;
  text: string;
  paragraphs: string[];
  headings: Heading[];
  wordCount: number;
  characterCount: number;
  notes: string[];
}

/**
 * One stored version of the document. The name "snapshot" is kept because
 * the analysis layer treats every version as a snapshot of the text at a
 * point in time.
 */
export interface Snapshot {
  id: string;
  documentId: string;
  /** Chronological position, 0-based; the current file is the last one. */
  index: number;
  /** Server version id (SharePoint "512", "513", …; Google Drive revision id) or "current". */
  versionId: string;
  /** Version label: as shown by SharePoint ("1.0", "2.3") or the ordinal of the Drive revision ("1", "2"). */
  versionLabel: string;
  timestamp: string;
  authorLabel: string | null;
  isCurrent: boolean;
  sizeBytes: number | null;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  /** Null in METRICS_ONLY mode or when extraction was UNAVAILABLE. */
  text: string | null;
  textHash: string;
  paragraphHashes: string[];
  headings: Heading[];
  extractionStatus: ExtractionStatus;
  extractionNotes: string[];
  /** SHA-256 of the DOCX bytes (downloaded or exported from the server), for integrity of the source artefact. */
  sourceHash: string | null;
  hash: string;
}

/** What the importer produces before a snapshot is sealed. */
export interface SnapshotCandidate {
  versionId: string;
  versionLabel: string;
  timestamp: string;
  authorLabel: string | null;
  isCurrent: boolean;
  sizeBytes: number | null;
  wordCount: number;
  characterCount: number;
  paragraphCount: number;
  text: string | null;
  textHash: string;
  paragraphHashes: string[];
  headings: Heading[];
  extractionStatus: ExtractionStatus;
  extractionNotes: string[];
  sourceHash: string | null;
}

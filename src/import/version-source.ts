/**
 * What the importer needs from a server that keeps document versions.
 * Implemented by the SharePoint REST client and by the Google Drive client;
 * the importer, the storage layer and the analysis never know which one is
 * behind it.
 *
 * Every source delivers each version as DOCX bytes (SharePoint stores the
 * DOCX itself; Google Drive exports the Google Doc to DOCX), so a single
 * text extractor serves both.
 */
import type { DocumentProvider } from '@/models';

export interface SourceFileInfo {
  /** Stable id of the document on the server (SharePoint UniqueId, Drive file id). Used as the local document id. */
  id: string;
  name: string;
  /** Server-relative path when the server has one (SharePoint); empty otherwise. */
  path: string;
  /** Link to open the document in the browser, without tokens. */
  webUrl: string;
  timeCreated: string;
  timeLastModified: string;
  /** Label of the current version ("4.0" on SharePoint, ordinal of the head revision on Drive). */
  versionLabel: string;
  sizeBytes: number | null;
  modifiedByName: string | null;
  modifiedByIdentity: string | null;
}

export interface SourceVersionInfo {
  /** Server version id, stable across imports. */
  id: string;
  label: string;
  /** ISO timestamp as reported by the server (usually UTC). */
  created: string;
  size: number | null;
  authorName: string | null;
  authorIdentity: string | null;
}

export interface VersionSource<V extends SourceVersionInfo = SourceVersionInfo> {
  readonly provider: DocumentProvider;
  getFileInfo(): Promise<SourceFileInfo>;
  /** Past versions, oldest first. The current file is not included. */
  listVersions(): Promise<V[]>;
  /** DOCX bytes of a past version. */
  downloadVersion(version: V): Promise<Uint8Array>;
  /** DOCX bytes of the current file. */
  downloadCurrent(): Promise<Uint8Array>;
}

/** Error raised by a version source; `status` is the HTTP status when there is one. */
export class VersionSourceError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
  ) {
    super(message);
  }
}

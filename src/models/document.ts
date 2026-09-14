/** Privacy mode chosen before the first analysis of a document. See PRIVACY.md. */
export type PrivacyMode = 'FULL' | 'METRICS_ONLY';

/**
 * Where the version history comes from.
 * - SHAREPOINT: SharePoint Online / OneDrive for Business (Word document), REST API with the teacher's session cookies.
 * - GOOGLE_DOCS: Google Drive revisions of a Google Docs document (or a Word file stored in Drive), Drive API v3 with OAuth.
 */
export type DocumentProvider = 'SHAREPOINT' | 'GOOGLE_DOCS';

/** Identifier of the data source, as written in exports and observation coverage. */
export type VersionSourceId = 'SHAREPOINT_VERSION_HISTORY' | 'GOOGLE_DRIVE_REVISIONS';

/** Documents stored before Google Docs support have no provider field: they are SharePoint documents. */
export function documentProvider(doc: { provider?: DocumentProvider }): DocumentProvider {
  return doc.provider ?? 'SHAREPOINT';
}

export function sourceIdOf(provider: DocumentProvider): VersionSourceId {
  return provider === 'GOOGLE_DOCS' ? 'GOOGLE_DRIVE_REVISIONS' : 'SHAREPOINT_VERSION_HISTORY';
}

/** Human-readable name of the server keeping the versions ("SharePoint/OneDrive", "Google Drive"). */
export function providerName(provider: DocumentProvider): string {
  return provider === 'GOOGLE_DOCS' ? 'Google Drive' : 'SharePoint/OneDrive';
}

/** "cronologia versioni SharePoint/OneDrive" / "cronologia revisioni Google Drive", for report headers. */
export function sourceLabel(doc: { provider?: DocumentProvider }): string {
  return documentProvider(doc) === 'GOOGLE_DOCS' ? 'cronologia revisioni Google Drive (Google Docs)' : 'cronologia versioni SharePoint/OneDrive';
}

/** Optional, teacher-provided pseudonymous identifiers. */
export interface StudentFields {
  studentId?: string;
  assignmentId?: string;
  courseId?: string;
}

/** A person who saved at least one version (from the version metadata of the server). */
export interface Author {
  /** Stable pseudonymous label, e.g. "Autore 1". Used everywhere in exports. */
  label: string;
  /** Display name as reported by the server. Absent in METRICS_ONLY mode. */
  displayName?: string;
  /** SHA-256 of the login/email, to tell authors apart without storing the address. */
  identityHash: string;
  versions: number;
}

/** A document whose version history was analysed (SharePoint/OneDrive for Business, or Google Docs via Drive). */
export interface AnalyzedDocument {
  /** SharePoint file UniqueId (GUID, lower case) or Google Drive file id. */
  id: string;
  name: string;
  /** Absent in documents stored before Google Docs support: read it through documentProvider(). */
  provider?: DocumentProvider;
  /** SharePoint: site collection URL, e.g. https://tenant-my.sharepoint.com/personal/user_tenant_it. Google: https://drive.google.com. */
  siteUrl: string;
  /** SharePoint: server-relative path of the file. Google: empty (Drive has no stable path). */
  serverRelativeUrl: string;
  /** Link to open the document (no tokens). */
  webUrl: string;
  host: string;
  timeCreated: string | null;
  timeLastModified: string | null;
  currentVersionLabel: string | null;
  firstAnalyzedAt: string;
  lastAnalyzedAt: string;
  extensionVersion: string;
  privacyMode: PrivacyMode;
  authors: Author[];
  student?: StudentFields;
}

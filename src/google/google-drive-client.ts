/**
 * Google Drive API v3 client for the revision history of one document.
 * Runs in an extension page with an OAuth access token (see google-auth.ts);
 * requests never carry cookies.
 *
 * Two kinds of file are handled:
 * - a native Google Doc (application/vnd.google-apps.document): every
 *   revision is exported to DOCX through the export link Drive returns for
 *   it, and the current content through files.export;
 * - a Word file kept in Drive (.docx): revisions and the current file are
 *   downloaded as they are (alt=media).
 *
 * Drive decides which revisions of a Google Doc survive: it keeps the
 * detailed edit history internally but the API exposes a coarser list of
 * revisions, and revisions not marked "keep forever" can be merged over
 * time. The granularity is therefore not the one seen in the Docs
 * "Version history" panel, and it is not under the extension's control.
 */
import { VersionSourceError, type SourceFileInfo, type SourceVersionInfo, type VersionSource } from '@/import/version-source';
import type { TokenProvider } from './google-auth';
import type { GoogleDocsLocator } from './locator';

const DRIVE = 'https://www.googleapis.com/drive/v3';
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FILE_FIELDS = 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink,lastModifyingUser(displayName,emailAddress,permissionId)';
const REVISION_FIELDS = 'nextPageToken,revisions(id,modifiedTime,size,mimeType,keepForever,exportLinks,lastModifyingUser(displayName,emailAddress,permissionId))';
/** A head revision this close to the file's modifiedTime is the current content, not a past version. */
const HEAD_TOLERANCE_MS = 2000;

export interface GoogleRevisionInfo extends SourceVersionInfo {
  /** DOCX export link (native Google Doc) or null (Word file: download by id). */
  exportLink: string | null;
  keepForever: boolean;
}

export class GoogleDriveError extends VersionSourceError {}

interface DriveUser {
  displayName?: string;
  emailAddress?: string;
  permissionId?: string;
}

interface DriveFile {
  id?: string;
  name?: string;
  mimeType?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
  lastModifyingUser?: DriveUser;
}

interface DriveRevision {
  id?: string;
  modifiedTime?: string;
  size?: string;
  mimeType?: string;
  keepForever?: boolean;
  exportLinks?: Record<string, string>;
  lastModifyingUser?: DriveUser;
}

export class GoogleDriveClient implements VersionSource<GoogleRevisionInfo> {
  readonly provider = 'GOOGLE_DOCS' as const;
  private file: DriveFile | null = null;
  private past: GoogleRevisionInfo[] | null = null;

  constructor(
    private readonly locator: GoogleDocsLocator,
    private readonly tokens: TokenProvider,
    private readonly fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {}

  private get fileId(): string {
    return encodeURIComponent(this.locator.fileId);
  }

  private get isNativeDoc(): boolean {
    return this.file?.mimeType === GOOGLE_DOC_MIME;
  }

  /**
   * Reads the file and its revisions together: the label of the current
   * version is the ordinal that follows the past revisions.
   */
  async getFileInfo(): Promise<SourceFileInfo> {
    const file = await this.getJson<DriveFile>(`${DRIVE}/files/${this.fileId}?fields=${encodeURIComponent(FILE_FIELDS)}&supportsAllDrives=true`);
    if (file.mimeType !== GOOGLE_DOC_MIME && file.mimeType !== DOCX_MIME) {
      throw new GoogleDriveError(`Il file non è un documento Google Docs né un file Word (${file.mimeType ?? 'tipo sconosciuto'}).`, null);
    }
    this.file = file;
    const all = await this.listAllRevisions();
    const head = all.at(-1) ?? null;
    const headIsCurrent = head !== null && Math.abs(Date.parse(file.modifiedTime ?? '') - Date.parse(head.created)) <= HEAD_TOLERANCE_MS;
    this.past = headIsCurrent ? all.slice(0, -1) : all;
    const by = file.lastModifyingUser ?? null;
    return {
      id: String(file.id ?? this.locator.fileId),
      name: String(file.name ?? ''),
      path: '',
      webUrl: String(file.webViewLink ?? `https://docs.google.com/document/d/${this.locator.fileId}/edit`),
      timeCreated: String(file.createdTime ?? ''),
      timeLastModified: String(file.modifiedTime ?? ''),
      versionLabel: String(this.past.length + 1),
      sizeBytes: file.size !== undefined ? Number(file.size) : null,
      modifiedByName: userName(by),
      modifiedByIdentity: userIdentity(by),
    };
  }

  /** Past revisions, oldest first; the head revision is left out when it is the current content. */
  async listVersions(): Promise<GoogleRevisionInfo[]> {
    if (!this.past) await this.getFileInfo();
    return this.past ?? [];
  }

  async downloadVersion(version: GoogleRevisionInfo): Promise<Uint8Array> {
    if (version.exportLink) return this.getBytes(version.exportLink);
    return this.getBytes(`${DRIVE}/files/${this.fileId}/revisions/${encodeURIComponent(version.id)}?alt=media`);
  }

  async downloadCurrent(): Promise<Uint8Array> {
    if (!this.file) await this.getFileInfo();
    return this.isNativeDoc
      ? this.getBytes(`${DRIVE}/files/${this.fileId}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`)
      : this.getBytes(`${DRIVE}/files/${this.fileId}?alt=media&supportsAllDrives=true`);
  }

  private async listAllRevisions(): Promise<GoogleRevisionInfo[]> {
    const raw: DriveRevision[] = [];
    let pageToken: string | null = null;
    do {
      const page: { nextPageToken?: string; revisions?: DriveRevision[] } = await this.getJson(
        `${DRIVE}/files/${this.fileId}/revisions?fields=${encodeURIComponent(REVISION_FIELDS)}&pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`,
      );
      raw.push(...(page.revisions ?? []));
      pageToken = page.nextPageToken ?? null;
    } while (pageToken);
    const sorted = raw
      .filter((r) => r.id)
      .sort((a, b) => Date.parse(a.modifiedTime ?? '') - Date.parse(b.modifiedTime ?? '') || compareIds(a.id ?? '', b.id ?? ''));
    return sorted.map((r, i) => {
      const by = r.lastModifyingUser ?? null;
      return {
        id: String(r.id),
        label: String(i + 1),
        created: String(r.modifiedTime ?? ''),
        size: r.size !== undefined ? Number(r.size) : null,
        authorName: userName(by),
        authorIdentity: userIdentity(by),
        exportLink: r.exportLinks?.[DOCX_MIME] ?? null,
        keepForever: Boolean(r.keepForever),
      } satisfies GoogleRevisionInfo;
    });
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.request(url, 'application/json');
    return (await res.json()) as T;
  }

  private async getBytes(url: string): Promise<Uint8Array> {
    const res = await this.request(url, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }

  /** One retry with a fresh token after a 401: the cached token may have expired mid-import. */
  private async request(url: string, accept: string): Promise<Response> {
    let token = await this.tokens.get();
    let res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept }, credentials: 'omit' });
    if (res.status === 401) {
      await this.tokens.invalidate();
      token = await this.tokens.get();
      res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept }, credentials: 'omit' });
    }
    if (!res.ok) throw new GoogleDriveError(await describe(res), res.status);
    return res;
  }
}

function userName(u: DriveUser | null): string | null {
  return u?.displayName ? String(u.displayName) : null;
}

/** Email when Drive discloses it, else the permission id (stable per user and file), else the name. */
function userIdentity(u: DriveUser | null): string | null {
  if (!u) return null;
  if (u.emailAddress) return String(u.emailAddress).toLowerCase();
  if (u.permissionId) return `permission:${u.permissionId}`;
  return null;
}

/** Revision ids are decimal strings on Drive; compare numerically when both are. */
function compareIds(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) ? na - nb : a.localeCompare(b);
}

async function describe(res: Response): Promise<string> {
  let detail = '';
  let reason = '';
  try {
    const body = (await res.json()) as { error?: { message?: string; errors?: Array<{ reason?: string }> } };
    detail = body.error?.message ?? '';
    reason = body.error?.errors?.[0]?.reason ?? '';
  } catch {
    // no JSON body
  }
  if (reason === 'exportSizeLimitExceeded') detail = 'Documento troppo grande per l\'esportazione (limite Google di 10 MB per esportazione).';
  else if (res.status === 401 || res.status === 403) detail ||= 'Accesso negato: verifica di aver autorizzato Evidentia con l\'account Google che ha accesso al documento.';
  else if (res.status === 404) detail ||= 'Documento non trovato su Google Drive.';
  return `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
}

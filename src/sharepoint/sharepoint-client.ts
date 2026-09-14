/**
 * Minimal SharePoint REST client for version history. Runs in an extension
 * page: with host permissions Chrome attaches the user's SharePoint cookies,
 * so the teacher's existing Microsoft 365 session is used, read-only.
 */
import { VersionSourceError, type SourceFileInfo, type SourceVersionInfo, type VersionSource } from '@/import/version-source';
import type { SharePointLocator } from './locator';

export type SpFileInfo = SourceFileInfo;

export interface SpVersionInfo extends SourceVersionInfo {
  /** Site-relative download path, e.g. "_vti_history/512/Documents/x.docx". */
  url: string;
}

export class SharePointError extends VersionSourceError {}

const JSON_HEADERS = { Accept: 'application/json;odata=nometadata' };

export class SharePointClient implements VersionSource<SpVersionInfo> {
  readonly provider = 'SHAREPOINT' as const;

  constructor(
    private readonly locator: SharePointLocator,
    private readonly fetchImpl: typeof fetch = fetch.bind(globalThis),
  ) {}

  private fileApi(): string {
    return `${this.locator.siteUrl}/_api/web/GetFileById('${this.locator.fileId}')`;
  }

  async getFileInfo(): Promise<SpFileInfo> {
    const data = await this.getJson<Record<string, unknown>>(
      `${this.fileApi()}?$select=UniqueId,Name,ServerRelativeUrl,LinkingUrl,TimeCreated,TimeLastModified,UIVersionLabel,Length,ModifiedBy/Title,ModifiedBy/Email,ModifiedBy/LoginName&$expand=ModifiedBy`,
    );
    const by = (data.ModifiedBy ?? null) as Record<string, unknown> | null;
    return {
      id: String(data.UniqueId ?? this.locator.fileId).toLowerCase(),
      name: String(data.Name ?? this.locator.fileName ?? ''),
      path: String(data.ServerRelativeUrl ?? ''),
      webUrl: String(data.LinkingUrl ?? data.LinkingUri ?? ''),
      timeCreated: String(data.TimeCreated ?? ''),
      timeLastModified: String(data.TimeLastModified ?? ''),
      versionLabel: String(data.UIVersionLabel ?? ''),
      sizeBytes: Number(data.Length ?? 0),
      modifiedByName: by?.Title ? String(by.Title) : null,
      modifiedByIdentity: by?.Email ? String(by.Email).toLowerCase() : by?.LoginName ? String(by.LoginName).toLowerCase() : null,
    };
  }

  /** Past versions, oldest first. The current file is not included. */
  async listVersions(): Promise<SpVersionInfo[]> {
    const data = await this.getJson<{ value?: Array<Record<string, unknown>> }>(
      `${this.fileApi()}/Versions?$select=ID,VersionLabel,Created,Size,Url,CreatedBy/Title,CreatedBy/Email,CreatedBy/LoginName&$expand=CreatedBy&$top=5000`,
    );
    const list = (data.value ?? []).map((v) => {
      const by = (v.CreatedBy ?? null) as Record<string, unknown> | null;
      return {
        id: String(v.ID ?? ''),
        label: String(v.VersionLabel ?? ''),
        created: String(v.Created ?? ''),
        size: Number(v.Size ?? 0),
        url: String(v.Url ?? ''),
        authorName: by?.Title ? String(by.Title) : null,
        authorIdentity: by?.Email ? String(by.Email).toLowerCase() : by?.LoginName ? String(by.LoginName).toLowerCase() : null,
      } satisfies SpVersionInfo;
    });
    return list.sort((a, b) => Date.parse(a.created) - Date.parse(b.created) || Number(a.id) - Number(b.id));
  }

  async downloadVersion(version: SpVersionInfo): Promise<Uint8Array> {
    return this.getBytes(`${this.locator.siteUrl}/${version.url.replace(/^\/+/, '')}`);
  }

  async downloadCurrent(): Promise<Uint8Array> {
    return this.getBytes(`${this.fileApi()}/$value`);
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url, { headers: JSON_HEADERS, credentials: 'include' });
    if (!res.ok) throw new SharePointError(await describe(res), res.status);
    return (await res.json()) as T;
  }

  private async getBytes(url: string): Promise<Uint8Array> {
    const res = await this.fetchImpl(url, { credentials: 'include' });
    if (!res.ok) throw new SharePointError(await describe(res), res.status);
    return new Uint8Array(await res.arrayBuffer());
  }
}

async function describe(res: Response): Promise<string> {
  let detail = '';
  try {
    const body = (await res.json()) as { 'odata.error'?: { message?: { value?: string } }; error?: { message?: string } };
    detail = body['odata.error']?.message?.value ?? body.error?.message ?? '';
  } catch {
    // no JSON body
  }
  if (res.status === 401 || res.status === 403) detail ||= 'Accesso negato: verifica di essere autenticato su Microsoft 365 e di avere accesso al documento.';
  if (res.status === 404) detail ||= 'File non trovato sul sito indicato.';
  return `HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
}

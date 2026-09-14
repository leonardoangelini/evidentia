import { DOCX_MIME, GOOGLE_DOC_MIME, GoogleDriveClient, GoogleDriveError } from '@/google/google-drive-client';
import type { TokenProvider } from '@/google/google-auth';
import type { GoogleDocsLocator } from '@/google/locator';

const LOCATOR: GoogleDocsLocator = { provider: 'GOOGLE_DOCS', fileId: 'FILE_ID_1234567890', fileName: null, host: 'docs.google.com' };
const DRIVE = 'https://www.googleapis.com/drive/v3';
const EXPORT = (rev: string): string => `https://docs.google.com/feeds/download/documents/export/Export?id=FILE_ID_1234567890&revision=${rev}&exportFormat=docx`;

interface Route {
  status?: number;
  json?: unknown;
  bytes?: Uint8Array;
}

/** Fake fetch keyed by URL prefix (query string included), recording every call with its Authorization header. */
function fakeFetch(routes: Record<string, Route | ((call: number) => Route)>): { fetch: typeof fetch; calls: Array<{ url: string; auth: string | null; credentials: string | undefined }> } {
  const calls: Array<{ url: string; auth: string | null; credentials: string | undefined }> = [];
  const counters = new Map<string, number>();
  const fetchFn: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    const headers = new Headers(init?.headers);
    calls.push({ url, auth: headers.get('Authorization'), credentials: init?.credentials });
    const key = Object.keys(routes).find((k) => url.startsWith(k));
    if (!key) return new Response(JSON.stringify({ error: { message: 'no route' } }), { status: 404 });
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    const r = routes[key] as Route | ((call: number) => Route);
    const route = typeof r === 'function' ? r(n) : r;
    if (route.bytes) return new Response(route.bytes as BodyInit, { status: route.status ?? 200 });
    return new Response(JSON.stringify(route.json ?? {}), { status: route.status ?? 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetch: fetchFn, calls };
}

function tokens(): TokenProvider & { issued: number; invalidated: number } {
  const t = {
    issued: 0,
    invalidated: 0,
    async get(): Promise<string> {
      t.issued += 1;
      return `tok${t.issued}`;
    },
    async invalidate(): Promise<void> {
      t.invalidated += 1;
    },
  };
  return t;
}

const user = (name: string, email?: string, permissionId?: string): Record<string, string> => ({ displayName: name, ...(email ? { emailAddress: email } : {}), ...(permissionId ? { permissionId } : {}) });

describe('Google Drive client', () => {
  it('reads a native Google Doc: revisions in pages, head revision as current, DOCX export links', async () => {
    const { fetch, calls } = fakeFetch({
      [`${DRIVE}/files/FILE_ID_1234567890?fields=`]: { json: { id: 'FILE_ID_1234567890', name: 'Saggio', mimeType: GOOGLE_DOC_MIME, createdTime: '2026-09-10T07:59:00.000Z', modifiedTime: '2026-09-12T10:00:00.500Z', webViewLink: 'https://docs.google.com/document/d/FILE_ID_1234567890/edit?usp=drivesdk', lastModifyingUser: user('Anna Bianchi', 'anna@scuola.edu.it') } },
      [`${DRIVE}/files/FILE_ID_1234567890/revisions?fields=`]: (call) =>
        call === 1
          ? { json: { nextPageToken: 'p2', revisions: [{ id: '10', modifiedTime: '2026-09-10T08:00:00.000Z', lastModifyingUser: user('Anna Bianchi', 'anna@scuola.edu.it'), exportLinks: { [DOCX_MIME]: EXPORT('10') } }, { id: '9', modifiedTime: '2026-09-10T07:59:30.000Z', lastModifyingUser: user('Anna Bianchi', undefined, 'perm-anna'), exportLinks: { [DOCX_MIME]: EXPORT('9') } }] } }
          : { json: { revisions: [{ id: '42', modifiedTime: '2026-09-12T10:00:00.000Z', keepForever: true, lastModifyingUser: user('Tutor', 'tutor@scuola.edu.it'), exportLinks: { [DOCX_MIME]: EXPORT('42') } }] } },
      [EXPORT('9')]: { bytes: new Uint8Array([1]) },
      [EXPORT('10')]: { bytes: new Uint8Array([2, 2]) },
      [`${DRIVE}/files/FILE_ID_1234567890/export?mimeType=`]: { bytes: new Uint8Array([3, 3, 3]) },
    });
    const client = new GoogleDriveClient(LOCATOR, tokens(), fetch);
    const info = await client.getFileInfo();
    expect(info).toEqual({
      id: 'FILE_ID_1234567890',
      name: 'Saggio',
      path: '',
      webUrl: 'https://docs.google.com/document/d/FILE_ID_1234567890/edit?usp=drivesdk',
      timeCreated: '2026-09-10T07:59:00.000Z',
      timeLastModified: '2026-09-12T10:00:00.500Z',
      versionLabel: '3',
      sizeBytes: null,
      modifiedByName: 'Anna Bianchi',
      modifiedByIdentity: 'anna@scuola.edu.it',
    });
    const versions = await client.listVersions();
    // Oldest first, ordinal labels; the head revision (same time as the file) is the current content, not a past version.
    expect(versions.map((v) => [v.id, v.label, v.authorIdentity, v.keepForever])).toEqual([
      ['9', '1', 'permission:perm-anna', false],
      ['10', '2', 'anna@scuola.edu.it', false],
    ]);
    expect(await client.downloadVersion(versions[0]!)).toEqual(new Uint8Array([1]));
    expect(await client.downloadCurrent()).toEqual(new Uint8Array([3, 3, 3]));
    expect(calls.filter((c) => c.url.includes('/revisions?'))).toHaveLength(2);
    expect(calls[calls.length - 1]?.url).toContain(`export?mimeType=${encodeURIComponent(DOCX_MIME)}`);
    for (const c of calls) {
      expect(c.auth).toMatch(/^Bearer tok\d+$/);
      expect(c.credentials).toBe('omit');
    }
  });

  it('keeps the head revision as a past version when the file was modified after it', async () => {
    const { fetch } = fakeFetch({
      [`${DRIVE}/files/FILE_ID_1234567890?fields=`]: { json: { id: 'FILE_ID_1234567890', name: 'Saggio', mimeType: GOOGLE_DOC_MIME, modifiedTime: '2026-09-12T11:00:00.000Z' } },
      [`${DRIVE}/files/FILE_ID_1234567890/revisions?fields=`]: { json: { revisions: [{ id: '42', modifiedTime: '2026-09-12T10:00:00.000Z', exportLinks: { [DOCX_MIME]: EXPORT('42') } }] } },
    });
    const client = new GoogleDriveClient(LOCATOR, tokens(), fetch);
    const info = await client.getFileInfo();
    expect(info.versionLabel).toBe('2');
    expect(info.modifiedByIdentity).toBeNull();
    expect((await client.listVersions()).map((v) => v.id)).toEqual(['42']);
  });

  it('downloads a Word file kept in Drive by id (no export)', async () => {
    const { fetch, calls } = fakeFetch({
      [`${DRIVE}/files/FILE_ID_1234567890?fields=`]: { json: { id: 'FILE_ID_1234567890', name: 'Saggio.docx', mimeType: DOCX_MIME, size: '1234', modifiedTime: '2026-09-12T10:00:00.000Z' } },
      [`${DRIVE}/files/FILE_ID_1234567890/revisions?fields=`]: { json: { revisions: [{ id: '1', modifiedTime: '2026-09-11T10:00:00.000Z', size: '1000' }, { id: '2', modifiedTime: '2026-09-12T10:00:00.000Z', size: '1234' }] } },
      [`${DRIVE}/files/FILE_ID_1234567890/revisions/1?alt=media`]: { bytes: new Uint8Array([7]) },
      [`${DRIVE}/files/FILE_ID_1234567890?alt=media`]: { bytes: new Uint8Array([8, 8]) },
    });
    const client = new GoogleDriveClient(LOCATOR, tokens(), fetch);
    expect((await client.getFileInfo()).sizeBytes).toBe(1234);
    const versions = await client.listVersions();
    expect(versions.map((v) => [v.id, v.size, v.exportLink])).toEqual([['1', 1000, null]]);
    expect(await client.downloadVersion(versions[0]!)).toEqual(new Uint8Array([7]));
    expect(await client.downloadCurrent()).toEqual(new Uint8Array([8, 8]));
    expect(calls.some((c) => c.url.includes('/export?'))).toBe(false);
  });

  it('rejects files that are neither Google Docs nor Word', async () => {
    const { fetch } = fakeFetch({ [`${DRIVE}/files/FILE_ID_1234567890?fields=`]: { json: { id: 'x', mimeType: 'application/vnd.google-apps.spreadsheet' } } });
    await expect(new GoogleDriveClient(LOCATOR, tokens(), fetch).getFileInfo()).rejects.toThrow(/non è un documento Google Docs/);
  });

  it('retries once with a fresh token after a 401 and reports API errors with their status', async () => {
    const { fetch } = fakeFetch({
      [`${DRIVE}/files/FILE_ID_1234567890?fields=`]: (call) => (call === 1 ? { status: 401, json: { error: { message: 'Invalid Credentials' } } } : { json: { id: 'FILE_ID_1234567890', mimeType: GOOGLE_DOC_MIME, modifiedTime: '2026-09-12T10:00:00.000Z' } }),
      [`${DRIVE}/files/FILE_ID_1234567890/revisions?fields=`]: { status: 403, json: { error: { message: 'The user does not have sufficient permissions', errors: [{ reason: 'insufficientFilePermissions' }] } } },
    });
    const t = tokens();
    const client = new GoogleDriveClient(LOCATOR, t, fetch);
    const err = await client.getFileInfo().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GoogleDriveError);
    expect((err as GoogleDriveError).status).toBe(403);
    expect((err as GoogleDriveError).message).toBe('HTTP 403: The user does not have sufficient permissions');
    expect(t.invalidated).toBe(1);
    expect(t.issued).toBe(3);
  });
});

// @vitest-environment jsdom
import { zipSync, strToU8 } from 'fflate';
import { importVersionHistory } from '@/import/version-importer';
import { DEFAULT_SETTINGS } from '@/models';
import { SharePointError, type SharePointClient, type SpFileInfo, type SpVersionInfo } from '@/sharepoint/sharepoint-client';
import { loadDataset } from '@/storage/repositories';
import { analyzeDataset } from '@/analysis';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = (paragraphs: string[]): Uint8Array =>
  zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`) });

const LOCATOR = { provider: 'SHAREPOINT' as const, siteUrl: 'https://contoso-my.sharepoint.com/personal/prof_contoso_it', fileId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', fileName: 'Saggio.docx', host: 'contoso-my.sharepoint.com' };

class FakeClient {
  readonly provider = 'SHAREPOINT' as const;
  versions: SpVersionInfo[] = [
    { id: '512', label: '1.0', created: '2026-09-10T08:00:00Z', size: 100, url: '_vti_history/512/Documents/Saggio.docx', authorName: 'Anna Bianchi', authorIdentity: 'anna@contoso.it' },
    { id: '513', label: '2.0', created: '2026-09-10T08:10:00Z', size: 200, url: '_vti_history/513/Documents/Saggio.docx', authorName: 'Anna Bianchi', authorIdentity: 'anna@contoso.it' },
    { id: '514', label: '3.0', created: '2026-09-11T09:00:00Z', size: 300, url: '_vti_history/514/Documents/Saggio.docx', authorName: 'Tutor', authorIdentity: 'tutor@contoso.it' },
  ];
  content: Record<string, Uint8Array | Error> = {
    '512': docx(['Introduzione breve.']),
    '513': docx(['Introduzione breve.', 'Un secondo paragrafo con più parole dentro.']),
    '514': new SharePointError('HTTP 403: Accesso negato', 403),
  };
  current = docx(['Introduzione rivista.', 'Un secondo paragrafo con più parole dentro.', 'Conclusione finale del saggio.']);
  downloads = 0;
  async getFileInfo(): Promise<SpFileInfo> {
    return { id: LOCATOR.fileId, name: 'Saggio.docx', path: '/personal/prof_contoso_it/Documents/Saggio.docx', webUrl: 'https://contoso-my.sharepoint.com/personal/prof_contoso_it/Documents/Saggio.docx', timeCreated: '2026-09-10T07:59:00Z', timeLastModified: '2026-09-12T10:00:00Z', versionLabel: '4.0', sizeBytes: 400, modifiedByName: 'Anna Bianchi', modifiedByIdentity: 'anna@contoso.it' };
  }
  async listVersions(): Promise<SpVersionInfo[]> {
    return this.versions;
  }
  async downloadVersion(v: SpVersionInfo): Promise<Uint8Array> {
    this.downloads += 1;
    const c = this.content[v.id];
    if (c instanceof Error) throw c;
    if (!c) throw new SharePointError('HTTP 404', 404);
    return c;
  }
  async downloadCurrent(): Promise<Uint8Array> {
    this.downloads += 1;
    return this.current;
  }
}

describe('version importer', () => {
  it('imports versions, pseudonymises authors, records failures and computes diffs', async () => {
    const client = new FakeClient();
    const progress: string[] = [];
    const result = await importVersionHistory({ locator: LOCATOR, settings: DEFAULT_SETTINGS, extensionVersion: 'test', client: client as unknown as SharePointClient, onProgress: (p) => progress.push(p.phase) });
    expect(result).toMatchObject({ documentId: LOCATOR.fileId, fetched: 3, failed: 1, skipped: 0, totalVersions: 4 });
    expect((await loadDataset(LOCATOR.fileId))?.document.provider).toBe('SHAREPOINT');
    expect(progress[0]).toBe('INFO');
    expect(progress.at(-1)).toBe('DONE');
    const ds = (await loadDataset(LOCATOR.fileId))!;
    expect(ds.document.authors.map((a) => [a.label, a.displayName, a.versions])).toEqual([['Autore 1', 'Anna Bianchi', 3], ['Autore 2', 'Tutor', 1]]);
    expect(ds.snapshots.map((s) => [s.index, s.versionLabel, s.extractionStatus, s.wordCount, s.authorLabel, s.isCurrent])).toEqual([
      [0, '1.0', 'FULL', 2, 'Autore 1', false],
      [1, '2.0', 'FULL', 9, 'Autore 1', false],
      [2, '3.0', 'UNAVAILABLE', 0, 'Autore 2', false],
      [3, '4.0', 'FULL', 13, 'Autore 1', true],
    ]);
    expect(ds.snapshots[0]?.sourceHash).toHaveLength(64);
    expect(ds.diffs.map((d) => d.classification)).toEqual(['ADDING', 'UNKNOWN', 'UNKNOWN']);
    expect(ds.events.map((e) => e.type)).toEqual(['ANALYSIS_START', 'VERSIONS_LISTED', 'VERSION_FETCHED', 'VERSION_FETCHED', 'VERSION_FETCH_FAILED', 'VERSION_FETCHED', 'ANALYSIS_END']);
    const analysis = await analyzeDataset(ds);
    expect(analysis.chain.valid).toBe(true);
    expect(analysis.observation.source).toBe('SHAREPOINT_VERSION_HISTORY');
    expect(analysis.observation.knownGaps.some((g) => g.type === 'VERSION_UNAVAILABLE')).toBe(true);

    // Second run: previously stored versions are skipped, the failed one is retried, the current is refreshed.
    client.content['514'] = docx(['Introduzione rivista.', 'Un secondo paragrafo con più parole dentro.']);
    client.downloads = 0;
    const again = await importVersionHistory({ locator: LOCATOR, settings: DEFAULT_SETTINGS, extensionVersion: 'test', client: client as unknown as SharePointClient, trigger: 'REFRESH' });
    expect(again).toMatchObject({ fetched: 2, failed: 0, skipped: 2, totalVersions: 4 });
    expect(client.downloads).toBe(2);
    const ds2 = (await loadDataset(LOCATOR.fileId))!;
    expect(ds2.snapshots.map((s) => s.extractionStatus)).toEqual(['FULL', 'FULL', 'FULL', 'FULL']);
    expect(ds2.diffs.map((d) => d.classification)).toEqual(['ADDING', 'REWRITING', 'ADDING']);
    expect(ds2.events.filter((e) => e.type === 'ANALYSIS_START')).toHaveLength(2);
    expect((await analyzeDataset(ds2)).chain.valid).toBe(true);
  });
});

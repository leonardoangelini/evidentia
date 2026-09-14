// @vitest-environment jsdom
import { zipSync, strToU8 } from 'fflate';
import { importVersionHistory } from '@/import/version-importer';
import type { SourceFileInfo, SourceVersionInfo, VersionSource } from '@/import/version-source';
import { DEFAULT_SETTINGS } from '@/models';
import { loadDataset } from '@/storage/repositories';
import { analyzeDataset } from '@/analysis';
import { buildLlmInput } from '@/export/llm-exporter';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const docx = (paragraphs: string[]): Uint8Array =>
  zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document ${W}><w:body>${paragraphs.map((p) => `<w:p><w:r><w:t xml:space="preserve">${p}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`) });

const LOCATOR = { provider: 'GOOGLE_DOCS' as const, fileId: 'FILE_ID_1234567890', fileName: null, host: 'docs.google.com' };

class FakeDriveSource implements VersionSource {
  readonly provider = 'GOOGLE_DOCS' as const;
  async getFileInfo(): Promise<SourceFileInfo> {
    return { id: LOCATOR.fileId, name: 'Tema di storia', path: '', webUrl: 'https://docs.google.com/document/d/FILE_ID_1234567890/edit?usp=drivesdk', timeCreated: '2026-09-10T07:59:00.000Z', timeLastModified: '2026-09-12T10:00:00.000Z', versionLabel: '3', sizeBytes: null, modifiedByName: 'Anna Bianchi', modifiedByIdentity: 'anna@scuola.edu.it' };
  }
  async listVersions(): Promise<SourceVersionInfo[]> {
    return [
      { id: '9', label: '1', created: '2026-09-10T08:00:00.000Z', size: null, authorName: 'Anna Bianchi', authorIdentity: 'anna@scuola.edu.it' },
      { id: '10', label: '2', created: '2026-09-10T08:20:00.000Z', size: null, authorName: 'Anna Bianchi', authorIdentity: 'permission:perm-anna' },
    ];
  }
  async downloadVersion(v: SourceVersionInfo): Promise<Uint8Array> {
    return v.id === '9' ? docx(['Introduzione breve.']) : docx(['Introduzione breve.', 'Un secondo paragrafo con più parole dentro.']);
  }
  async downloadCurrent(): Promise<Uint8Array> {
    return docx(['Introduzione rivista.', 'Un secondo paragrafo con più parole dentro.', 'Conclusione finale del tema.']);
  }
}

describe('version importer with a Google Drive source', () => {
  it('stores the document as GOOGLE_DOCS and labels the source in analysis and exports', async () => {
    const result = await importVersionHistory({ locator: LOCATOR, settings: DEFAULT_SETTINGS, extensionVersion: 'test', client: new FakeDriveSource() });
    expect(result).toMatchObject({ documentId: LOCATOR.fileId, fetched: 3, failed: 0, totalVersions: 3 });
    const ds = (await loadDataset(LOCATOR.fileId))!;
    expect(ds.document).toMatchObject({ provider: 'GOOGLE_DOCS', host: 'docs.google.com', siteUrl: 'https://drive.google.com', serverRelativeUrl: '', currentVersionLabel: '3', webUrl: 'https://docs.google.com/document/d/FILE_ID_1234567890/edit?usp=drivesdk' });
    // Different identities from Drive (email vs permission id) are different pseudonymous authors: the extension does not guess.
    expect(ds.document.authors.map((a) => [a.label, a.versions])).toEqual([['Autore 1', 2], ['Autore 2', 1]]);
    expect(ds.snapshots.map((s) => [s.versionLabel, s.wordCount, s.isCurrent])).toEqual([['1', 2, false], ['2', 9, false], ['3', 13, true]]);
    const analysis = await analyzeDataset(ds);
    expect(analysis.observation.source).toBe('GOOGLE_DRIVE_REVISIONS');
    expect(analysis.observation.limitations.some((l) => l.includes('Google Drive'))).toBe(true);
    expect(analysis.observation.limitations.some((l) => l.includes('Word'))).toBe(false);
    const llm = buildLlmInput(ds, analysis, '2026-09-13T10:00:00+02:00');
    expect(llm.source).toBe('GOOGLE_DRIVE_REVISIONS');
  });
});

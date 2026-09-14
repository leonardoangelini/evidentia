import { parseDocumentLocator } from '@/import/document-locator';
import { parseGoogleDocsLocator } from '@/google/locator';

describe('Google Docs locator', () => {
  it('parses the editor URL, with and without the account index', () => {
    expect(parseGoogleDocsLocator('https://docs.google.com/document/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit?tab=t.0#heading=h.abc')).toEqual({
      provider: 'GOOGLE_DOCS',
      fileId: '1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789',
      fileName: null,
      host: 'docs.google.com',
    });
    expect(parseGoogleDocsLocator('https://docs.google.com/document/u/1/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit')?.fileId).toBe('1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789');
    expect(parseGoogleDocsLocator('https://docs.google.com/a/scuola.edu.it/document/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit')?.fileId).toBe('1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789');
  });
  it('parses a Word file previewed in Drive', () => {
    expect(parseGoogleDocsLocator('https://drive.google.com/file/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/view?usp=sharing')).toMatchObject({ provider: 'GOOGLE_DOCS', fileId: '1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789', host: 'drive.google.com' });
    expect(parseGoogleDocsLocator('https://drive.google.com/open?id=1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789')?.fileId).toBe('1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789');
  });
  it('rejects Sheets, Slides, Drive folders and other hosts', () => {
    expect(parseGoogleDocsLocator('https://docs.google.com/spreadsheets/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit')).toBeNull();
    expect(parseGoogleDocsLocator('https://docs.google.com/presentation/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit')).toBeNull();
    expect(parseGoogleDocsLocator('https://drive.google.com/drive/folders/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789')).toBeNull();
    expect(parseGoogleDocsLocator('https://docs.google.com/document/')).toBeNull();
    expect(parseGoogleDocsLocator('https://contoso-my.sharepoint.com/personal/u/_layouts/15/doc2.aspx?sourcedoc={ABCDEF01-2345-6789-ABCD-EF0123456789}')).toBeNull();
    expect(parseGoogleDocsLocator('not a url')).toBeNull();
  });
  it('is reachable through the unified locator next to SharePoint', () => {
    expect(parseDocumentLocator('https://docs.google.com/document/d/1AbC_dEf-GhIjKlMnOpQrStUvWxYz0123456789/edit')?.provider).toBe('GOOGLE_DOCS');
    expect(parseDocumentLocator('https://contoso.sharepoint.com/sites/Team/_layouts/15/Doc.aspx?sourcedoc={ABCDEF01-2345-6789-ABCD-EF0123456789}&file=Essay.docx')?.provider).toBe('SHAREPOINT');
    expect(parseDocumentLocator('https://onedrive.live.com/edit?id=123')).toBeNull();
  });
});

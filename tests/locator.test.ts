import { parseSharePointLocator } from '@/sharepoint/locator';

describe('SharePoint locator', () => {
  it('parses a OneDrive-for-Business doc2.aspx URL with sharing prefix', () => {
    const loc = parseSharePointLocator(
      'https://contoso-my.sharepoint.com/:w:/r/personal/a_rossi_contoso_it/_layouts/15/doc2.aspx?sourcedoc=%7B0F9A1B2C-3D4E-5F60-7182-93A4B5C6D7E8%7D&file=Questo%20%C3%A8%20un%20test.docx&action=default',
    );
    expect(loc).toEqual({
      provider: 'SHAREPOINT',
      siteUrl: 'https://contoso-my.sharepoint.com/personal/a_rossi_contoso_it',
      fileId: '0f9a1b2c-3d4e-5f60-7182-93a4b5c6d7e8',
      fileName: 'Questo è un test.docx',
      host: 'contoso-my.sharepoint.com',
    });
  });
  it('parses a team site Doc.aspx URL and a direct file URL with ?d=', () => {
    expect(parseSharePointLocator('https://contoso.sharepoint.com/sites/Team/_layouts/15/Doc.aspx?sourcedoc={ABCDEF01-2345-6789-ABCD-EF0123456789}&file=Essay.docx')?.siteUrl).toBe('https://contoso.sharepoint.com/sites/Team');
    const direct = parseSharePointLocator('https://contoso-my.sharepoint.com/personal/u_contoso_it/Documents/Cartella/Saggio.docx?d=wabcdef0123456789abcdef0123456789');
    expect(direct?.siteUrl).toBe('https://contoso-my.sharepoint.com/personal/u_contoso_it');
    expect(direct?.fileId).toBe('abcdef01-2345-6789-abcd-ef0123456789');
    expect(direct?.fileName).toBe('Saggio.docx');
  });
  it('rejects non-SharePoint hosts and URLs without a file id', () => {
    expect(parseSharePointLocator('https://onedrive.live.com/edit?id=123')).toBeNull();
    expect(parseSharePointLocator('https://contoso.sharepoint.com/sites/Team/Shared%20Documents/Forms/AllItems.aspx')).toBeNull();
    expect(parseSharePointLocator('not a url')).toBeNull();
  });
});

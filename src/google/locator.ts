/**
 * Identify a Google Docs document (or a Word file stored in Google Drive)
 * from a browser tab URL. Pure functions, no network.
 *
 * Recognised shapes:
 *   https://docs.google.com/document/d/<fileId>/edit?tab=t.0
 *   https://docs.google.com/document/u/1/d/<fileId>/edit
 *   https://docs.google.com/a/<domain>/document/d/<fileId>/edit
 *   https://drive.google.com/file/d/<fileId>/view          (a .docx kept in Drive, previewed)
 *   https://drive.google.com/open?id=<fileId>
 *
 * Sheets, Slides and Forms are not documents: not recognised.
 */
export interface GoogleDocsLocator {
  provider: 'GOOGLE_DOCS';
  /** Google Drive file id. */
  fileId: string;
  /** Google URLs never carry the file name: it comes from the Drive API. */
  fileName: null;
  host: string;
}

const FILE_ID = /^[A-Za-z0-9_-]{10,}$/;
const DOCS_PATH = /^(?:\/a\/[^/]+)?\/document(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/|$)/;
const DRIVE_PATH = /^(?:\/a\/[^/]+)?\/file(?:\/u\/\d+)?\/d\/([A-Za-z0-9_-]+)(?:\/|$)/;

export function isGoogleDocsHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'docs.google.com' || h === 'drive.google.com';
}

export function parseGoogleDocsLocator(rawUrl: string): GoogleDocsLocator | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  let fileId: string | null = null;
  if (host === 'docs.google.com') fileId = DOCS_PATH.exec(url.pathname)?.[1] ?? null;
  else if (host === 'drive.google.com') fileId = DRIVE_PATH.exec(url.pathname)?.[1] ?? (url.pathname === '/open' ? url.searchParams.get('id') : null);
  if (!fileId || !FILE_ID.test(fileId)) return null;
  return { provider: 'GOOGLE_DOCS', fileId, fileName: null, host };
}

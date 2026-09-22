/**
 * Identify a SharePoint / OneDrive for Business document from a browser
 * tab URL. Pure functions, no network.
 *
 * Recognised shapes (host is *.sharepoint.com, including *-my.sharepoint.com):
 *   https://t-my.sharepoint.com/:w:/r/personal/u/_layouts/15/doc2.aspx?sourcedoc={GUID}&file=Name.docx
 *   https://t.sharepoint.com/sites/Team/_layouts/15/Doc.aspx?sourcedoc={GUID}&file=Name.docx
 *   https://t-my.sharepoint.com/personal/u/Documents/Folder/Name.docx?d=w<guid-without-dashes>
 *
 * Consumer OneDrive (onedrive.live.com) has no SharePoint REST API and is not supported.
 */
export interface SharePointLocator {
  provider: 'SHAREPOINT';
  /** Site collection URL: origin + site path (e.g. /personal/user_tenant_it or /sites/Team). */
  siteUrl: string;
  /** File UniqueId, lower-case GUID with dashes. */
  fileId: string;
  /** File name from the URL, if present. */
  fileName: string | null;
  host: string;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUID_COMPACT = /^w?([0-9a-f]{32})$/i;

export function isSharePointHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h.endsWith('.sharepoint.com');
}

export function parseSharePointLocator(rawUrl: string): SharePointLocator | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isSharePointHost(url.hostname)) return null;

  // Strip the sharing-link prefix (/:w:/r, /:w:/s, /:w:/g …).
  let path = url.pathname.replace(/^\/:[a-z]:\/[a-z]\//i, '/');
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep as is
  }
  const sitePath = sitePathOf(path);
  if (sitePath === null) return null;

  const fileId = normalizeGuid(url.searchParams.get('sourcedoc')) ?? normalizeGuid(url.searchParams.get('d')) ?? normalizeGuid(url.searchParams.get('id'));
  if (!fileId) return null;

  const fileParam = url.searchParams.get('file');
  const fileName = fileParam ?? (/\.docx?$/i.test(path) ? path.split('/').pop() ?? null : null);
  return { provider: 'SHAREPOINT', siteUrl: `${url.origin}${sitePath}`, fileId, fileName, host: url.hostname };
}

/** "/personal/user/_layouts/15/doc2.aspx" → "/personal/user"; "/sites/Team/Shared Documents/x.docx" → "/sites/Team". */
function sitePathOf(path: string): string | null {
  const layouts = path.indexOf('/_layouts/');
  if (layouts >= 0) return path.slice(0, layouts) || '';
  const m = /^(\/(?:personal|sites|teams)\/[^/]+)/i.exec(path);
  if (m && m[1]) return m[1];
  return '';
}

function normalizeGuid(value: string | null): string | null {
  if (!value) return null;
  const v = value.replace(/[{}]/g, '').trim();
  if (GUID.test(v)) return v.toLowerCase();
  const m = GUID_COMPACT.exec(v);
  if (m && m[1]) {
    const s = m[1].toLowerCase();
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
  return null;
}

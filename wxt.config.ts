import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';

/**
 * Public key that pins the extension id of local builds (Google OAuth needs
 * one fixed redirect URI, https://<id>.chromiumapp.org/). Read from
 * WXT_EXTENSION_KEY (.env, git-ignored): absent in CI, so the Web Store ZIP
 * carries no key and gets the id assigned by the store. See GOOGLE_DOCS_NOTES.md.
 */
function extensionKey(): string | undefined {
  // A defined variable wins over .env, even when empty (WXT_EXTENSION_KEY= npm run zip → no key).
  if (process.env.WXT_EXTENSION_KEY !== undefined) return process.env.WXT_EXTENSION_KEY.trim() || undefined;
  if (!existsSync('.env')) return undefined;
  try {
    return parseEnv(readFileSync('.env', 'utf-8')).WXT_EXTENSION_KEY?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * SharePoint Online / OneDrive for Business hosts. The teacher's own session
 * cookies are attached to REST calls made from extension pages, read-only.
 * Keep this list narrow: no <all_urls>.
 */
export const SHAREPOINT_HOSTS = ['*://*.sharepoint.com/*', '*://*.sharepoint-df.com/*', '*://*.sharepoint.us/*'];

/**
 * Google Docs: Drive API and the revision export links. Optional, so that a
 * teacher who only uses SharePoint never grants them; requested from the
 * Process View the first time a Google document is analysed. Requests carry
 * an OAuth token obtained with chrome.identity, never cookies
 * (see src/google/). Keep in sync with GOOGLE_ORIGINS in src/google/permissions.ts.
 */
export const GOOGLE_HOSTS = ['https://www.googleapis.com/*', 'https://docs.google.com/*'];

export default defineConfig({
  srcDir: 'src',
  // EVIDENTIA_OUT_DIR lets a second dev instance build elsewhere without clobbering .output.
  ...(process.env.EVIDENTIA_OUT_DIR ? { outDir: process.env.EVIDENTIA_OUT_DIR } : {}),
  imports: false,
  manifestVersion: 3,
  manifest: {
    name: 'Evidentia',
    description: 'Learning process evidence: analyses the version history of a Word document on SharePoint or of a Google Docs document, locally. Not an AI detector.',
    permissions: ['storage', 'tabs', 'identity'],
    host_permissions: SHAREPOINT_HOSTS,
    optional_host_permissions: GOOGLE_HOSTS,
    action: { default_title: 'Evidentia' },
    ...(extensionKey() ? { key: extensionKey() } : {}),
  },
});

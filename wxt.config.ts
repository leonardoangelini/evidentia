import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';
import { GOOGLE_ORIGINS } from './src/google/origins';

/**
 * Canale di build. `testing` e `production` sono due item distinti sul Chrome
 * Web Store: id diversi, quindi redirect URI OAuth diversi e installazioni
 * affiancabili nello stesso browser. Il canale cambia solo l'identità del
 * pacchetto (nome visibile e version), mai il codice: ciò che si prova sul
 * canale testing è esattamente ciò che si pubblica.
 *
 * Default `testing`, così una build locale non assume per sbaglio l'identità
 * di produzione. La CI lo imposta esplicitamente (vedi .github/workflows/).
 */
const CHANNELS = ['testing', 'production'] as const;
type Channel = (typeof CHANNELS)[number];

function channel(): Channel {
  const raw = (process.env.EVIDENTIA_CHANNEL ?? 'testing').trim() as Channel;
  if (!CHANNELS.includes(raw)) throw new Error(`EVIDENTIA_CHANNEL non valido: "${raw}". Valori ammessi: ${CHANNELS.join(', ')}.`);
  return raw;
}

const CHANNEL = channel();

/**
 * Il Chrome Web Store rifiuta un upload con una version già presente
 * sull'item. Su produzione la version è quella di package.json, promossa a
 * mano; sul canale testing si pubblica a ogni push, quindi il numero di run
 * della CI diventa la quarta componente (Chrome ne ammette fino a quattro).
 * `version_name` resta leggibile nella pagina delle estensioni.
 */
function versionFields(): { version?: string; version_name?: string } {
  const base = JSON.parse(readFileSync('package.json', 'utf-8')).version as string;
  const build = process.env.EVIDENTIA_BUILD_NUMBER?.trim();
  if (CHANNEL === 'production' || !build) return {};
  return { version: `${base}.${build}`, version_name: `${base} testing ${build}` };
}

/**
 * Public key that pins the extension id of local builds (Google OAuth needs
 * one fixed redirect URI, https://<id>.chromiumapp.org/). Read from
 * WXT_EXTENSION_KEY (.env, git-ignored): absent in CI, so the Web Store ZIP
 * carries no key and gets the id assigned by the store. In locale conviene la
 * chiave dell'item **testing**, non quella di produzione. See docs/google-docs.md.
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

export default defineConfig({
  srcDir: 'src',
  // EVIDENTIA_OUT_DIR lets a second dev instance build elsewhere without clobbering .output.
  ...(process.env.EVIDENTIA_OUT_DIR ? { outDir: process.env.EVIDENTIA_OUT_DIR } : {}),
  imports: false,
  manifestVersion: 3,
  manifest: {
    name: CHANNEL === 'production' ? 'Evidentia' : 'Evidentia (Testing)',
    // Il Chrome Web Store rifiuta il pacchetto oltre i 132 caratteri: vedi il
    // test in tests/manifest.test.ts. Traduce la descrizione breve della
    // scheda, in docs/store-listing.md.
    description: 'Reconstructs the writing process of a Word or Google Docs document from its version history, locally. Not an AI detector.',
    permissions: ['storage', 'tabs', 'identity'],
    host_permissions: SHAREPOINT_HOSTS,
    // Unica definizione: src/google/permissions.ts la riusa per chrome.permissions,
    // così manifest e richiesta a runtime non possono divergere.
    optional_host_permissions: GOOGLE_ORIGINS,
    action: { default_title: CHANNEL === 'production' ? 'Evidentia' : 'Evidentia (Testing)' },
    ...versionFields(),
    ...(extensionKey() ? { key: extensionKey() } : {}),
  },
});

import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { defineConfig } from 'wxt';
import { GOOGLE_ORIGINS } from './src/google/origins';
import { SHAREPOINT_ORIGINS } from './src/sharepoint/origins';

/**
 * Canale di build. `production` è il pacchetto che va sul Chrome Web Store;
 * `testing` è la stessa cosa con un'altra identità (nome visibile e version),
 * per le build locali e per l'artefatto di verifica della CI, che si
 * installano scompattate accanto all'estensione pubblica senza confondersi
 * con lei. Il canale non cambia mai il codice: ciò che si prova in locale è
 * esattamente ciò che si pubblica.
 *
 * Default `testing`, così una build locale non assume per sbaglio l'identità
 * di produzione. Il rilascio lo imposta esplicitamente (vedi release.yml).
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
 * Su produzione la version è quella di package.json, promossa a mano. Sul
 * canale testing il numero di run della CI diventa la quarta componente
 * (Chrome ne ammette fino a quattro), così due artefatti costruiti dalla
 * stessa version restano distinguibili; `version_name` resta leggibile nella
 * pagina delle estensioni.
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
 * carries no key and gets the id assigned by the store. Genera la tua coppia
 * di chiavi (vedi .env.example): l'id che ne deriva è quello da registrare
 * come redirect URI di sviluppo. See docs/google-docs.md.
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
    // Nessun permesso con avviso all'installazione: activeTab al posto di tabs
    // (l'URL della tab serve solo quando il docente clicca l'icona) e nessun
    // host obbligatorio. SharePoint e Google sono chiesti a runtime, con un
    // click, dai moduli permissions.ts che riusano le stesse liste.
    permissions: ['storage', 'activeTab', 'identity'],
    optional_host_permissions: [...SHAREPOINT_ORIGINS, ...GOOGLE_ORIGINS],
    action: { default_title: CHANNEL === 'production' ? 'Evidentia' : 'Evidentia (Testing)' },
    ...versionFields(),
    ...(extensionKey() ? { key: extensionKey() } : {}),
  },
});

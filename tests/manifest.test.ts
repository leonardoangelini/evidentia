import config from '../wxt.config';
import { isSharePointOrigin, sharePointOriginFor } from '../src/sharepoint/origins';

/**
 * Il Chrome Web Store rifiuta il caricamento del pacchetto se il manifest
 * supera i limiti dello store, e lo dice solo al momento dell'upload: la CI
 * costruirebbe uno ZIP verde e irricevibile. Qui i limiti sono verificati
 * prima, dove costano un test rosso invece di un rilascio fallito.
 */
describe('limiti del manifest imposti dallo store', () => {
  const manifest = config.manifest as { name: string; description: string };

  it('tiene la description entro i 132 caratteri', () => {
    expect(manifest.description.length).toBeLessThanOrEqual(132);
  });

  it('tiene il name entro i 75 caratteri', () => {
    expect(manifest.name.length).toBeLessThanOrEqual(75);
  });
});

/**
 * Ogni permesso obbligatorio che Chrome traduce in un avviso compare nella
 * finestra di installazione ("Leggere la cronologia di navigazione",
 * "Leggere e modificare i tuoi dati su…"). Evidentia non ne ha bisogno: gli
 * host si chiedono a runtime, un sito alla volta.
 */
describe('permessi senza avvisi all\'installazione', () => {
  const manifest = config.manifest as { permissions: string[]; host_permissions?: string[]; optional_host_permissions: string[] };

  it('non chiede tabs né host obbligatori', () => {
    expect(manifest.permissions).not.toContain('tabs');
    expect(manifest.permissions).toContain('activeTab');
    expect(manifest.host_permissions ?? []).toEqual([]);
  });

  it('dichiara come opzionali solo host https, SharePoint Online e Google', () => {
    expect(manifest.optional_host_permissions).toEqual(['https://*.sharepoint.com/*', 'https://www.googleapis.com/*', 'https://docs.google.com/*']);
  });

  it('chiede a runtime un origin che ricade nel pattern dichiarato', () => {
    const origin = sharePointOriginFor('Scuola-my.SharePoint.com');
    expect(origin).toBe('https://scuola-my.sharepoint.com/*');
    expect(isSharePointOrigin(origin)).toBe(true);
    expect(isSharePointOrigin('https://www.googleapis.com/*')).toBe(false);
    expect(isSharePointOrigin('https://evil.com/x.sharepoint.com/*')).toBe(false);
  });
});

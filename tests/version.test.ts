import { getExtensionVersion, getVersionLabel } from '@/utils/version';

/**
 * La version mostrata nell'interfaccia serve a sapere quale build si ha
 * installata quando si segnala un problema: sul canale testing deve dire
 * anche il numero di build, che è l'unica cosa che distingue due pacchetti
 * con la stessa version di package.json.
 */
describe('version mostrata nell\'interfaccia', () => {
  const g = globalThis as unknown as { chrome?: unknown };
  const original = g.chrome;

  const withManifest = (manifest: unknown): void => {
    g.chrome = { runtime: { getManifest: () => manifest } };
  };

  afterEach(() => {
    g.chrome = original;
  });

  it('usa la version quando il manifest non ha version_name (produzione)', () => {
    withManifest({ version: '0.1.2' });
    expect(getVersionLabel()).toBe('0.1.2');
  });

  it('preferisce version_name, che sul canale testing porta il numero di build', () => {
    withManifest({ version: '0.1.2.37', version_name: '0.1.2 testing 37' });
    expect(getVersionLabel()).toBe('0.1.2 testing 37');
  });

  it('ignora un version_name vuoto', () => {
    withManifest({ version: '0.1.2', version_name: '  ' });
    expect(getVersionLabel()).toBe('0.1.2');
  });

  it('non lancia fuori da un\'estensione', () => {
    g.chrome = undefined;
    expect(getVersionLabel()).toBe('0.0.0');
  });

  it('nei metadati dell\'export resta una version e nient\'altro', () => {
    withManifest({ version: '0.1.2.37', version_name: '0.1.2 testing 37' });
    expect(getExtensionVersion()).toBe('0.1.2.37');
  });
});

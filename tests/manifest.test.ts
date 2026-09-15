import config from '../wxt.config';

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

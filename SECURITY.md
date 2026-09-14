# Sicurezza

## Segnalare una vulnerabilità

**Non aprire una issue pubblica.**

Usa la segnalazione privata di GitHub: scheda **Security** del repository →
*Report a vulnerability*. Arriva solo ai manutentori.

Nella segnalazione aiuta avere: versione dell'estensione, browser, i passi per
riprodurre, e l'impatto che ipotizzi. Se serve allegare dati, **usa i casi
demo** o dati inventati: mai un documento reale di uno studente.

Risposta entro pochi giorni. Se una vulnerabilità è confermata, la correzione
viene pubblicata come nuova versione sul Chrome Web Store e descritta in un
security advisory.

## Versioni supportate

Riceve correzioni solo l'ultima versione pubblicata. Il progetto è in `0.x`:
non esiste ancora un ramo di manutenzione per le versioni precedenti.

## Superficie di attacco

Utile saperlo prima di segnalare:

- L'estensione non ha né service worker né content script. Tutto avviene nelle
  sue pagine (popup e Process View).
- I permessi host sono limitati a `*.sharepoint.com`, `*.sharepoint-df.com`,
  `*.sharepoint.us`. Quelli Google (`googleapis.com`, `docs.google.com`) sono
  **opzionali** e vengono chiesti solo al primo documento Google Docs.
- Le chiamate a SharePoint usano i cookie di sessione dell'utente
  (`credentials: 'include'`) e sono in sola lettura.
- Le chiamate a Google usano un access token OAuth (implicit grant, nessun
  client secret) con lo scope `drive.readonly`, mai i cookie. Il token vive in
  `chrome.storage.session`: memoria, mai disco.
- I documenti importati, i testi e le analisi restano in IndexedDB, in locale.
  Nessun dato lascia il browser: non c'è alcun backend.
- Testo e metadati provengono da un documento che l'estensione non controlla
  (nome file, nome dell'autore, contenuto delle versioni). La Process View
  costruisce il DOM con `document.createTextNode` (`src/ui/shared/dom.ts`) e il
  report HTML esportato passa ogni interpolazione da `esc()`
  (`src/export/html-report.ts`): quel testo non viene mai interpretato come
  markup. Una regressione su questo percorso è il tipo di problema più
  rilevante per il progetto — segnalala.

## Fuori ambito

- L'impossibilità di rilevare l'uso di AI o di attribuire la paternità di un
  testo non è una vulnerabilità: è una scelta di progetto, documentata in
  [README.md](README.md) e [PRIVACY.md](PRIVACY.md).
- La hash chain in `src/integrity/` rileva alterazioni accidentali di un
  dataset esportato. Non è una firma crittografica e non regge contro un utente
  che voglia deliberatamente falsificare un export: è dichiarato, non è un bug.
- Le versioni che il server non conserva o consolida non sono recuperabili
  dall'estensione.

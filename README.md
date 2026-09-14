# Evidentia

Browser extension (Chrome / Edge, Manifest V3) per **docenti**: legge la
cronologia delle versioni che il server conserva per un documento
(SharePoint/OneDrive per Word, Google Drive per Google Docs) e ricostruisce
il processo di scrittura.

> Evidentia non dimostra chi abbia scritto un testo e non dimostra l'uso di AI.
> Rende osservabile una parte del processo con cui il testo è stato prodotto,
> attraverso le versioni conservate dal server.

Per ogni versione: data, autore (etichetta pseudonima), testo, conteggi.
Da queste: diff fra versioni, sessioni (versioni vicine nel tempo), grandi
inserimenti, revisioni, metriche deterministiche, **gap di osservazione**,
report HTML e input pronto per un LLM. Tutto resta nel browser.

Documentazione di progetto:

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — analisi, architettura, scelte
- [DATA_MODEL.md](DATA_MODEL.md) — modello dati e schema di export
- [PRIVACY.md](PRIVACY.md) — principi, modalità FULL / METRICS_ONLY, permessi
- [RELEASE.md](RELEASE.md) — CI/CD e pubblicazione sul Chrome Web Store
- [STORE_LISTING.md](STORE_LISTING.md) — testi della scheda Chrome Web Store
- [WORD_ONLINE_NOTES.md](WORD_ONLINE_NOTES.md) — API SharePoint, DOCX, limiti
- [GOOGLE_DOCS_NOTES.md](GOOGLE_DOCS_NOTES.md) — API Drive, OAuth, client ID, limiti delle revisioni Google

## Requisiti

- Node.js ≥ 20 (sviluppato con Node 26)
- Chrome o Edge recenti
- Per Word: account Microsoft 365 di lavoro o scuola con accesso al documento
  (SharePoint Online / OneDrive for Business; OneDrive consumer non supportato)
- Per Google Docs: account Google con accesso al documento e un client ID
  OAuth 2.0 (della scuola o compilato nella build con `WXT_GOOGLE_CLIENT_ID`,
  vedi [GOOGLE_DOCS_NOTES.md](GOOGLE_DOCS_NOTES.md))

> **Se forki il progetto**: registra un client ID OAuth tuo. Quello della build
> ufficiale non è nel repository, e usare il client ID di un altro progetto
> Cloud significa consumarne la quota e mostrare il nome altrui nella schermata
> di consenso.

## Build e installazione

```bash
npm install
npm run build          # → .output/chrome-mv3
npm run build:edge     # → .output/edge-mv3
```

1. `chrome://extensions` (o `edge://extensions`) → modalità sviluppatore.
2. "Carica estensione non pacchettizzata" → `.output/chrome-mv3`.
3. Apri un documento Word su SharePoint/OneDrive o un documento Google Docs,
   clicca l'icona di Evidentia → **Analizza cronologia versioni**. Per Google
   la Process View chiede una volta il permesso per gli host Google e il
   consenso OAuth.

### Sviluppo con ricarica automatica

```bash
npm run dev            # Chrome con l'estensione caricata
npm run dev:edge
```

Usa un profilo Chrome dedicato e persistente in `.wxt/chrome-profile` (il
login Microsoft 365 resta fra un avvio e l'altro). Nota: Chrome disabilita
le estensioni caricate da riga di comando se il profilo non ha la modalità
sviluppatore attiva; `npm run dev` la pre-imposta (`scripts/prepare-dev-profile.mjs`).
In dev mode è necessario che il processo `npm run dev` resti attivo.

## Uso

- **Popup**: riconosce il documento dalla tab (SharePoint/OneDrive o Google Docs);
  avvia o aggiorna l'analisi; export.
- **Process View**: overview, timeline (parole per versione con sessioni,
  grandi inserimenti, revisioni, intervalli lunghi), sessioni, **tempo
  stimato** (tempo osservato e stimato per sessione e per giornata, parole
  per ora), **contenuti per fase** (quali sezioni e paragrafi sono comparsi,
  cambiati o scomparsi in ogni sessione; provenienza di ogni paragrafo del
  testo finale; testo eliminato), versioni (seleziona due versioni per il
  diff), grandi inserimenti, statistiche di revisione, gap di osservazione,
  raw data, impostazioni.

Ogni valore mostrato ha un'icona "i" con la sua definizione (significato,
metodo di calcolo, come leggerlo) e l'etichetta Osservato / Derivato /
Stima; la scheda **Glossario** le raccoglie tutte. Le stesse definizioni
sono nei tooltip del report HTML, nel glossario e nelle legende del
documento per Copilot, in `glossary.json` e nel campo `glossary` degli input
JSON per LLM (sorgente unica: `src/analysis/glossary.ts`).

Il tempo attivo non è osservabile: la stima somma gli archi delle sessioni
più un margine di avvio per sessione (default 5 minuti, modificabile) ed è
sempre presentata come stima, con le sue avvertenze.
- **Dati demo**: dalla barra laterale si caricano i casi A–E (scrittura
  progressiva, grande inserimento, bozza + revisione, cronologia scarsa con
  prima versione già completa, versioni non scaricabili).

Se l'analisi risponde "HTTP 403 … unauthorized", la sessione Microsoft 365
è scaduta: riapri il documento (login) e ripeti. Per Google Docs un 401/403
significa consenso mancante o account senza accesso al documento: ripeti
dal popup (il consenso viene richiesto di nuovo) o usa *Disconnetti Google*
nelle impostazioni e riprova.

## Export

**Per Copilot / ChatGPT / Claude**: il pulsante *Esporta per Copilot / LLM
(.docx)* produce un solo file Word con istruzioni, dati osservati (versioni,
sessioni, tempo stimato e ritmo, evoluzione dei contenuti per fase, mappa del
testo finale, testo eliminato, transizioni, inserimenti, revisioni, metriche),
limiti e testo della versione corrente. Caricalo nella chat e scrivi "Segui le
istruzioni contenute nel documento". Lo stesso contenuto è disponibile in
Markdown (`.md`). Entrambi sono inclusi anche nello ZIP (`llm/analysis-for-llm.*`).

**ZIP completo**: `document.json`, `versions.json`, `diffs.json`,
`sessions.json`, `events.jsonl` (hash chain SHA-256), `metrics.json`,
`timeline.json`, `observation.json`, `time-estimates.json`,
`content-evolution.json`, `glossary.json`, `final.txt`, `llm/analysis-input.json`,
`llm/analysis-input-compact.json`, `llm/analysis-prompt.md`,
`report/process-report.html`, `README.txt`.

Per un'analisi con un LLM a partire dal JSON: copia il prompt da
`llm/analysis-prompt.md` e allega `llm/analysis-input-compact.json`.

```bash
npm run demo:export    # export dei casi demo → .output/demo-exports/<caso>/
```

## Marchio e immagine coordinata

Il marchio "Fogli" (tre versioni di un documento una sull'altra) e tutti i
formati derivati (SVG, PNG, favicon, tile per il Chrome Web Store, immagine
Open Graph) sono in [brand/](brand/) con il relativo README. Si rigenerano
da un'unica sorgente con `npm run brand:build`, che aggiorna anche le icone
dell'estensione in `public/icon/`.

Il nome "Evidentia" e il marchio **non** sono coperti dalla licenza del codice
(Apache-2.0, sezione 6): un fork è liberissimo di usare il codice, ma va
distribuito con nome e marchio propri — soprattutto sul Chrome Web Store, dove
un'estensione omonima confonderebbe gli utenti. Vedi [NOTICE](NOTICE).

## Sviluppo

```bash
npm run typecheck
npm test
```

Struttura (`src/`): `sharepoint/` (locator + client REST), `google/`
(locator, OAuth, client Drive API), `import/` (interfaccia comune
`VersionSource`, locator unificato, importer), `docx/` (estrazione testo,
usata da entrambe le sorgenti), `integrity/` (hash chain),
`analysis/`, `storage/`, `export/`, `ui/`, `models/`, `utils/`, `demo/`.
Nessun service worker e nessun content script: le pagine dell'estensione
fanno tutto.

## Limiti noti

- Fra due versioni non è osservato nulla: niente digitazione, incolla, tempo attivo.
- Il tempo di lavoro è una stima (archi delle sessioni + margine di avvio):
  un documento aperto senza modifiche o il lavoro fuori dal documento non compaiono.
- La provenienza dei paragrafi segue varianti con almeno il 50% di parole in
  comune nello stesso ordine: riscritture radicali appaiono come paragrafo nuovo
  più paragrafo eliminato.
- Versioni cancellate o consolidate dal server non sono rilevabili. Per Google
  Docs l'API Drive espone solo una parte delle revisioni, più rada della
  cronologia dettagliata dell'editor.
- L'autore di una versione è chi l'ha salvata, non necessariamente chi ha scritto.
- La hash chain rileva alterazioni accidentali del dataset, non è una prova forense.
- Nessun punteggio di sospetto né attribuzione dell'origine del testo: per scelta.

## Contribuire

Segnalazioni, correzioni e discussioni sul metodo sono benvenute — anche da chi
non scrive codice. Come partire, i vincoli di progetto da rispettare e i
requisiti di una PR: [CONTRIBUTING.md](CONTRIBUTING.md).

Per una vulnerabilità non aprire una issue pubblica: [SECURITY.md](SECURITY.md).

## Licenza

[Apache License 2.0](LICENSE) — Copyright 2026 Leonardo Angelini.

Uso, modifica e ridistribuzione sono liberi, anche commerciali, a condizione di
mantenere avvisi di copyright e licenza, dichiarare le modifiche e includere il
file [NOTICE](NOTICE). La licenza include una concessione esplicita di brevetto
e non concede diritti sul marchio (vedi sopra).

Font Manrope sotto SIL Open Font License 1.1 (`brand/src/fonts/OFL.txt`);
licenze delle dipendenze in [NOTICE](NOTICE).

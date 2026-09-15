# Sviluppo

Guida tecnica per chi lavora sul codice. Per cosa fa Evidentia e a chi serve,
vedi il [README](../README.md); per le scelte di progetto,
[architecture.md](architecture.md).

## Requisiti

- **Node.js ≥ 20** (lo sviluppo avviene su Node 26, la stessa versione usata in CI)
- Chrome o Edge recenti
- Per Word: account Microsoft 365 di lavoro o scuola con accesso al documento
  (SharePoint Online / OneDrive for Business; OneDrive consumer non è supportato)
- Per Google Docs: account Google con accesso al documento e un client ID
  OAuth 2.0 — vedi [google-docs.md](google-docs.md)

## Build

```bash
npm install
npm run build          # → .output/chrome-mv3
npm run build:edge     # → .output/edge-mv3
npm run zip            # → .output/evidentia-<version>-chrome.zip
```

Per installare una build locale: `chrome://extensions` (o `edge://extensions`)
→ modalità sviluppatore → *Carica estensione non pacchettizzata* →
`.output/chrome-mv3`.

## Sviluppo con ricarica automatica

```bash
npm run dev            # Chrome con l'estensione già caricata
npm run dev:edge
```

Usa un profilo Chrome dedicato e persistente in `.wxt/chrome-profile`, così il
login Microsoft 365 sopravvive fra un avvio e l'altro.

Due trappole della modalità sviluppo, entrambe già gestite ma utili da sapere:

- Chrome disabilita le estensioni caricate da riga di comando se il profilo non
  ha la modalità sviluppatore attiva. `npm run dev` la pre-imposta tramite
  `scripts/prepare-dev-profile.mjs`.
- WXT registra gli script solo finché il processo `npm run dev` resta vivo: se
  lo chiudi, l'estensione nel profilo smette di funzionare.

## Verifiche

```bash
npm run typecheck      # tsc --noEmit
npm test               # vitest run
npm run test:watch
```

Gli stessi due comandi girano in CI su ogni push e pull request
([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)).

## Struttura del codice

Tutto sotto `src/`:

| Cartella | Contenuto |
|---|---|
| `sharepoint/` | riconoscimento dell'URL (locator) e client REST di SharePoint |
| `google/` | locator, OAuth (`chrome.identity`), client dell'API Drive, permessi |
| `import/` | interfaccia comune `VersionSource`, locator unificato, importer |
| `docx/` | estrazione del testo dal DOCX, usata da entrambe le sorgenti |
| `analysis/` | diff, sessioni, metriche, timeline, stima dei tempi, evoluzione dei contenuti, glossario |
| `integrity/` | hash chain SHA-256 degli eventi |
| `storage/` | IndexedDB (`idb`), repository, impostazioni |
| `export/` | report HTML, export per LLM, ZIP completo |
| `ui/` | popup e Process View (DOM diretto, nessun framework) |
| `models/` | tipi del dominio e schema del dataset |
| `demo/` | generatore dei casi demo |
| `utils/` | hash, id, testo, tempo, versioni |

Non esistono **service worker** né **content script**: tutto avviene nelle
pagine dell'estensione. È una scelta di progetto, non una mancanza — riduce la
superficie dei permessi e rende l'estensione ispezionabile.

Il glossario (`src/analysis/glossary.ts`) è la **sorgente unica** delle
definizioni: interfaccia, tooltip del report HTML, `glossary.json` nello ZIP e
campo `glossary` dell'input per LLM leggono tutti da lì. Un valore nuovo
mostrato all'utente si aggiunge prima lì.

## Dati demo

Dalla barra laterale della Process View si caricano i casi A–E: scrittura
progressiva, grande inserimento, bozza + revisione importante, cronologia
scarsa con prima versione già completa, versioni non scaricabili.

Servono a sviluppare e a fare screenshot senza toccare un documento reale.
**Usali sempre** per issue, pull request e materiale pubblico.

```bash
npm run demo:export    # esporta i casi demo → .output/demo-exports/<caso>/
```

## Export: cosa contiene lo ZIP

`document.json`, `versions.json`, `diffs.json`, `sessions.json`,
`events.jsonl` (hash chain SHA-256), `metrics.json`, `timeline.json`,
`observation.json`, `time-estimates.json`, `content-evolution.json`,
`glossary.json`, `final.txt`, `llm/analysis-input.json`,
`llm/analysis-input-compact.json`, `llm/analysis-prompt.md`,
`llm/analysis-for-llm.docx`, `llm/analysis-for-llm.md`,
`report/process-report.html`, `README.txt`.

Lo schema dei singoli file è in [data-model.md](data-model.md).

## Immagine coordinata

```bash
npm run brand:build    # rigenera brand/ e le icone in public/icon/
npm run store:shots    # rigenera gli screenshot dello store dai casi demo
```

Tutti i file in `brand/` sono generati da un'unica sorgente geometrica
(`brand/src/marks.mjs`): non modificarli a mano, modifica la sorgente e
rigenera. Dettagli in [brand/README.md](../brand/README.md).

`npm run store:shots` richiede una volta `npx playwright-core install chromium`:
Chrome stabile dalla versione 137 ignora `--load-extension`, quindi lo script
usa la build "Chrome for Testing".

## Rami e ambienti

| Branch | Ambiente | Cosa succede a ogni push |
|---|---|---|
| `main` | sviluppo | CI + deploy sull'item *Evidentia (Testing)* dello store |
| `production` | produzione | Release sull'estensione pubblica, con approvazione |

Si lavora su `main`; si rilascia alzando la `version` e promuovendo `main` su
`production` con un merge fast-forward.

### Variabili d'ambiente della build

| Variabile | Effetto |
|---|---|
| `EVIDENTIA_CHANNEL` | `testing` (default) o `production`: nome visibile e `version` del pacchetto. Mai il codice |
| `EVIDENTIA_BUILD_NUMBER` | quarta componente della version sul canale testing (in CI è il numero di run) |
| `WXT_GOOGLE_CLIENT_ID` | client ID OAuth predefinito per Google Docs; le impostazioni lo sovrascrivono |
| `WXT_EXTENSION_KEY` | chiave pubblica che fissa l'id delle build locali (assente in CI) |
| `EVIDENTIA_OUT_DIR` | cartella di output alternativa, per costruire due varianti senza sovrascriversi |

```bash
EVIDENTIA_CHANNEL=production npm run zip   # pacchetto identico a quello pubblicato
```

## Pubblicazione

Vedi [release.md](release.md): i due item sullo store, i secret dei due
environment, l'approvazione manuale e il flusso di promozione.

# Evidentia — Architettura e scelte di progetto

Evidentia è una browser extension (Manifest V3, Chrome/Edge) per **docenti**:
apre la cronologia delle versioni che SharePoint/OneDrive conserva per un
documento Word e ne ricostruisce il processo di scrittura (versioni, diff,
sessioni, metriche, gap di osservazione). Non è un AI detector: descrive
**versioni osservate**, senza punteggi di sospetto.

Documenti collegati: [`data-model.md`](data-model.md), [`../PRIVACY.md`](../PRIVACY.md), [`sharepoint.md`](sharepoint.md)
(come vengono lette le versioni e con quali limiti).

---

## 1. Perché la cronologia versioni

Il brief iniziale prevedeva un tracking attivato dallo studente durante la
scrittura. Il committente ha poi chiarito che l'estensione è usata dal
docente **a posteriori**: la fonte dei dati è quindi la cronologia versioni
del server, non l'osservazione dal vivo. Il tracking lato studente è stato
rimosso. Conseguenze:

| | Tracking (rimosso) | Cronologia versioni (attuale) |
|--|--|--|
| Chi agisce | studente, durante la scrittura | docente, dopo |
| Fonte | eventi DOM di Word Online | API REST di SharePoint; API Drive (OAuth) per Google Docs |
| Unità di osservazione | keystroke, paste, snapshot periodici | versione salvata (testo, data, autore) |
| Tempo attivo/inattivo | osservabile | **non osservabile**: solo date di salvataggio |
| Paste | osservabile | **non osservabile**: solo "grande inserimento fra versioni" |
| Copertura | dichiarata per sessione | dichiarata per intervallo fra versioni |

## 2. Analisi dei requisiti: cosa è certo e cosa è fragile

| Area | Affidabilità | Note |
|------|--------------|------|
| Riconoscere il documento dall'URL della tab | Alta | `sourcedoc={GUID}` + percorso del sito (`/personal/...`, `/sites/...`). |
| Elenco versioni (`/_api/web/GetFileById(id)/Versions`) | Alta | Verificato su tenant universitario: data, etichetta, dimensione, autore, URL di download. |
| Download di una versione (`_vti_history/<id>/...`) e del file corrente (`/$value`) | Alta | Verificato: DOCX completi. |
| Autenticazione | Media | Usa i cookie di sessione del docente; se la sessione è scaduta la API risponde 403 e l'estensione lo dice. |
| Estrazione testo dal DOCX | Alta | `word/document.xml`, paragrafi e titoli; revisioni tracciate: cancellazioni escluse, inserimenti inclusi. |
| Completezza della cronologia | **Bassa-media** | SharePoint può ridurre o cancellare versioni; il salvataggio automatico crea versioni a cadenza variabile. Non rilevabile: dichiarato come limite. |
| OneDrive consumer (onedrive.live.com) | Non supportato | Nessuna API REST accessibile con i cookie. |
| Google Docs: riconoscimento dall'URL | Alta | `docs.google.com/document/d/<id>`; anche `.docx` in Drive (`drive.google.com/file/d/<id>`). |
| Google Docs: elenco e download revisioni (Drive API v3) | Alta (API documentata) | Ogni revisione esportata in DOCX tramite `exportLinks`; stesso estrattore di Word. |
| Google Docs: autenticazione | Media | OAuth con `chrome.identity.launchWebAuthFlow`; serve un client ID (impostazioni o build). Scope `drive.readonly` è *restricted*: consenso Interno per Workspace, altrimenti verifica Google. |
| Google Docs: completezza | **Bassa** | L'API espone solo parte delle revisioni (più rade dell'editor) e Google può accorparle. Dichiarato come limite. |

Decisione architetturale: ogni versione ha uno stato di estrazione (`FULL`
o `UNAVAILABLE`) e ogni intervallo lungo, prima versione già completa o
versione non leggibile è un `ObservationGap` esplicito. Il sistema non
inventa dati mancanti.

## 3. Architettura

```text
┌──────────────────────────────────────────────────────────────┐
│ Tab del docente: Word su SharePoint/OneDrive o Google Docs   │
│   → nessun content script: serve solo l'URL della tab        │
└──────────────────────────────────────────────────────────────┘
                 │ chrome.tabs (URL)
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ Popup                                                        │
│   riconosce il documento (locator) → "Analizza cronologia"   │
└──────────────────────────────────────────────────────────────┘
                 │ apre process-view.html?import=<url>
                 ▼
┌──────────────────────────────────────────────────────────────┐
│ Process View (pagina dell'estensione)                        │
│   VersionImporter: VersionSource = SharePointClient (fetch   │
│   con cookie) | GoogleDriveClient (Drive API, token OAuth)   │
│   → DocxText → SnapshotBuilder → DiffEngine                  │
│   → IndexedDB; EventLog con hash chain                       │
│   Analisi (sessioni, metriche, timeline, coverage) ed export │
│   (ZIP, LLM input, report HTML) sono funzioni pure.          │
└──────────────────────────────────────────────────────────────┘
```

Nessun service worker e nessun content script: le pagine dell'estensione
hanno `DOMParser`, IndexedDB e, grazie alle host permission, fetch con i
cookie di SharePoint; per Google, `chrome.identity` fornisce il token OAuth
e gli host Google sono permessi opzionali concessi con un click.

### Struttura del codice

```text
src/
  entrypoints/popup, process-view    wrapper WXT
  sharepoint/locator.ts              URL tab → { siteUrl, fileId }
  sharepoint/sharepoint-client.ts    REST: file info, versioni, download
  google/locator.ts                  URL tab → { fileId } (Docs, Drive)
  google/google-auth.ts              OAuth via chrome.identity, token in storage.session
  google/google-drive-client.ts      Drive API v3: file, revisioni, export DOCX
  google/permissions.ts              host permission opzionali Google
  docx/docx-text.ts                  DOCX → paragrafi, titoli, testo
  import/version-source.ts           interfaccia comune delle sorgenti
  import/document-locator.ts         locator unificato → VersionSource
  import/version-importer.ts         orchestrazione e persistenza
  import/snapshot-builder.ts         candidate → snapshot sigillato
  integrity/event-log.ts             hash chain del log di analisi
  analysis/                          session-tracker, diff-engine, metrics,
                                     timeline, observation, index
  storage/                           IndexedDB (idb), settings
  export/                            exporter (ZIP), llm-exporter, html-report
  ui/                                popup, process-view, shared
  models/, utils/, demo/
tests/                               vitest (unità + importer con client finto)
```

### Flusso dell'import

1. `parseDocumentLocator(tabUrl)` → SharePoint (sito + GUID) o Google (id file); `createVersionSource` sceglie il client.
2. `getFileInfo` → record documento (la modalità privacy si fissa alla prima analisi).
3. `listVersions` → elenco ordinato; le versioni già presenti non vengono riscaricate.
4. Per ogni versione: download → SHA-256 dei byte → estrazione testo → candidate.
   In caso di errore: snapshot `UNAVAILABLE` + evento `VERSION_FETCH_FAILED`.
5. Il file corrente viene sempre riletto (`versionId: "current"`).
6. Indici cronologici e diff consecutivi vengono ricalcolati per intero; il
   log di analisi viene sigillato nella hash chain.

### Sessioni e tempo

Una sessione è un gruppo di versioni salvate a meno di
`sessionGapMinutes` (default 30) l'una dall'altra. Ha un arco temporale
(prima → ultima versione) ma **nessun** tempo attivo/inattivo osservato.

Il tempo di lavoro viene quindi **stimato** (`analysis/time-estimator.ts`):
somma degli archi delle sessioni più un margine di avvio per sessione
(`sessionLeadInMinutes`, default 5, limitato dal tempo trascorso dalla
versione precedente). Da qui le parole per ora (nette e aggiunte, per
sessione, per giornata e sull'intero lavoro). Ogni numero è etichettato come
stima e accompagnato dalle avvertenze; la prima versione disponibile non è
attribuita ad alcuna sessione.

### Spiegazioni dei dati

Ogni valore mostrato è definito una sola volta in `analysis/glossary.ts`
(significato, metodo, lettura, tipo osservato/derivato/stima). UI, report
HTML, documento per LLM e JSON usano quelle definizioni: tooltip, glossario,
legende per tabella.

### Evoluzione dei contenuti

`analysis/content-evolution.ts` attribuisce ogni paragrafo alla sezione del
titolo che lo precede e, per ogni sessione, calcola il diff per sezione fra
l'ultima versione leggibile precedente e l'ultima della sessione. Per ogni
paragrafo del testo finale ricostruisce prima comparsa, ultima modifica e
numero di varianti (similarità = sottosequenza comune ≥ 50%); elenca i
paragrafi eliminati e mai ripresi. Output: fasi con riassunto neutro,
sezioni, mappa del testo finale, testo eliminato.

## 4. Ordine di implementazione (eseguito)

1. Scaffolding WXT, tsconfig, vitest, manifest (`storage`, `tabs`, host SharePoint).
2. `models/`, `utils/`.
3. `docx-text` + test; `locator` + `sharepoint-client` + test; API validata sul tenant.
4. `version-importer` + `snapshot-builder` + storage v2 + test con client finto.
5. Analisi: sessioni da versioni, diff, metriche, timeline, coverage, stime di tempo, evoluzione dei contenuti.
6. Export: LLM input (schema 2.1), prompt, report HTML, ZIP, file unico `.docx`/`.md` per Copilot/LLM.
7. UI: popup, Process View con avanzamento import, confronto versioni, impostazioni.
8. Demo A–E su cronologie simulate; `npm run demo:export`.
9. Google Docs: `VersionSource` comune, client Drive API con OAuth, permessi opzionali, limiti dichiarati per provider.

## 5. Cosa NON fa l'MVP (esplicitamente)

- Non osserva digitazione, incolla, tempo attivo: fra due versioni non è osservato nulla. Il tempo è stimato dagli orari delle versioni e dichiarato come stima.
- Non attribuisce origine al testo né produce punteggi di sospetto.
- Non invia dati a server: le uniche richieste di rete sono le GET verso SharePoint o la Drive API di Google.
- Non rileva versioni cancellate o consolidate dal server.
- Non supporta OneDrive consumer.
- Per Google Docs non legge la cronologia dettagliata dell'editor (endpoint interni non documentati): solo le revisioni esposte dall'API Drive.
- La hash chain rileva alterazioni accidentali del dataset esportato; non è forense.

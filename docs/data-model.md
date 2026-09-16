# Evidentia — Data Model

Tutti i tipi sono definiti in `src/models/`. Timestamp in ISO 8601 con
offset locale (le date UTC di SharePoint e Google Drive vengono convertite all'import);
durate in millisecondi salvo dove indicato (`*Minutes`, `*Hours`).

## Principio: Observation vs Interpretation

Il modello persiste **solo osservazioni** (versioni, differenze, operazioni
di analisi). Metriche e timeline sono derivazioni deterministiche. Non
esistono campi come `aiProbability` o `suspicionScore`, e non vanno aggiunti.

---

## 1. AnalyzedDocument

```ts
interface AnalyzedDocument {
  id: string;                 // UniqueId SharePoint del file (GUID) o id file Google Drive
  name: string;
  provider?: 'SHAREPOINT' | 'GOOGLE_DOCS';  // assente nei documenti salvati prima del supporto Google = SHAREPOINT
  siteUrl: string;            // https://tenant-my.sharepoint.com/personal/utente | https://drive.google.com
  serverRelativeUrl: string;  // percorso SharePoint; vuoto per Google
  webUrl: string;             // link al documento, senza token
  host: string;
  timeCreated: string | null;
  timeLastModified: string | null;
  currentVersionLabel: string | null;
  firstAnalyzedAt: string; lastAnalyzedAt: string;
  extensionVersion: string;
  privacyMode: 'FULL' | 'METRICS_ONLY';   // fissata alla prima analisi
  authors: Author[];
  student?: { studentId?; assignmentId?; courseId? };   // pseudonimi opzionali
}
interface Author {
  label: string;              // "Autore 1", stabile fra analisi successive
  displayName?: string;       // solo in FULL
  identityHash: string;       // sha256 di email/login, mai l'indirizzo
  versions: number;
}
```

## 2. Snapshot (= versione)

```ts
interface Snapshot {
  id; documentId;
  index: number;              // posizione cronologica, il file corrente è l'ultimo
  versionId: string;          // "512", "513", … oppure "current"
  versionLabel: string;       // "1.0", "2.3"
  timestamp: string;          // data della versione
  authorLabel: string | null; // chi l'ha salvata (etichetta pseudonima)
  isCurrent: boolean;
  sizeBytes: number | null;
  wordCount; characterCount; paragraphCount;
  text: string | null;        // null in METRICS_ONLY o UNAVAILABLE
  textHash: string;           // sha256 del testo normalizzato
  paragraphHashes: string[];  // diff strutturale anche senza testo
  headings: { level; text }[];
  extractionStatus: 'FULL' | 'UNAVAILABLE';
  extractionNotes: string[];
  sourceHash: string | null;  // sha256 dei byte del DOCX
  hash: string;               // integrità (esclude index, ricalcolato a ogni import)
}
```

## 3. SnapshotDiff

Invariato rispetto al brief: parole aggiunte/eliminate/sostituite, paragrafi
aggiunti/eliminati/modificati, `wordCountDelta`, `elapsedMs`,
`classification` (`ADDING`, `DELETING`, `REWRITING`, `MIXED`, `UNCHANGED`,
`UNKNOWN` quando una delle due versioni non è leggibile), blocchi
aggiunti/eliminati (estratti, solo in FULL), `basis` (`TEXT`,
`PARAGRAPH_HASHES`, `COUNTS_ONLY`).

## 4. Event log (operazioni di analisi)

```ts
type EventType = 'ANALYSIS_START' | 'VERSIONS_LISTED' | 'VERSION_FETCHED'
               | 'VERSION_FETCH_FAILED' | 'ANALYSIS_END';
interface TrackingEvent { id; documentId; runId; seq; type; timestamp; payload; previousHash; hash }
```

Registra cosa ha fatto Evidentia (non lo studente). È la catena SHA-256 che
protegge il dataset da alterazioni accidentali.

## 5. Session (derivata)

```ts
interface Session {
  id; documentId; index;
  startedAt; endedAt; spanMs;      // dalla prima all'ultima versione del gruppo
  versionCount; fromSnapshotIndex; toSnapshotIndex;
  wordCountStart; wordCountEnd;
  authorLabels: string[];
}
```

Gruppo di versioni a meno di `sessionGapMinutes` l'una dall'altra. Nessun
tempo attivo/inattivo: non osservabile.

## 6. Metrics (derivate)

- `document`: `finalWordCount`, `finalCharacterCount`, `finalParagraphCount`
- `versions`: `numberOfVersions`, `numberOfReadableVersions`, `firstVersionAt`,
  `lastVersionAt`, `totalSpanMs`, `medianIntervalMs`, `numberOfAuthors`,
  `versionsPerAuthor`, `firstVersionWordCount`
- `sessions`: `numberOfSessions`, `averageSessionSpanMs`, `longestSessionSpanMs`,
  `singleVersionSessions`
- `writing`: `estimatedWordsAdded`, `estimatedWordsDeleted`,
  `estimatedWordsRewritten`, `netWordGrowth`
- `insertions` (sostituisce le metriche di paste): `numberOfLargeInsertions`,
  `largestInsertionWords`, `totalWordsInLargeInsertions`, `thresholdWords`
- `revision`: `numberOfRevisionEvents`, `paragraphsRewritten`,
  `revisionIntensity` (= parole sostituite / parole finali),
  `proportionOfVersionsAfterFirstCompleteDraft` (quota di versioni dopo la
  prima che raggiunge il 90% del conteggio finale)
- `timeline`: `largestWordIncreaseBetweenVersions`,
  `shortestIntervalWithLargeIncreaseMs`, `longestGapBetweenVersionsMs`

## 6b. TimeEstimates (derivate, stime dichiarate)

```ts
interface TimeEstimates {
  leadInMinutes; minSessionForRateMinutes; minIntervalForRateMinutes;  // parametri
  calendarSpanMs; daysWithVersions;
  observedTotalMs;          // somma degli archi delle sessioni (prima → ultima versione)
  estimatedActiveTotalMs;   // observedTotalMs + margine di avvio per sessione
  sessions: SessionTimeEstimate[];   // observedSpanMs, leadInMs, estimatedActiveMs,
                                     // netWords (incluse le modifiche portate dalla prima
                                     // versione della sessione; esclusa la prima versione
                                     // in assoluto), wordsAdded/Deleted, wordsPerHourNet/Added
  days: DayActivity[];               // per giornata locale: sessioni, versioni, tempo, parole
  intervals: IntervalRate[];         // per coppia di versioni consecutive; parole/ora solo
                                     // dentro una sessione e con intervallo ≥ 5 min
  wordsPerHourNet; wordsPerHourAdded; medianSessionWordsPerHourNet; maxIntervalRate;
  caveats: string[];                 // sempre presenti: il tempo attivo non è osservato
}
```

Il margine di avvio (`sessionLeadInMinutes`, default 5) è limitato dal tempo
trascorso dalla versione precedente o dalla creazione del file. Le parole
per ora sono rapporti fra conteggi e tempo stimato: mai velocità di
digitazione.

## 6c. ContentEvolution (derivata)

```ts
interface ContentEvolution {
  basis: 'TEXT' | 'PARAGRAPH_HASHES' | 'NONE';   // METRICS_ONLY → solo hash
  hasSections;                                    // titoli riconosciuti nel testo finale
  sections: SectionSummary[];       // parole finali, prima comparsa, sessioni che l'hanno
                                    // modificata, parole a fine di ogni sessione
  phases: PhaseContentChange[];     // una per sessione: SectionChange[] (parole prima → dopo,
                                    // +/−, paragrafi +/−/mod), paragrafi finali comparsi o
                                    // rivisti, paragrafi eliminati, riassunto neutro
  versionChanges: VersionContentChange[];   // stesso dettaglio per coppie consecutive
  finalParagraphs: ParagraphProvenance[];   // per ogni paragrafo finale: sezione, parole,
                                            // prima comparsa (versione/sessione), ultima
                                            // modifica, numero di varianti, incipit
  abandoned: AbandonedParagraph[];  // eliminati e mai ripresi (max 30, i più lunghi)
  notes: string[];
}
```

Un paragrafo è attribuito alla sezione del titolo che lo precede. Due
paragrafi sono varianti se la sottosequenza comune di parole copre almeno il
50% della loro lunghezza (misura che rispetta l'ordine, con prefiltro
Jaccard). Sono descritti cambiamenti, mai cause.

## 6d. Glossary

`src/analysis/glossary.ts` è la sorgente unica delle definizioni di ogni
valore: `{ id, label, kind: 'osservato' | 'derivato' | 'stima', meaning,
method?, use? }`, raggruppate in `GLOSSARY_GROUPS`. Alimenta i tooltip della
Process View e del report HTML, il glossario e le legende del documento per
LLM, `glossary.json` nello ZIP e il campo `glossary` degli input JSON.

## 7. ObservationCoverage

```ts
interface ObservationCoverage {
  source: 'SHAREPOINT_VERSION_HISTORY' | 'GOOGLE_DRIVE_REVISIONS';
  firstVersionAt; lastVersionAt;
  versionsOnServer; versionsStored; versionsReadable; lastAnalyzedAt;
  knownGaps: ObservationGap[];          // BEFORE_FIRST_VERSION, LONG_INTERVAL,
                                        // VERSION_UNAVAILABLE, NO_VERSION_HISTORY
  extractionFailures: ExtractionFailure[];
  continuityWarnings: ContinuityWarning[];  // DUPLICATE_CONTENT, NON_MONOTONIC_TIMESTAMP,
                                            // HASH_CHAIN_BREAK, PARTIAL_IMPORT
  limitations: string[];                // limiti strutturali, sempre presenti, specifici del provider
}
```

## 8. Timeline (derivata)

Voci: `VERSION` (wordCount, versionLabel, author), `SESSION_START`,
`SESSION_END`, `LARGE_INSERTION` (words = delta), `REVISION`, `GAP`.
`MajorTransition` include etichette di versione e autore.

## 9. Export ZIP

```text
manifest.json    { product, exportVersion, exportedAt, extensionVersion, documentId,
                   documentName, source, privacyMode, counts, integrity, files[] }
document.json    AnalyzedDocument
versions.json    Snapshot[] (testo solo in FULL)
diffs.json       SnapshotDiff[]
sessions.json    Session[]
events.jsonl     un evento per riga, hash chain
metrics.json     Metrics
timeline.json    TimelineEntry[]
observation.json ObservationCoverage
time-estimates.json     TimeEstimates
content-evolution.json  ContentEvolution
glossary.json    GlossaryEntry[]
final.txt        testo della versione corrente
llm/analysis-input.json, llm/analysis-input-compact.json (schemaVersion 2.2:
                 + timeEstimates, contentEvolution, glossary; il compatto omette
                 intervals e accorcia gli estratti),
llm/analysis-prompt.md
llm/analysis-for-llm.docx, llm/analysis-for-llm.md   un solo file per Copilot/LLM:
                 istruzioni + documento + copertura + versioni (con intervallo,
                 parole/ora e sezioni cambiate) + sessioni + transizioni +
                 inserimenti + revisioni + tempo stimato (per sessione e per
                 giornata) + evoluzione dei contenuti per fase + mappa del testo
                 finale + testo eliminato + metriche + testo finale
                 (stesso modello a blocchi, due renderer: src/export/llm-document.ts)
report/process-report.html
README.txt
```

## 10. Storage

IndexedDB `evidentia` v2: `documents` (id), `events` (id; indici
`documentId`, `[documentId+seq]`), `snapshots` (id; `[documentId+index]`,
`[documentId+versionId]`), `diffs` (id; `[documentId+toIndex]`). Gli
snapshot e i diff di un documento vengono sostituiti in blocco a ogni
import. `chrome.storage.local`: solo `settings`.

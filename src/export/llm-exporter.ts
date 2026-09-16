/**
 * LLM analysis input (full and compact) and the analysis prompt.
 * Observation only: the schema has no room for suspicion scores.
 */
import type { Analysis } from '@/analysis';
import { documentProvider, providerName, sourceIdOf, sourceLabel, type ContentEvolution, type DocumentDataset, type ObservationCoverage, type Snapshot, type TimeEstimates, type TimelineEntry, type VersionSourceId } from '@/models';
import { excerpt } from '@/utils/text';
import { formatMinutes, parseIso } from '@/utils/time';
import { GLOSSARY, type GlossaryEntry } from '@/analysis/glossary';

export const LLM_SCHEMA_VERSION = '2.2';

const DISCLAIMER = {
  aiDetection: false,
  misconductDetection: false,
  description:
    'Data derived locally by the Evidentia browser extension from the version history kept by the server for one document (SharePoint/OneDrive for a Word document, Google Drive revisions for a Google Docs document). It cannot establish authorship or AI use. A large increase between two versions is only a large increase: its origin is not observed. Gaps in observation are listed explicitly and must not be filled with assumptions. Authors are pseudonymous labels assigned by the extension.',
};

export interface LlmVersion {
  index: number;
  version: string;
  time: string;
  author: string | null;
  wordCount: number | null;
  paragraphCount: number | null;
  status: string;
  isCurrent: boolean;
  headings?: string[];
}

export interface LlmRevisionPattern {
  fromVersion: string;
  toVersion: string;
  time: string;
  classification: string;
  wordsAdded: number;
  wordsDeleted: number;
  wordsReplaced: number;
  paragraphsModified: number;
  paragraphsAdded: number;
  paragraphsDeleted: number;
  deletedExcerpts?: string[];
  addedExcerpts?: string[];
}

export interface LlmLargeInsertion {
  fromVersion: string;
  toVersion: string;
  time: string;
  elapsedMinutes: number;
  wordsBefore: number;
  wordsAfter: number;
  netChange: number;
  addedParagraphs: number;
  author: string | null;
  addedExcerpts?: string[];
}

export interface LlmAnalysisInput {
  schemaVersion: string;
  product: 'Evidentia';
  purpose: 'learning-process-analysis';
  source: VersionSourceId;
  generatedAt: string;
  disclaimer: typeof DISCLAIMER;
  document: { name: string; host: string; documentId: string; privacyMode: string; extensionVersion: string; timeCreated: string | null; timeLastModified: string | null; authors: Array<{ label: string; versions: number }>; student: DocumentDataset['document']['student'] };
  observationCoverage: ObservationCoverage;
  finalDocument: { wordCount: number; characterCount: number; paragraphCount: number; headings: Snapshot['headings']; text: string | null; textAvailability: string };
  versions: LlmVersion[];
  sessions: Analysis['sessions'];
  metrics: Analysis['metrics'];
  timeline: TimelineEntry[];
  majorTransitions: Analysis['majorTransitions'];
  largeInsertions: LlmLargeInsertion[];
  revisionPatterns: LlmRevisionPattern[];
  observationGaps: ObservationCoverage['knownGaps'];
  /** Modelled from timestamps; every value is an estimate (see caveats). */
  timeEstimates: TimeEstimates;
  /** Which parts of the text were developed in which phase. */
  contentEvolution: ContentEvolution;
  /** Definition of every value: meaning, method, how to read it, and whether observed/derived/estimate. */
  glossary: GlossaryEntry[];
  integrity: { eventHashChainValid: boolean; eventsChecked: number; note: string };
}

export function buildLlmInput(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): LlmAnalysisInput {
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const final = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE').at(-1) ?? null;
  const full = dataset.document.privacyMode === 'FULL';
  return {
    schemaVersion: LLM_SCHEMA_VERSION,
    product: 'Evidentia',
    purpose: 'learning-process-analysis',
    source: sourceIdOf(documentProvider(dataset.document)),
    generatedAt,
    disclaimer: DISCLAIMER,
    document: {
      name: dataset.document.name,
      host: dataset.document.host,
      documentId: dataset.document.id,
      privacyMode: dataset.document.privacyMode,
      extensionVersion: dataset.document.extensionVersion,
      timeCreated: dataset.document.timeCreated,
      timeLastModified: dataset.document.timeLastModified,
      authors: dataset.document.authors.map((a) => ({ label: a.label, versions: a.versions })),
      student: dataset.document.student ?? {},
    },
    observationCoverage: analysis.observation,
    finalDocument: { wordCount: final?.wordCount ?? 0, characterCount: final?.characterCount ?? 0, paragraphCount: final?.paragraphCount ?? 0, headings: final?.headings ?? [], text: final?.text ?? null, textAvailability: textAvailability(final, full) },
    versions: snapshots.map((s) => versionSummary(s, full)),
    sessions: analysis.sessions,
    metrics: analysis.metrics,
    timeline: analysis.timeline,
    majorTransitions: analysis.majorTransitions,
    largeInsertions: largeInsertions(dataset, analysis, full, 3, 400),
    revisionPatterns: revisionPatterns(dataset, full, 3),
    observationGaps: analysis.observation.knownGaps,
    timeEstimates: analysis.time,
    contentEvolution: analysis.content,
    glossary: GLOSSARY,
    integrity: { eventHashChainValid: analysis.chain.valid, eventsChecked: analysis.chain.checked, note: 'SHA-256 hash chain over the analysis event log. Detects accidental modification of the exported dataset; it is not a forensic guarantee.' },
  };
}

export interface LlmCompactInput {
  schemaVersion: string;
  product: 'Evidentia';
  purpose: 'learning-process-analysis';
  source: VersionSourceId;
  variant: 'compact';
  generatedAt: string;
  disclaimer: typeof DISCLAIMER;
  document: { name: string; privacyMode: string; timeCreated: string | null; authors: Array<{ label: string; versions: number }>; student: DocumentDataset['document']['student'] };
  observationCoverage: { firstVersionAt: string | null; lastVersionAt: string | null; versionsOnServer: number; versionsReadable: number; gapCount: number; extractionFailureCount: number; continuityWarningCount: number };
  finalDocument: { wordCount: number; paragraphCount: number; headings: string[]; text: string | null; textAvailability: string };
  versions: Array<{ version: string; time: string; author: string | null; wordCount: number | null; delta: number | null; status: string }>;
  sessions: Array<{ index: number; start: string; end: string; spanMinutes: number; versions: number; wordsStart: number | null; wordsEnd: number | null; authors: string[] }>;
  metrics: Analysis['metrics'];
  timeline: TimelineEntry[];
  majorTransitions: Analysis['majorTransitions'];
  largeInsertions: LlmLargeInsertion[];
  revisionPatterns: LlmRevisionPattern[];
  observationGaps: Array<{ type: string; from: string; to: string | null; durationMinutes: number | null; description: string }>;
  timeEstimates: Omit<TimeEstimates, 'intervals'>;
  contentEvolution: Omit<ContentEvolution, 'abandoned' | 'finalParagraphs'> & { finalParagraphs: Array<Pick<ContentEvolution['finalParagraphs'][number], 'position' | 'section' | 'words' | 'excerpt' | 'firstSeenVersion' | 'firstSeenSession' | 'lastChangedVersion' | 'lastChangedSession' | 'revisions'>>; abandoned: ContentEvolution['abandoned'] };
  limitations: string[];
  glossary: GlossaryEntry[];
}

export function buildCompactLlmInput(dataset: DocumentDataset, analysis: Analysis, generatedAt: string, options: { maxTextWords?: number } = {}): LlmCompactInput {
  const maxTextWords = options.maxTextWords ?? 4000;
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const final = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE').at(-1) ?? null;
  const full = dataset.document.privacyMode === 'FULL';
  const o = analysis.observation;
  let text = final?.text ?? null;
  let availability = textAvailability(final, full);
  if (text) {
    const words = text.split(/\s+/);
    if (words.length > maxTextWords) {
      text = words.slice(0, maxTextWords).join(' ') + ' […]';
      availability = `TRUNCATED to first ${maxTextWords} words (full text in analysis-input.json)`;
    }
  }
  let prevWords: number | null = null;
  const versions = snapshots.map((s) => {
    const wc = s.extractionStatus === 'UNAVAILABLE' ? null : s.wordCount;
    const delta = wc !== null && prevWords !== null ? wc - prevWords : null;
    if (wc !== null) prevWords = wc;
    return { version: s.versionLabel, time: s.timestamp, author: s.authorLabel, wordCount: wc, delta, status: s.extractionStatus };
  });
  return {
    schemaVersion: LLM_SCHEMA_VERSION,
    product: 'Evidentia',
    purpose: 'learning-process-analysis',
    source: sourceIdOf(documentProvider(dataset.document)),
    variant: 'compact',
    generatedAt,
    disclaimer: DISCLAIMER,
    document: { name: dataset.document.name, privacyMode: dataset.document.privacyMode, timeCreated: dataset.document.timeCreated, authors: dataset.document.authors.map((a) => ({ label: a.label, versions: a.versions })), student: dataset.document.student ?? {} },
    observationCoverage: { firstVersionAt: o.firstVersionAt, lastVersionAt: o.lastVersionAt, versionsOnServer: o.versionsOnServer, versionsReadable: o.versionsReadable, gapCount: o.knownGaps.length, extractionFailureCount: o.extractionFailures.length, continuityWarningCount: o.continuityWarnings.length },
    finalDocument: { wordCount: final?.wordCount ?? 0, paragraphCount: final?.paragraphCount ?? 0, headings: (final?.headings ?? []).map((h) => `${'#'.repeat(Math.max(1, Math.min(6, h.level)))} ${h.text}`).filter((h) => h.trim().length > 1), text, textAvailability: availability },
    versions,
    sessions: analysis.sessions.map((s) => ({ index: s.index + 1, start: s.startedAt, end: s.endedAt, spanMinutes: formatMinutes(s.spanMs), versions: s.versionCount, wordsStart: s.wordCountStart, wordsEnd: s.wordCountEnd, authors: s.authorLabels })),
    metrics: analysis.metrics,
    timeline: compactTimeline(analysis.timeline),
    majorTransitions: analysis.majorTransitions,
    largeInsertions: largeInsertions(dataset, analysis, full, 2, 200),
    revisionPatterns: revisionPatterns(dataset, full, 2, 160),
    observationGaps: o.knownGaps.map((g) => ({ type: g.type, from: g.from, to: g.to, durationMinutes: g.durationMs === null ? null : formatMinutes(g.durationMs), description: g.description })),
    timeEstimates: compactTime(analysis.time),
    contentEvolution: compactContent(analysis.content, full),
    limitations: [...o.limitations, ...dynamicLimitations(dataset, analysis)],
    glossary: GLOSSARY,
  };
}

function compactTime(t: TimeEstimates): LlmCompactInput['timeEstimates'] {
  const { intervals: _intervals, ...rest } = t;
  return rest;
}

function compactContent(c: ContentEvolution, full: boolean): LlmCompactInput['contentEvolution'] {
  return {
    ...c,
    finalParagraphs: c.finalParagraphs.map((p) => ({ position: p.position, section: p.section, words: p.words, excerpt: full && p.excerpt ? excerpt(p.excerpt, 80) : null, firstSeenVersion: p.firstSeenVersion, firstSeenSession: p.firstSeenSession, lastChangedVersion: p.lastChangedVersion, lastChangedSession: p.lastChangedSession, revisions: p.revisions })),
    abandoned: c.abandoned.slice(0, 10).map((a) => ({ ...a, excerpt: full && a.excerpt ? excerpt(a.excerpt, 120) : null })),
  };
}

function versionSummary(s: Snapshot, full: boolean): LlmVersion {
  const un = s.extractionStatus === 'UNAVAILABLE';
  return {
    index: s.index,
    version: s.versionLabel,
    time: s.timestamp,
    author: s.authorLabel,
    wordCount: un ? null : s.wordCount,
    paragraphCount: un ? null : s.paragraphCount,
    status: s.extractionStatus,
    isCurrent: s.isCurrent,
    ...(full && s.headings.length ? { headings: s.headings.map((h) => h.text) } : {}),
  };
}

function textAvailability(final: Snapshot | null, full: boolean): string {
  if (!final) return 'NO_VERSION: no readable version';
  if (!full) return 'NOT_INCLUDED: METRICS_ONLY privacy mode';
  return 'FULL';
}

function largeInsertions(dataset: DocumentDataset, analysis: Analysis, full: boolean, maxExcerpts: number, excerptLen: number): LlmLargeInsertion[] {
  const byId = new Map(dataset.snapshots.map((s) => [s.id, s]));
  const threshold = analysis.metrics.insertions.thresholdWords;
  return [...dataset.diffs]
    .filter((d) => d.wordCountDelta >= threshold)
    .sort((a, b) => a.toIndex - b.toIndex)
    .map((d) => {
      const from = byId.get(d.fromSnapshotId);
      const to = byId.get(d.toSnapshotId);
      return {
        fromVersion: from?.versionLabel ?? '',
        toVersion: to?.versionLabel ?? '',
        time: to?.timestamp ?? '',
        elapsedMinutes: Math.round(d.elapsedMs / 60000),
        wordsBefore: from?.wordCount ?? 0,
        wordsAfter: to?.wordCount ?? 0,
        netChange: d.wordCountDelta,
        addedParagraphs: d.paragraphsAdded,
        author: to?.authorLabel ?? null,
        ...(full ? { addedExcerpts: d.addedBlocks.slice(0, maxExcerpts).map((b) => excerpt(b.excerpt, excerptLen)) } : {}),
      };
    });
}

function revisionPatterns(dataset: DocumentDataset, full: boolean, maxExcerpts: number, excerptLen = 300): LlmRevisionPattern[] {
  const byId = new Map(dataset.snapshots.map((s) => [s.id, s]));
  return [...dataset.diffs]
    .filter((d) => d.classification !== 'UNCHANGED' && d.classification !== 'UNKNOWN')
    .filter((d) => d.classification !== 'ADDING' || d.paragraphsModified > 0)
    .sort((a, b) => a.toIndex - b.toIndex)
    .map((d) => ({
      fromVersion: byId.get(d.fromSnapshotId)?.versionLabel ?? '',
      toVersion: byId.get(d.toSnapshotId)?.versionLabel ?? '',
      time: byId.get(d.toSnapshotId)?.timestamp ?? '',
      classification: d.classification,
      wordsAdded: d.wordsAdded,
      wordsDeleted: d.wordsDeleted,
      wordsReplaced: d.wordsReplaced,
      paragraphsModified: d.paragraphsModified,
      paragraphsAdded: d.paragraphsAdded,
      paragraphsDeleted: d.paragraphsDeleted,
      ...(full ? { deletedExcerpts: d.deletedBlocks.slice(0, maxExcerpts).map((b) => excerpt(b.excerpt, excerptLen)), addedExcerpts: d.addedBlocks.slice(0, maxExcerpts).map((b) => excerpt(b.excerpt, excerptLen)) } : {}),
    }));
}

/** Keep the timeline readable: drop session markers and duplicate consecutive versions. */
export function compactTimeline(timeline: TimelineEntry[]): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  for (const entry of timeline) {
    if (entry.type === 'SESSION_END') continue;
    const prev = out[out.length - 1];
    if (prev && prev.type === 'VERSION' && entry.type === 'VERSION' && prev.wordCount === entry.wordCount && parseIso(entry.time) - parseIso(prev.time) < 60_000) continue;
    out.push(entry);
  }
  return out;
}

function dynamicLimitations(dataset: DocumentDataset, analysis: Analysis): string[] {
  const items: string[] = [];
  if (dataset.document.privacyMode === 'METRICS_ONLY') items.push('METRICS_ONLY mode: no document text was stored; only counts and hashes.');
  if (analysis.observation.extractionFailures.length > 0) items.push('Some versions could not be downloaded: diffs across those versions are computed on the nearest readable ones.');
  if (!analysis.chain.valid) items.push('The event hash chain does not verify: the dataset may have been modified after export.');
  return items;
}

export function buildAnalysisPrompt(dataset: DocumentDataset): string {
  return `# Evidentia — Prompt di analisi del processo di scrittura

Documento: ${dataset.document.name || '(senza titolo)'}
Fonte: ${sourceLabel(dataset.document)}
Modalità privacy: ${dataset.document.privacyMode}

Usa il file \`analysis-input-compact.json\` (o \`analysis-input.json\` per il dettaglio completo) come unico dato di partenza.

---

Analizza il processo di costruzione di questo elaborato.

I dati rappresentano esclusivamente le versioni del documento conservate da ${providerName(documentProvider(dataset.document))} e lette dal sistema Evidentia.

Non cercare di stabilire se lo studente abbia utilizzato intelligenza artificiale.

Non formulare accuse di cheating, misconduct o plagio.

Non interpretare automaticamente un grande aumento di testo fra due versioni come uso di AI o come testo incollato: fra una versione e l'altra non è osservato nulla.

Descrivi invece:

1. come si è sviluppato temporalmente il lavoro;
2. quali fasi di drafting e revisione sono osservabili;
3. quali cambiamenti significativi sono avvenuti;
4. quanto è documentato il processo;
5. quali parti del testo (sezioni, paragrafi) sono state sviluppate in ciascuna fase, e quali sono state riviste o abbandonate;
6. quanto tempo di lavoro è stimabile e con quale ritmo (parole per ora), ricordando che si tratta di stime derivate dai soli orari delle versioni;
7. eventuali aspetti del processo che meritano approfondimento;
8. eventuali limiti dei dati disponibili;
9. 3-5 domande che il docente potrebbe porre allo studente per comprendere meglio il processo di lavoro.

Distingui sempre chiaramente:

- fatti osservati;
- inferenze;
- informazioni non disponibili.

---

Note sul formato dei dati:

- \`versions\` elenca le versioni in ordine cronologico con data, autore (etichetta pseudonima), conteggio parole e variazione rispetto alla precedente.
- \`observationCoverage\`, \`observationGaps\` e \`limitations\` elencano ciò che NON è osservabile: trattali come limiti, non come indizi.
- \`sessions\` sono raggruppamenti di versioni vicine nel tempo: indicano quando il documento è stato salvato, non quanto tempo è stato dedicato.
- \`largeInsertions\` e \`majorTransitions\` sono i passaggi fra versioni con le variazioni più grandi; \`revisionPatterns\` descrivono la forma dei cambiamenti (ADDING, DELETING, REWRITING, MIXED) senza attribuire intenzioni.
- \`timeEstimates\` contiene tempo osservato (somma degli archi delle sessioni), tempo attivo stimato (con un margine di avvio per sessione) e parole per ora: sono stime dichiarate, con i loro \`caveats\`; non trasformarle in misure di impegno o di velocità di scrittura.
- \`contentEvolution\` descrive quali sezioni e paragrafi sono comparsi, cambiati o scomparsi in ogni fase (\`phases\`), la provenienza di ogni paragrafo del testo finale (\`finalParagraphs\`: prima comparsa, ultima modifica, numero di varianti) e i paragrafi eliminati (\`abandoned\`).
- \`glossary\` definisce ogni valore (significato, metodo di calcolo, come leggerlo) e lo etichetta come osservato, derivato o stima: usa queste definizioni e non attribuire ai valori altri significati.
- Le metriche sono deterministiche e non contengono punteggi di sospetto; non crearne.
- Rispondi nella lingua del documento, se riconoscibile, altrimenti in italiano.
`;
}

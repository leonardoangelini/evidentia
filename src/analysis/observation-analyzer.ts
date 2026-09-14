/**
 * Observation coverage for version-history analysis: what the versions can
 * and cannot show, stated explicitly. Gaps are facts about the data, never
 * claims about the student.
 */
import { documentProvider, providerName, sourceIdOf, type ContinuityWarning, type DocumentDataset, type DocumentProvider, type ExtractionFailure, type ObservationCoverage, type ObservationGap } from '@/models';
import { diffMs, parseIso } from '@/utils/time';
import type { ChainVerification } from '@/integrity/event-log';

export interface ObservationOptions {
  longIntervalMs: number;
  chainVerification?: ChainVerification | null;
}

/** Limits of version-history analysis, by server. Always stated in reports. */
export function structuralLimitations(provider: DocumentProvider): string[] {
  const server = providerName(provider);
  const common = [
    `L'analisi si basa esclusivamente sulle versioni conservate da ${server}: ciò che accade fra una versione e la successiva non è osservato.`,
    'Non sono osservabili digitazione, incolla, tempo attivo o provenienza del testo: un grande aumento fra due versioni è solo un grande aumento.',
    `L'autore di una versione è chi l'ha salvata secondo ${server}, non necessariamente chi ha scritto il testo.`,
    'La cronologia può essere stata ridotta da limiti di conservazione o cancellazioni: le versioni mancanti non sono rilevabili.',
  ];
  return provider === 'GOOGLE_DOCS'
    ? [
        ...common,
        'Le revisioni sono quelle esposte dall\'API di Google Drive: più rade della cronologia dettagliata mostrata da Google Docs, e Google può accorpare nel tempo quelle non contrassegnate "conserva per sempre".',
        'Modifiche fatte da app mobili, offline o tramite importazione compaiono come revisioni indistinguibili da quelle dell\'editor web.',
      ]
    : [
        ...common,
        'Le versioni vengono create dal salvataggio automatico di Word con cadenza variabile; intervalli lunghi non implicano assenza di lavoro.',
        'Modifiche fatte con Word desktop o altri strumenti sincronizzati compaiono come versioni indistinguibili da quelle di Word Online.',
      ];
}


export function analyzeObservation(dataset: DocumentDataset, options: ObservationOptions): ObservationCoverage {
  const provider = documentProvider(dataset.document);
  const events = [...dataset.events].sort((a, b) => a.seq - b.seq);
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const readable = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE');
  const gaps: ObservationGap[] = [];
  const failures: ExtractionFailure[] = [];
  const warnings: ContinuityWarning[] = [];

  const lastListed = [...events].reverse().find((e) => e.type === 'VERSIONS_LISTED');
  const versionsOnServer = lastListed && lastListed.type === 'VERSIONS_LISTED' ? lastListed.payload.includingCurrent : snapshots.length;
  const lastRun = [...events].reverse().find((e) => e.type === 'ANALYSIS_END' || e.type === 'ANALYSIS_START');

  const first = readable[0] ?? null;
  const final = readable[readable.length - 1] ?? null;
  if (first && first.wordCount > 0) {
    const fraction = final && final.wordCount > 0 ? Math.round((first.wordCount / final.wordCount) * 100) : null;
    gaps.push({
      type: 'BEFORE_FIRST_VERSION',
      from: dataset.document.timeCreated ?? first.timestamp,
      to: first.timestamp,
      durationMs: dataset.document.timeCreated ? Math.max(0, diffMs(dataset.document.timeCreated, first.timestamp)) : null,
      description: `La prima versione disponibile contiene già ${first.wordCount} parole${fraction !== null ? ` (${fraction}% del testo finale)` : ''}: la sua stesura non è osservabile.`,
      evidence: { firstVersionWords: first.wordCount, finalWords: final?.wordCount ?? null, firstVersionLabel: first.versionLabel },
    });
  }
  for (let i = 1; i < snapshots.length; i++) {
    const a = snapshots[i - 1] as (typeof snapshots)[number];
    const b = snapshots[i] as (typeof snapshots)[number];
    const gap = diffMs(a.timestamp, b.timestamp);
    if (gap >= options.longIntervalMs) {
      gaps.push({
        type: 'LONG_INTERVAL',
        from: a.timestamp,
        to: b.timestamp,
        durationMs: gap,
        description: `Nessuna versione per ${Math.round(gap / 3_600_000)} ore fra la versione ${a.versionLabel} e la ${b.versionLabel}.`,
        evidence: { fromVersion: a.versionLabel, toVersion: b.versionLabel, wordCountDelta: b.wordCount - a.wordCount },
      });
    }
    if (gap < -1000) warnings.push({ at: b.timestamp, type: 'NON_MONOTONIC_TIMESTAMP', description: `La versione ${b.versionLabel} ha una data precedente alla versione ${a.versionLabel}.` });
    if (a.textHash && a.textHash === b.textHash) warnings.push({ at: b.timestamp, type: 'DUPLICATE_CONTENT', description: `La versione ${b.versionLabel} ha lo stesso testo della ${a.versionLabel} (salvataggio senza modifiche al testo, o solo formattazione).` });
  }
  for (const s of snapshots) {
    if (s.extractionStatus === 'UNAVAILABLE') {
      failures.push({ at: s.timestamp, versionLabel: s.versionLabel, reason: s.extractionNotes.join('; ') || 'versione non scaricabile', snapshotId: s.id });
      gaps.push({ type: 'VERSION_UNAVAILABLE', from: s.timestamp, to: null, durationMs: null, description: `La versione ${s.versionLabel} esiste sul server ma non è stata letta: ${s.extractionNotes.join('; ') || 'errore di download'}.` });
    }
  }
  for (const e of events) {
    if (e.type === 'VERSION_FETCH_FAILED' && !snapshots.some((s) => s.versionId === e.payload.versionId)) {
      failures.push({ at: e.payload.created, versionLabel: e.payload.versionLabel, reason: e.payload.reason });
    }
  }
  if (snapshots.length <= 1) {
    gaps.push({
      type: 'NO_VERSION_HISTORY',
      from: snapshots[0]?.timestamp ?? dataset.document.lastAnalyzedAt,
      to: null,
      durationMs: null,
      description: `${providerName(provider)} non conserva versioni precedenti di questo documento: è osservabile solo lo stato finale.`,
    });
  }
  const lastEnd = [...events].reverse().find((e) => e.type === 'ANALYSIS_END');
  const lastStart = [...events].reverse().find((e) => e.type === 'ANALYSIS_START');
  if (lastStart && (!lastEnd || lastEnd.seq < lastStart.seq)) warnings.push({ at: lastStart.timestamp, type: 'PARTIAL_IMPORT', description: 'L\'ultima analisi non è stata completata.' });
  else if (lastEnd && lastEnd.type === 'ANALYSIS_END' && lastEnd.payload.failed > 0) warnings.push({ at: lastEnd.timestamp, type: 'PARTIAL_IMPORT', description: `${lastEnd.payload.failed} versioni non sono state scaricate nell'ultima analisi.` });
  if (options.chainVerification && !options.chainVerification.valid) {
    warnings.push({ at: events[0]?.timestamp ?? dataset.document.lastAnalyzedAt, type: 'HASH_CHAIN_BREAK', description: `Hash chain non valida dall'evento ${options.chainVerification.firstBrokenSeq}: ${options.chainVerification.reason}.` });
  }

  return {
    source: sourceIdOf(provider),
    firstVersionAt: snapshots[0]?.timestamp ?? null,
    lastVersionAt: snapshots.at(-1)?.timestamp ?? null,
    versionsOnServer,
    versionsStored: snapshots.length,
    versionsReadable: readable.length,
    lastAnalyzedAt: lastRun?.timestamp ?? null,
    knownGaps: gaps.sort((a, b) => parseIso(a.from) - parseIso(b.from)),
    extractionFailures: failures.sort((a, b) => parseIso(a.at) - parseIso(b.at)),
    continuityWarnings: warnings.sort((a, b) => parseIso(a.at) - parseIso(b.at)),
    limitations: structuralLimitations(provider),
  };
}

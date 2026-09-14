/**
 * Time and pace estimates from version timestamps.
 *
 * What the timestamps show directly is the span of each session (first to
 * last version). Work done before the first version of a session is not
 * visible, so a fixed lead-in allowance is added per session; the result is
 * an estimate and is always labelled as such. Rates (words per hour) are
 * ratios between word counts and estimated time: they say nothing about how
 * the words were produced.
 */
import type { DayActivity, DocumentDataset, IntervalRate, Session, SessionTimeEstimate, Snapshot, SnapshotDiff, TimeEstimates } from '@/models';
import { diffMs, parseIso } from '@/utils/time';

export interface TimeEstimateOptions {
  leadInMs: number;
  /** Sessions shorter than this (estimated) get no rate. */
  minSessionForRateMs?: number;
  /** Intervals between versions shorter than this get no rate. */
  minIntervalForRateMs?: number;
}

const HOUR = 3_600_000;

export const TIME_CAVEATS = [
  'Il tempo attivo non è osservato. La stima somma, per ogni sessione, l\'arco fra la prima e l\'ultima versione più un margine fisso di avvio: è un ordine di grandezza, non una misura.',
  'Il documento può essere rimasto aperto senza modifiche, e il lavoro svolto fuori dal documento (lettura, appunti, altri file, strumenti esterni) non compare.',
  'Una sessione con una sola versione ha arco osservato pari a zero: conta solo il margine di avvio, limitato dal tempo trascorso dalla versione precedente o dalla creazione del file.',
  'Le parole per ora sono rapporti fra variazioni di conteggio e tempo stimato: non descrivono la velocità di digitazione né la provenienza del testo.',
  'Il contenuto della prima versione disponibile non è attribuito ad alcuna sessione: la sua stesura precede l\'osservazione.',
];

export function estimateTime(dataset: DocumentDataset, sessions: Session[], options: TimeEstimateOptions): TimeEstimates {
  const minSession = options.minSessionForRateMs ?? 10 * 60_000;
  const minInterval = options.minIntervalForRateMs ?? 5 * 60_000;
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const diffs = [...dataset.diffs].sort((a, b) => a.toIndex - b.toIndex);
  const diffByTo = new Map(diffs.map((d) => [d.toIndex, d]));
  const readable = snapshots.filter((s) => s.extractionStatus !== 'UNAVAILABLE');
  const sessionOf = (index: number): number => sessions.find((s) => index >= s.fromSnapshotIndex && index <= s.toSnapshotIndex)?.index ?? -1;

  const sessionEstimates: SessionTimeEstimate[] = sessions.map((s, i) => {
    const prevSnapshot = snapshots.filter((x) => x.index < s.fromSnapshotIndex).at(-1) ?? null;
    const gapBefore = prevSnapshot ? diffMs(prevSnapshot.timestamp, s.startedAt) : dataset.document.timeCreated ? diffMs(dataset.document.timeCreated, s.startedAt) : options.leadInMs;
    const leadInMs = Math.max(0, Math.min(options.leadInMs, gapBefore));
    const estimatedActiveMs = s.spanMs + leadInMs;
    const prevReadable = readable.filter((x) => x.index < s.fromSnapshotIndex).at(-1) ?? null;
    const includesFirst = i > 0 && prevReadable !== null;
    const baseline = includesFirst ? (prevReadable as Snapshot).wordCount : s.wordCountStart;
    const netWords = s.wordCountEnd !== null && baseline !== null ? s.wordCountEnd - baseline : 0;
    const firstAttributed = includesFirst ? s.fromSnapshotIndex : s.fromSnapshotIndex + 1;
    const inSession = diffs.filter((d) => d.toIndex >= firstAttributed && d.toIndex <= s.toSnapshotIndex);
    const wordsAdded = sum(inSession.map((d) => d.wordsAdded));
    const wordsDeleted = sum(inSession.map((d) => d.wordsDeleted));
    const rateOk = estimatedActiveMs >= minSession;
    return {
      sessionIndex: s.index,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      versionCount: s.versionCount,
      observedSpanMs: s.spanMs,
      leadInMs,
      estimatedActiveMs,
      netWords,
      wordsAdded,
      wordsDeleted,
      wordsPerHourNet: rateOk ? perHour(netWords, estimatedActiveMs) : null,
      wordsPerHourAdded: rateOk ? perHour(wordsAdded, estimatedActiveMs) : null,
      includesFirstVersionContent: includesFirst,
      authorLabels: s.authorLabels,
    };
  });

  const days = groupByDay(sessionEstimates, sessions);

  const intervals: IntervalRate[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const from = snapshots[i - 1] as Snapshot;
    const to = snapshots[i] as Snapshot;
    if (from.extractionStatus === 'UNAVAILABLE' || to.extractionStatus === 'UNAVAILABLE') continue;
    const d = diffByTo.get(to.index) as SnapshotDiff | undefined;
    const elapsedMs = Math.max(0, diffMs(from.timestamp, to.timestamp));
    const withinSession = sessionOf(from.index) === sessionOf(to.index);
    const netWords = to.wordCount - from.wordCount;
    intervals.push({
      fromIndex: from.index,
      toIndex: to.index,
      fromVersion: from.versionLabel,
      toVersion: to.versionLabel,
      elapsedMs,
      netWords,
      wordsAdded: d?.wordsAdded ?? Math.max(0, netWords),
      wordsDeleted: d?.wordsDeleted ?? Math.max(0, -netWords),
      withinSession,
      wordsPerHourNet: withinSession && elapsedMs >= minInterval ? perHour(netWords, elapsedMs) : null,
    });
  }

  const observedTotalMs = sum(sessions.map((s) => s.spanMs));
  const estimatedActiveTotalMs = sum(sessionEstimates.map((s) => s.estimatedActiveMs));
  const first = readable[0] ?? null;
  const final = readable.at(-1) ?? null;
  const netGrowth = first && final ? final.wordCount - first.wordCount : 0;
  const totalAdded = sum(diffs.map((d) => d.wordsAdded));
  const totalOk = estimatedActiveTotalMs >= minSession;
  const sessionRates = sessionEstimates.map((s) => s.wordsPerHourNet).filter((r): r is number => r !== null);
  const rated = intervals.filter((x) => x.wordsPerHourNet !== null);
  const maxInterval = rated.length ? rated.reduce((a, b) => ((b.wordsPerHourNet as number) > (a.wordsPerHourNet as number) ? b : a)) : null;

  const caveats = [...TIME_CAVEATS];
  if (sessions.some((s) => s.versionCount === 1)) caveats.push(`${sessions.filter((s) => s.versionCount === 1).length} sessioni hanno una sola versione: per queste il tempo stimato è il solo margine di avvio.`);
  if (readable.length < snapshots.length) caveats.push('Alcune versioni non sono leggibili: le parole attribuite agli intervalli che le attraversano derivano dai soli conteggi.');

  return {
    leadInMinutes: Math.round(options.leadInMs / 60_000),
    minSessionForRateMinutes: Math.round(minSession / 60_000),
    minIntervalForRateMinutes: Math.round(minInterval / 60_000),
    calendarSpanMs: snapshots.length > 1 ? Math.max(0, diffMs((snapshots[0] as Snapshot).timestamp, (snapshots.at(-1) as Snapshot).timestamp)) : 0,
    daysWithVersions: new Set(snapshots.map((s) => localDay(s.timestamp))).size,
    observedTotalMs,
    estimatedActiveTotalMs,
    sessions: sessionEstimates,
    days,
    intervals,
    wordsPerHourNet: totalOk ? perHour(netGrowth, estimatedActiveTotalMs) : null,
    wordsPerHourAdded: totalOk ? perHour(totalAdded, estimatedActiveTotalMs) : null,
    medianSessionWordsPerHourNet: sessionRates.length ? median(sessionRates) : null,
    maxIntervalRate: maxInterval ? { fromVersion: maxInterval.fromVersion, toVersion: maxInterval.toVersion, elapsedMs: maxInterval.elapsedMs, netWords: maxInterval.netWords, wordsPerHourNet: maxInterval.wordsPerHourNet as number } : null,
    caveats,
  };
}

function groupByDay(estimates: SessionTimeEstimate[], sessions: Session[]): DayActivity[] {
  const map = new Map<string, DayActivity>();
  for (const e of estimates) {
    const date = localDay(e.startedAt);
    const day = map.get(date) ?? { date, sessions: 0, versions: 0, estimatedActiveMs: 0, netWords: 0, wordsAdded: 0, wordsDeleted: 0, authorLabels: [] };
    day.sessions += 1;
    day.versions += e.versionCount;
    day.estimatedActiveMs += e.estimatedActiveMs;
    day.netWords += e.netWords;
    day.wordsAdded += e.wordsAdded;
    day.wordsDeleted += e.wordsDeleted;
    for (const a of sessions[e.sessionIndex]?.authorLabels ?? []) if (!day.authorLabels.includes(a)) day.authorLabels.push(a);
    map.set(date, day);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Local calendar day of an ISO timestamp, YYYY-MM-DD. */
export function localDay(iso: string): string {
  const d = new Date(parseIso(iso));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function perHour(words: number, ms: number): number {
  return ms > 0 ? Math.round(words / (ms / HOUR)) : 0;
}
function sum(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : Math.round(((s[mid - 1] as number) + (s[mid] as number)) / 2);
}

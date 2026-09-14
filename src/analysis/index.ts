/** One call that derives everything analysis-related from a dataset. */
import type { ContentEvolution, DocumentDataset, MajorTransition, Metrics, ObservationCoverage, Session, Settings, TimeEstimates, TimelineEntry } from '@/models';
import { DEFAULT_SETTINGS } from '@/models';
import { deriveSessions } from '@/analysis/session-tracker';
import { verifyChain, type ChainVerification } from '@/integrity/event-log';
import { computeMetrics } from './metrics-engine';
import { buildTimeline, computeMajorTransitions } from './timeline-builder';
import { analyzeObservation } from './observation-analyzer';
import { estimateTime } from './time-estimator';
import { analyzeContentEvolution } from './content-evolution';

export interface Analysis {
  sessions: Session[];
  metrics: Metrics;
  timeline: TimelineEntry[];
  observation: ObservationCoverage;
  majorTransitions: MajorTransition[];
  chain: ChainVerification;
  /** Estimated time and pace: modelled from timestamps, always labelled as estimates. */
  time: TimeEstimates;
  /** Which parts of the text were developed in which phase. */
  content: ContentEvolution;
  /** Thresholds the analysis was computed with (reported, so numbers are reproducible). */
  options: { sessionGapMinutes: number; largeInsertionWords: number; longIntervalHours: number; sessionLeadInMinutes: number };
}

export async function analyzeDataset(dataset: DocumentDataset, settings: Settings = DEFAULT_SETTINGS): Promise<Analysis> {
  const chain = await verifyChain([...dataset.events].sort((a, b) => a.seq - b.seq));
  const sessions = deriveSessions(dataset.snapshots, { gapMs: settings.sessionGapMinutes * 60_000 });
  const observation = analyzeObservation(dataset, { longIntervalMs: settings.longIntervalHours * 3_600_000, chainVerification: chain });
  const metrics = computeMetrics(dataset, sessions, { largeInsertionWords: settings.largeInsertionWords });
  const timeline = buildTimeline(dataset, sessions, observation.knownGaps, { largeInsertionWords: settings.largeInsertionWords });
  const majorTransitions = computeMajorTransitions(dataset);
  const time = estimateTime(dataset, sessions, { leadInMs: settings.sessionLeadInMinutes * 60_000 });
  const content = analyzeContentEvolution(dataset, sessions);
  return { sessions, metrics, timeline, observation, majorTransitions, chain, time, content, options: { sessionGapMinutes: settings.sessionGapMinutes, largeInsertionWords: settings.largeInsertionWords, longIntervalHours: settings.longIntervalHours, sessionLeadInMinutes: settings.sessionLeadInMinutes } };
}

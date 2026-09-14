import { analyzeDataset } from '@/analysis';
import { estimateTime, localDay } from '@/analysis/time-estimator';
import { deriveSessions } from '@/analysis/session-tracker';
import { buildCaseA, buildCaseD } from '@/demo/cases';
import { DEFAULT_SETTINGS } from '@/models';

const MIN = 60_000;

describe('time estimates', () => {
  it('sums session spans, adds a bounded lead-in and reports words per hour for case A', async () => {
    const ds = await buildCaseA();
    const sessions = deriveSessions(ds.snapshots, { gapMs: 30 * MIN });
    const t = estimateTime(ds, sessions, { leadInMs: 5 * MIN });
    expect(t.sessions).toHaveLength(3);
    expect(t.observedTotalMs).toBe(sessions.reduce((n, s) => n + s.spanMs, 0));
    // First session: the document was created 2 minutes before the first version, so the lead-in is capped at 2 min.
    expect(t.sessions[0]?.leadInMs).toBe(2 * MIN);
    expect(t.sessions[1]?.leadInMs).toBe(5 * MIN);
    expect(t.estimatedActiveTotalMs).toBe(t.observedTotalMs + 12 * MIN);
    expect(t.sessions[0]?.includesFirstVersionContent).toBe(false);
    expect(t.sessions[1]?.includesFirstVersionContent).toBe(true);
    // Net words of later sessions include the changes carried by their first version.
    const s1 = sessions[1]!;
    const prev = ds.snapshots.find((s) => s.index === s1.fromSnapshotIndex - 1)!;
    expect(t.sessions[1]?.netWords).toBe((s1.wordCountEnd as number) - prev.wordCount);
    expect(t.wordsPerHourNet).toBeGreaterThan(0);
    expect(t.daysWithVersions).toBe(3);
    expect(t.days.map((d) => d.versions).reduce((a, b) => a + b, 0)).toBe(ds.snapshots.length);
    expect(t.intervals.filter((x) => x.wordsPerHourNet !== null).every((x) => x.withinSession && x.elapsedMs >= 5 * MIN)).toBe(true);
    expect(t.caveats.length).toBeGreaterThanOrEqual(5);
  });
  it('gives no rate to sessions that are too short and none across long gaps (case D)', async () => {
    const ds = await buildCaseD();
    const { time } = await analyzeDataset(ds, DEFAULT_SETTINGS);
    expect(time.sessions[0]?.observedSpanMs).toBe(0);
    expect(time.sessions[0]?.wordsPerHourNet).toBeNull();
    expect(time.sessions[1]?.wordsPerHourNet).toBeNull();
    expect(time.intervals.filter((x) => !x.withinSession).every((x) => x.wordsPerHourNet === null)).toBe(true);
    expect(time.caveats.some((c) => c.includes('una sola versione'))).toBe(true);
  });
  it('formats local days', () => {
    expect(localDay('2026-09-08T09:00:00+02:00')).toMatch(/^2026-09-0[78]$/);
  });
});

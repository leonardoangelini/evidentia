import { analyzeDataset } from '@/analysis';
import { buildCaseA, buildCaseB, buildCaseC, buildCaseD } from '@/demo/cases';

describe('metrics', () => {
  it('detects the large insertion of case B', async () => {
    const { metrics } = await analyzeDataset(await buildCaseB());
    expect(metrics.insertions.numberOfLargeInsertions).toBe(1);
    expect(metrics.insertions.largestInsertionWords).toBeGreaterThanOrEqual(700);
    expect(metrics.insertions.insertionsOver300Words).toBe(1);
    expect(metrics.insertions.thresholdWords).toBe(300);
    expect(metrics.timeline.largestWordIncreaseBetweenVersions).toBeGreaterThanOrEqual(700);
    expect(metrics.timeline.shortestIntervalWithLargeIncreaseMs).toBe(4 * 60_000);
  });
  it('has consistent version and session totals for case A', async () => {
    const ds = await buildCaseA();
    const { metrics, sessions } = await analyzeDataset(ds);
    expect(metrics.versions.numberOfVersions).toBe(ds.snapshots.length);
    expect(metrics.versions.numberOfReadableVersions).toBe(ds.snapshots.length);
    expect(metrics.versions.numberOfAuthors).toBe(1);
    expect(metrics.sessions.numberOfSessions).toBe(sessions.length);
    expect(metrics.sessions.longestSessionSpanMs).toBe(Math.max(...sessions.map((s) => s.spanMs)));
    expect(metrics.document.finalWordCount).toBe(ds.snapshots.at(-1)?.wordCount);
    expect(metrics.writing.netWordGrowth).toBe((ds.snapshots.at(-1)?.wordCount ?? 0) - (ds.snapshots[0]?.wordCount ?? 0));
    expect(metrics.insertions.numberOfLargeInsertions).toBe(0);
    expect(metrics.timeline.longestGapBetweenVersionsMs).toBeGreaterThanOrEqual(2 * 24 * 3_600_000);
  });
  it('captures revision activity for case C', async () => {
    const { metrics } = await analyzeDataset(await buildCaseC());
    expect(metrics.revision.numberOfRevisionEvents).toBeGreaterThanOrEqual(2);
    expect(metrics.revision.paragraphsRewritten).toBeGreaterThanOrEqual(5);
    expect(metrics.revision.proportionOfVersionsAfterFirstCompleteDraft).not.toBeNull();
    expect(metrics.revision.proportionOfVersionsAfterFirstCompleteDraft as number).toBeGreaterThan(0.3);
  });
  it('reports a complete first version and two authors for case D', async () => {
    const { metrics } = await analyzeDataset(await buildCaseD());
    expect(metrics.versions.firstVersionWordCount as number).toBeGreaterThan(1300);
    expect(metrics.versions.numberOfAuthors).toBe(2);
    expect(metrics.sessions.singleVersionSessions).toBe(2);
  });
  it('never produces suspicion-like fields', async () => {
    const { metrics } = await analyzeDataset(await buildCaseB());
    const keys = JSON.stringify(metrics).toLowerCase();
    for (const banned of ['suspicion', 'probability', 'cheat', 'aiscore', 'human']) expect(keys).not.toContain(banned);
  });
});

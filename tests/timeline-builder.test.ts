import { analyzeDataset } from '@/analysis';
import { computeMajorTransitions } from '@/analysis/timeline-builder';
import { buildCaseB } from '@/demo/cases';

describe('timeline generation', () => {
  it('is sorted and contains versions, sessions and the large insertion', async () => {
    const ds = await buildCaseB();
    const { timeline } = await analyzeDataset(ds);
    for (let i = 1; i < timeline.length; i++) expect(Date.parse(timeline[i]!.time)).toBeGreaterThanOrEqual(Date.parse(timeline[i - 1]!.time));
    expect(timeline.filter((t) => t.type === 'VERSION')).toHaveLength(ds.snapshots.length);
    expect(timeline.filter((t) => t.type === 'LARGE_INSERTION')).toHaveLength(1);
    expect(timeline.filter((t) => t.type === 'SESSION_START')).toHaveLength(1);
    expect(timeline.find((t) => t.type === 'VERSION')?.versionLabel).toBe('1.1');
    expect(timeline.filter((t) => t.type === 'VERSION').at(-1)?.label).toBe('versione corrente');
  });
  it('selects the large insertion as a major transition with author and version labels', async () => {
    const ds = await buildCaseB();
    const transitions = computeMajorTransitions(ds);
    const big = transitions.find((t) => t.netChange >= 700);
    expect(big).toBeDefined();
    expect(big?.fromVersion).toBe('1.4');
    expect(big?.toVersion).toBe('1.5');
    expect(big?.author).toBe('Autore 1');
    expect(transitions.length).toBeLessThanOrEqual(10);
  });
});

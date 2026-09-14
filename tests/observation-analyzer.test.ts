import { analyzeDataset } from '@/analysis';
import { buildCaseA, buildCaseD, buildCaseE } from '@/demo/cases';

describe('observation gaps', () => {
  it('reports the complete first version and long intervals for case D', async () => {
    const ds = await buildCaseD();
    const { observation } = await analyzeDataset(ds);
    const types = observation.knownGaps.map((g) => g.type);
    expect(types).toContain('BEFORE_FIRST_VERSION');
    expect(types.filter((t) => t === 'LONG_INTERVAL')).toHaveLength(2);
    const first = observation.knownGaps.find((g) => g.type === 'BEFORE_FIRST_VERSION')!;
    expect(first.evidence?.firstVersionWords as number).toBeGreaterThan(1300);
    expect(observation.limitations.length).toBeGreaterThan(3);
    expect(observation.source).toBe('SHAREPOINT_VERSION_HISTORY');
  });
  it('reports unavailable versions and a partial import for case E', async () => {
    const ds = await buildCaseE();
    const { observation, metrics } = await analyzeDataset(ds);
    expect(observation.knownGaps.filter((g) => g.type === 'VERSION_UNAVAILABLE')).toHaveLength(2);
    expect(observation.extractionFailures).toHaveLength(2);
    expect(observation.continuityWarnings.some((w) => w.type === 'PARTIAL_IMPORT')).toBe(true);
    expect(metrics.versions.numberOfReadableVersions).toBe(3);
    expect(observation.versionsStored).toBe(5);
    // Diff across unreadable versions falls back to counts (UNKNOWN), never invented text.
    expect(ds.diffs.some((d) => d.classification === 'UNKNOWN')).toBe(true);
  });
  it('has only the structural first-version gap for the clean case A', async () => {
    const ds = await buildCaseA();
    const { observation, chain } = await analyzeDataset(ds);
    expect(chain.valid).toBe(true);
    expect(observation.knownGaps.map((g) => g.type)).toEqual(['BEFORE_FIRST_VERSION', 'LONG_INTERVAL']);
    expect(observation.extractionFailures).toHaveLength(0);
    expect(observation.continuityWarnings).toHaveLength(0);
  });
});

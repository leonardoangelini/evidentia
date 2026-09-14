import { analyzeDataset } from '@/analysis';
import { buildAnalysisPrompt, buildCompactLlmInput, buildLlmInput } from '@/export/llm-exporter';
import { buildCaseB, buildCaseC } from '@/demo/cases';
import { VersionScenarioBuilder } from '@/demo/scenario-builder';
import { TextGenerator } from '@/demo/text-generator';

const AT = '2026-09-12T10:00:00+02:00';

describe('LLM export', () => {
  it('compact input is smaller and keeps the essentials', async () => {
    const ds = await buildCaseB();
    const analysis = await analyzeDataset(ds);
    const full = buildLlmInput(ds, analysis, AT);
    const compact = buildCompactLlmInput(ds, analysis, AT);
    expect(full.schemaVersion).toBe('2.1');
    expect(full.timeEstimates.sessions.length).toBe(analysis.sessions.length);
    expect(full.contentEvolution.finalParagraphs.length).toBe(ds.snapshots.at(-1)?.paragraphCount);
    expect(compact.timeEstimates).not.toHaveProperty('intervals');
    expect(full.source).toBe('SHAREPOINT_VERSION_HISTORY');
    expect(full.disclaimer.aiDetection).toBe(false);
    expect(compact.variant).toBe('compact');
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(full).length);
    expect(compact.finalDocument.text).toBe(ds.snapshots.at(-1)?.text);
    expect(compact.versions).toHaveLength(ds.snapshots.length);
    expect(compact.versions[1]?.delta).toBeGreaterThan(0);
    expect(compact.largeInsertions).toHaveLength(1);
    expect(compact.largeInsertions[0]?.addedExcerpts?.length).toBeGreaterThan(0);
    expect(compact.document.authors).toEqual([{ label: 'Autore 1', versions: ds.snapshots.length - 1 }]);
    expect(JSON.stringify(compact)).not.toContain('studente@');
    expect(compact.limitations.length).toBeGreaterThan(3);
  });
  it('omits text and display names in METRICS_ONLY mode', async () => {
    const gen = new TextGenerator(9);
    const s = new VersionScenarioBuilder({ documentId: 'm', name: 'metrics.docx', start: '2026-09-12T09:00:00+02:00', privacyMode: 'METRICS_ONLY' });
    s.append(gen.paragraphs(100)).save('Mario Rossi').advance(5 * 60_000).append(gen.paragraphs(400)).save('Mario Rossi');
    const ds = await s.build();
    const analysis = await analyzeDataset(ds);
    const compact = buildCompactLlmInput(ds, analysis, AT);
    expect(compact.finalDocument.text).toBeNull();
    expect(compact.finalDocument.textAvailability).toContain('METRICS_ONLY');
    expect(compact.largeInsertions[0]?.addedExcerpts).toBeUndefined();
    expect(JSON.stringify(ds)).not.toContain('Mario Rossi');
    expect(ds.diffs[0]?.basis).toBe('PARAGRAPH_HASHES');
  });
  it('truncates long final text in compact mode', async () => {
    const ds = await buildCaseC();
    const compact = buildCompactLlmInput(ds, await analyzeDataset(ds), AT, { maxTextWords: 100 });
    expect(compact.finalDocument.textAvailability).toContain('TRUNCATED');
    expect(compact.finalDocument.text?.split(' ').length).toBeLessThanOrEqual(102);
  });
  it('prompt contains the mandated instructions', async () => {
    const prompt = buildAnalysisPrompt(await buildCaseB());
    expect(prompt).toContain('Non cercare di stabilire se lo studente abbia utilizzato intelligenza artificiale');
    expect(prompt).toContain('3-5 domande');
    expect(prompt).toContain('fatti osservati');
    expect(prompt).toContain('cronologia versioni');
  });
});

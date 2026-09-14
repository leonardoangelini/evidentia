import { analyzeDataset } from '@/analysis';
import { sequenceSimilarity } from '@/analysis/content-evolution';
import { buildCaseA, buildCaseC } from '@/demo/cases';
import { VersionScenarioBuilder } from '@/demo/scenario-builder';
import { TextGenerator } from '@/demo/text-generator';

const MIN = 60_000;

describe('content evolution', () => {
  it('maps sections to the sessions in which they appeared (case A)', async () => {
    const ds = await buildCaseA();
    const { content, sessions } = await analyzeDataset(ds);
    expect(content.basis).toBe('TEXT');
    expect(content.hasSections).toBe(true);
    expect(content.phases).toHaveLength(sessions.length);
    const byName = Object.fromEntries(content.sections.map((s) => [s.section, s]));
    expect(byName['Introduzione']?.firstSeenSession).toBe(0);
    expect(byName['Quadro teorico']?.firstSeenSession).toBe(1);
    expect(byName['Conclusioni']?.firstSeenSession).toBe(2);
    expect(byName['Quadro teorico']?.wordsByPhase.map((w) => w.words)[0]).toBe(0);
    expect(byName['Conclusioni']?.sessionsTouched).toEqual([2]);
    expect(content.phases[0]?.presentInFirstVersionParagraphs).toBeGreaterThan(0);
    expect(content.phases[0]?.summary).toContain('prima versione contiene già');
    expect(content.phases[1]?.summary).toContain('Quadro teorico (0 →');
    expect(content.finalParagraphs).toHaveLength(ds.snapshots.at(-1)!.paragraphCount);
    expect(content.finalParagraphs[0]?.isHeading).toBe(true);
    expect(content.abandoned.length).toBeGreaterThanOrEqual(1);
    expect(content.abandoned[0]?.removedSession).toBe(2);
  });
  it('records deleted sections and revised paragraphs (case C)', async () => {
    const { content } = await analyzeDataset(await buildCaseC());
    const last = content.phases.at(-1)!;
    expect(last.sections.some((s) => s.section === 'Capitolo 1' && s.wordsAfter === 0)).toBe(true);
    expect(last.abandonedParagraphs).toBeGreaterThan(0);
    expect(content.sections.map((s) => s.section)).not.toContain('Capitolo 1');
  });
  it('follows a paragraph through a small edit as one revision', async () => {
    const gen = new TextGenerator(11);
    const base = gen.paragraph(6);
    const edited = base.replace(/\.$/, ' e con attenzione ai contesti.');
    const s = new VersionScenarioBuilder({ documentId: 'prov', name: 'prov.docx', start: '2026-09-12T09:00:00+02:00' });
    s.append(['# Titolo', base, gen.paragraph(5)]).save();
    s.advance(5 * MIN).rewriteParagraph(1, edited).save();
    s.advance(5 * MIN).append([gen.paragraph(5)]).save();
    const { content } = await analyzeDataset(await s.build());
    const p = content.finalParagraphs[1]!;
    expect(p.firstSeenVersion).toBe('1.1');
    expect(p.lastChangedVersion).toBe('1.2');
    expect(p.revisions).toBe(1);
    expect(content.finalParagraphs[3]?.firstSeenVersion).toBe('1.3');
    expect(content.abandoned).toHaveLength(0);
    expect(content.versionChanges[0]?.sections[0]).toMatchObject({ section: 'Titolo', paragraphsModified: 1 });
  });
  it('works on hashes only in METRICS_ONLY mode', async () => {
    const gen = new TextGenerator(12);
    const s = new VersionScenarioBuilder({ documentId: 'm', name: 'm.docx', start: '2026-09-12T09:00:00+02:00', privacyMode: 'METRICS_ONLY' });
    s.append(gen.paragraphs(100)).save().advance(5 * MIN).append(gen.paragraphs(100)).save();
    const { content } = await analyzeDataset(await s.build());
    expect(content.basis).toBe('PARAGRAPH_HASHES');
    expect(content.hasSections).toBe(false);
    expect(content.finalParagraphs.every((p) => p.excerpt === null && p.section === null)).toBe(true);
    expect(content.finalParagraphs.some((p) => p.firstSeenVersion === '1.2')).toBe(true);
    expect(JSON.stringify(content)).not.toContain('La scuola');
  });
  it('sequence similarity is order-aware', () => {
    expect(sequenceSimilarity(['a', 'b', 'c', 'd'], ['a', 'b', 'c', 'd'])).toBe(1);
    expect(sequenceSimilarity(['a', 'b', 'c', 'd'], ['d', 'c', 'b', 'a'])).toBeLessThan(0.5);
    expect(sequenceSimilarity(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'x', 'd', 'e'])).toBe(0.8);
  });
});

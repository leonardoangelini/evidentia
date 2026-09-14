import { unzipSync, strFromU8 } from 'fflate';
import { buildExportZip } from '@/export/exporter';
import { DEFAULT_SETTINGS } from '@/models';
import { buildCaseD } from '@/demo/cases';

const EXPECTED = [
  'manifest.json', 'document.json', 'sessions.json', 'events.jsonl', 'versions.json', 'diffs.json', 'metrics.json', 'timeline.json', 'observation.json', 'time-estimates.json', 'content-evolution.json', 'glossary.json', 'final.txt',
  'llm/analysis-input.json', 'llm/analysis-input-compact.json', 'llm/analysis-prompt.md', 'llm/analysis-for-llm.md', 'llm/analysis-for-llm.docx', 'report/process-report.html', 'README.txt',
];

describe('ZIP export', () => {
  it('contains every required file and a valid report', async () => {
    const ds = await buildCaseD();
    const { zip, result } = await buildExportZip(ds, DEFAULT_SETTINGS, '0.2.0');
    const entries = unzipSync(zip);
    for (const f of EXPECTED) expect(Object.keys(entries)).toContain(f);
    const manifest = JSON.parse(strFromU8(entries['manifest.json']!));
    expect(manifest.integrity.eventChainValid).toBe(true);
    expect(manifest.source).toBe('SHAREPOINT_VERSION_HISTORY');
    expect(manifest.files).toEqual([...EXPECTED].sort());
    const html = strFromU8(entries['report/process-report.html']!);
    expect(html).toContain('Evidentia — Writing Process Report');
    expect(html).toContain('non costituisce un sistema di rilevamento');
    expect(html).toContain('BEFORE_FIRST_VERSION');
    expect(html).toContain('Autore 2');
    expect(html).toContain('<svg');
    expect(html).toContain('Tempo stimato e ritmo');
    expect(html).toContain('Mappa del testo finale');
    expect(html).toContain('Glossario dei dati');
    expect((html.match(/class="info"/g) ?? []).length).toBeGreaterThan(40);
    expect(JSON.parse(strFromU8(entries['time-estimates.json']!)).sessions).toHaveLength(result.analysis.sessions.length);
    expect(strFromU8(entries['events.jsonl']!).trim().split('\n')).toHaveLength(ds.events.length);
    expect(result.analysis.observation.knownGaps.length).toBeGreaterThan(0);
  });
});

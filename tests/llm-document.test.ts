// @vitest-environment jsdom
import { analyzeDataset } from '@/analysis';
import { extractDocxText } from '@/docx/docx-text';
import { buildLlmDocumentBlocks, buildLlmDocx, buildLlmMarkdown } from '@/export/llm-document';
import { buildCaseB, buildCaseD } from '@/demo/cases';

const AT = '2026-09-12T10:00:00+02:00';

describe('single-file LLM document', () => {
  it('markdown carries instructions, data sections, gaps and the final text', async () => {
    const ds = await buildCaseD();
    const md = buildLlmMarkdown(ds, await analyzeDataset(ds), AT);
    for (const s of ['# Evidentia', '## Istruzioni', 'Non cercare di stabilire se lo studente', '## Versioni', '| # | Versione |', 'BEFORE_FIRST_VERSION', 'LONG_INTERVAL', 'Autore 2', '## Glossario dei dati', 'Legenda: Arco osservato =', '## Tempo stimato e ritmo', '### Per giornata', '## Evoluzione dei contenuti per fase', '### Mappa del testo finale', 'Contenuto eliminato', '## Testo della versione corrente', '```json']) expect(md).toContain(s);
    expect(md).toContain('"timeEstimates"');
    expect(md).not.toMatch(/suspicion|probabilit/i);
  });
  it('docx round-trips through the extractor with headings and tables', async () => {
    const ds = await buildCaseB();
    const analysis = await analyzeDataset(ds);
    const bytes = buildLlmDocx(ds, analysis, AT);
    expect(String.fromCharCode(bytes[0]!, bytes[1]!)).toBe('PK');
    const ex = extractDocxText(bytes);
    expect(ex.headings.map((h) => h.text)).toContain('Grandi inserimenti (1, soglia 300 parole)');
    expect(ex.headings.map((h) => h.text)).toContain('Evoluzione dei contenuti per fase');
    expect(ex.text).toContain('Analisi (0 →');
    expect(ex.paragraphs.some((p) => p.includes('1.4 → 1.5'))).toBe(true);
    expect(ex.text).toContain(ds.snapshots.at(-1)!.text!.split('\n')[0]!);
    const blocks = buildLlmDocumentBlocks(ds, analysis, AT);
    expect(blocks.filter((b) => b.type === 'table').length).toBeGreaterThanOrEqual(8);
  });
});

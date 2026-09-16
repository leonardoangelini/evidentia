import { analyzeDataset } from '@/analysis';
import { buildCaseA, buildCaseB, buildCaseD, buildCaseE } from '@/demo/cases';
import { wordCountChart } from '@/export/html-report';

const WIDTH = 940;
const HEIGHT = 260;

/** I riquadri sono posizionati senza misurare il testo: devono restare nel viewBox. */
function tooltipBoxes(svg: string): Array<{ x: number; y: number; w: number; h: number }> {
  const re = /<g class="ev-tip" transform="translate\((-?[\d.]+),(-?[\d.]+)\)"><rect width="([\d.]+)" height="([\d.]+)"/g;
  return [...svg.matchAll(re)].map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }));
}

describe('word count chart', () => {
  it('gives every version a hover band and keeps the tooltip inside the chart', async () => {
    const ds = await buildCaseA();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect((svg.match(/class="ev-band"/g) ?? [])).toHaveLength(ds.snapshots.length);
    const boxes = tooltipBoxes(svg);
    expect(boxes).toHaveLength(ds.snapshots.length);
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(WIDTH);
      expect(b.y + b.h).toBeLessThanOrEqual(HEIGHT);
    }
  });

  it('names in the tooltip what the version shows: parole, tipo, intervallo, autore', async () => {
    const ds = await buildCaseB();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect(svg).toContain('dalla precedente');
    // Nessuna versione saltata nel caso B: non c'è da precisare "leggibile".
    expect(svg).not.toContain('dalla precedente leggibile');
    expect(svg).toContain('ADDING · +');
    expect(svg).toContain('Autore 1');
    expect(svg).toContain('sessione 1');
    expect(svg).toContain('prima versione della cronologia');
    // Il caso B ha un solo inserimento oltre soglia: dichiarato con la sua soglia.
    expect((svg.match(/Grande inserimento: \+/g) ?? [])).toHaveLength(1);
    expect(svg).toContain('(soglia 300)');
  });

  it('declares unreadable versions instead of dropping them', async () => {
    const ds = await buildCaseE();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    const unreadable = ds.snapshots.filter((s) => s.extractionStatus === 'UNAVAILABLE');
    expect(unreadable.length).toBeGreaterThan(0);
    expect((svg.match(/Versione non leggibile/g) ?? [])).toHaveLength(unreadable.length);
    expect(svg).toContain('HTTP 403');
    expect(svg).toContain('versione non leggibile</span>');
    // La versione dopo le due illeggibili confronta con l'ultima leggibile, e lo dice.
    expect(svg).toContain('dalla precedente leggibile');
    // Anche le versioni non leggibili hanno la loro banda: la cronologia è completa.
    expect((svg.match(/class="ev-band"/g) ?? [])).toHaveLength(ds.snapshots.length);
  });

  it('says the interval once, and names it when it is a declared gap', async () => {
    const ds = await buildCaseA();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect(svg).toContain('intervallo lungo: 48 h 5 min senza versioni');
    // La stessa durata non va ripetuta in due righe dello stesso riquadro.
    expect(svg).not.toContain('48 h 5 min dalla precedente');
  });

  it('marks on the first version that what came before it is not observable', async () => {
    const ds = await buildCaseD();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect(svg).toContain('prima versione della cronologia');
    expect((svg.match(/La stesura precedente a questa versione non è osservabile\./g) ?? [])).toHaveLength(1);
  });

  it('describes the whole chart for assistive technology', async () => {
    const ds = await buildCaseA();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect(svg).toMatch(new RegExp(`aria-label="Parole per versione nel tempo: ${ds.snapshots.length} versioni`));
    expect(svg).toContain('sono nell&#39;elenco delle versioni');
  });

  it('works without JavaScript, so the exported report keeps the tooltips', async () => {
    const ds = await buildCaseB();
    const svg = wordCountChart(ds, await analyzeDataset(ds));
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('onmouse');
    expect(svg).toContain('.ev-band:hover .ev-tip{opacity:1}');
  });
});

import { GLOSSARY, GLOSSARY_GROUPS, explain, legend, term } from '@/analysis/glossary';

describe('data glossary', () => {
  it('lists every entry exactly once in the groups', () => {
    const grouped = GLOSSARY_GROUPS.flatMap((g) => g.ids);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(GLOSSARY.map((e) => e.id).sort());
  });
  it('has a label, a kind and a meaning for every entry, without suspicion language', () => {
    for (const e of GLOSSARY) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(['osservato', 'derivato', 'stima']).toContain(e.kind);
      expect(e.meaning.length).toBeGreaterThan(20);
      expect(explain(e.id)).not.toMatch(/sospett|plagio|cheat|intelligenza artificiale usata/i);
    }
  });
  it('marks time as estimate and server data as observed', () => {
    expect(term('estimatedActiveTotal').kind).toBe('stima');
    expect(term('wordsPerHour').kind).toBe('stima');
    expect(term('versionDate').kind).toBe('osservato');
    expect(explain('estimatedActiveTotal', true)).toMatch(/^Tempo attivo stimato — Stima\./);
    expect(legend(['observedSpan', 'leadIn', 'observedSpan'])).toMatch(/^Legenda: Arco osservato = .* · Avvio = /);
  });
});

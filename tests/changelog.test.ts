import { readFileSync } from 'node:fs';
import { changelog, entryFor, inlineSegments, parseChangelog } from '@/utils/changelog';

describe('changelog', () => {
  it('parses headings, intro text and bullets', () => {
    const entries = parseChangelog(`# Changelog

Preambolo che non appartiene a nessuna versione.

## 0.2.0 — 2026-10-01

Prima versione con le cartelle.

- una voce
- una voce lunga, che prosegue
  sulla riga dopo

## 0.1.0 — 2026-09-15

- la prima
`);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      version: '0.2.0',
      date: '2026-10-01',
      intro: 'Prima versione con le cartelle.',
      changes: ['una voce', 'una voce lunga, che prosegue sulla riga dopo'],
    });
    expect(entries[1]?.changes).toEqual(['la prima']);
  });

  it('accepts a heading without a date and a leading v', () => {
    const [entry] = parseChangelog('## v1.0.0\n\n- pubblicata\n');
    expect(entry).toMatchObject({ version: '1.0.0', date: null, changes: ['pubblicata'] });
  });

  it('matches a testing build against the release it was built from', () => {
    const entries = parseChangelog('## 0.1.2 — 2026-09-16\n\n- una voce\n');
    // Sul canale testing il manifest porta "0.1.2.37": conta la version di base.
    expect(entryFor('0.1.2.37', entries)?.version).toBe('0.1.2');
    expect(entryFor('0.9.9', entries)).toBeNull();
  });

  it('reads the CHANGELOG.md that ships with the extension', () => {
    const entries = changelog();
    expect(entries.length).toBeGreaterThan(0);
    // Ogni voce ha qualcosa da dire, o non serve a chi legge la scheda Info.
    for (const e of entries) expect(e.changes.length + (e.intro ? 1 : 0)).toBeGreaterThan(0);
  });

  it('documents the version that is about to be released', () => {
    const version = JSON.parse(readFileSync('package.json', 'utf-8')).version as string;
    expect(entryFor(version), `CHANGELOG.md non ha una voce per la version ${version} di package.json`).not.toBeNull();
  });

  it('has package.json at the version of its latest entry', () => {
    // Le due si muovono insieme: una voce nuova nel CHANGELOG senza il bump di
    // `version` resterebbe invisibile nella scheda Info e non verrebbe mai
    // pubblicata; il bump senza la voce è coperto dal test precedente.
    const version = JSON.parse(readFileSync('package.json', 'utf-8')).version as string;
    const latest = changelog()[0]?.version;
    expect(version, `CHANGELOG.md documenta la ${latest} ma package.json è ancora alla ${version}: alza la version`).toBe(latest);
  });

  it('splits the inline markdown a bullet may use', () => {
    expect(inlineSegments('Nuova scheda **Info**: modalità `METRICS_ONLY`.')).toEqual([
      { text: 'Nuova scheda ', style: 'plain' },
      { text: 'Info', style: 'strong' },
      { text: ': modalità ', style: 'plain' },
      { text: 'METRICS_ONLY', style: 'code' },
      { text: '.', style: 'plain' },
    ]);
    expect(inlineSegments('niente markdown')).toEqual([{ text: 'niente markdown', style: 'plain' }]);
    expect(inlineSegments('')).toEqual([]);
  });

  it('leaves no stray markdown markers in the shipped notes', () => {
    for (const e of changelog()) {
      for (const line of [e.intro, ...e.changes]) {
        const rendered = inlineSegments(line).map((s) => s.text).join('');
        expect(rendered, `voce con markdown non chiuso: ${line}`).not.toMatch(/\*\*|`/);
      }
    }
  });
});
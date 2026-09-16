import { isTab, parseHash, TABS, UTILITIES, viewLabel } from '@/ui/process-view/tabs';

describe('process view tabs', () => {
  it('has five analysis tabs and four utility views, all labelled in Italian', () => {
    expect(TABS.map(([id]) => id)).toEqual(['panoramica', 'cronologia', 'contenuti', 'versioni', 'copertura']);
    expect(UTILITIES.map(([id]) => id)).toEqual(['glossary', 'settings', 'about', 'raw']);
    for (const [, label] of [...TABS, ...UTILITIES]) expect(label).toMatch(/^[A-Z][a-zà-ù ]+$/);
  });
  it('keeps the hashes the popup links to', () => {
    expect(parseHash('#settings')).toBe('settings');
    expect(parseHash('#about')).toBe('about');
    expect(parseHash('#glossary')).toBe('glossary');
    expect(parseHash('#raw')).toBe('raw');
  });
  it('maps the hashes of the tabs merged in 0.2 to their new home', () => {
    expect(parseHash('#overview')).toBe('panoramica');
    expect(parseHash('#timeline')).toBe('cronologia');
    expect(parseHash('#sessions')).toBe('cronologia');
    expect(parseHash('#time')).toBe('cronologia');
    expect(parseHash('#content')).toBe('contenuti');
    expect(parseHash('#versions')).toBe('versioni');
    expect(parseHash('#insertions')).toBe('versioni');
    expect(parseHash('#revisions')).toBe('versioni');
    expect(parseHash('#gaps')).toBe('copertura');
  });
  it('falls back to the overview for an empty or unknown hash', () => {
    expect(parseHash('')).toBe('panoramica');
    expect(parseHash('#')).toBe('panoramica');
    expect(parseHash('#nope')).toBe('panoramica');
  });
  it('tells tabs and utility views apart', () => {
    expect(isTab('versioni')).toBe(true);
    expect(isTab('settings')).toBe(false);
    expect(viewLabel('settings')).toBe('Impostazioni');
  });
});

/**
 * Le note di versione mostrate nella scheda Info, lette da CHANGELOG.md.
 *
 * Il file del repository è **la** fonte: viene incluso nel bundle come
 * stringa, così non esiste una seconda copia da tenere allineata e la
 * scheda funziona offline come il resto dell'estensione.
 *
 * Il formato atteso è quello di CHANGELOG.md, e solo quello:
 *
 *     ## 0.1.2 — 2026-09-16
 *
 *     - una voce
 *     - un'altra voce, che può proseguire
 *       sulla riga dopo
 *
 * Tutto ciò che precede la prima intestazione `##` è preambolo e viene
 * ignorato; il testo libero dentro una versione (una riga di introduzione)
 * diventa la sua `intro`.
 */
import raw from '../../CHANGELOG.md?raw';

export interface ChangelogEntry {
  /** Version as written in the heading ("0.1.2"). */
  version: string;
  /** Date as written in the heading, or null when the heading has none. */
  date: string | null;
  /** Free text between the heading and the first bullet, if any. */
  intro: string;
  /** One string per bullet, already joined across continuation lines. */
  changes: string[];
}

/** `## <version> — <date>`; il separatore può essere un trattino qualunque. */
const HEADING = /^##\s+v?(\S+)\s*(?:[—–-]\s*(.+?))?\s*$/;
const BULLET = /^[-*]\s+(.*)$/;

export function parseChangelog(text: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let current: ChangelogEntry | null = null;
  let introLines: string[] = [];

  // Chiamata a ogni voce e a ogni intestazione: senza la guardia, la seconda
  // voce di una versione cancellerebbe l'introduzione raccolta prima.
  const flushIntro = (): void => {
    if (current && introLines.length > 0) current.intro = introLines.join(' ').trim();
    introLines = [];
  };

  for (const line of text.split('\n')) {
    const heading = HEADING.exec(line);
    if (heading) {
      flushIntro();
      current = { version: heading[1] as string, date: heading[2]?.trim() || null, intro: '', changes: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue; // preambolo del file

    const bullet = BULLET.exec(line);
    if (bullet) {
      flushIntro();
      current.changes.push((bullet[1] as string).trim());
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) continue;
    // Riga indentata sotto una voce: è la continuazione di quella voce.
    if (current.changes.length > 0 && /^\s/.test(line)) {
      const last = current.changes.length - 1;
      current.changes[last] = `${current.changes[last] as string} ${trimmed}`;
      continue;
    }
    // Testo libero prima delle voci: introduzione della versione.
    if (current.changes.length === 0) introLines.push(trimmed);
  }
  flushIntro();
  return entries;
}

let cached: ChangelogEntry[] | null = null;

/** Le voci di CHANGELOG.md, dalla più recente. */
export function changelog(): ChangelogEntry[] {
  cached ??= parseChangelog(raw);
  return cached;
}

/**
 * La voce che descrive la versione installata. Sul canale testing la version
 * del manifest porta una quarta componente (`0.1.2.37`): si confronta sulle
 * prime tre, altrimenti una build di prova non troverebbe mai le sue note.
 */
export function entryFor(version: string, entries: ChangelogEntry[] = changelog()): ChangelogEntry | null {
  const base = version.split('.').slice(0, 3).join('.');
  return entries.find((e) => e.version === base) ?? null;
}

/** Un pezzo di riga con la sua enfasi, già senza i segni del markdown. */
export interface InlineSegment {
  text: string;
  style: 'plain' | 'strong' | 'code';
}

/** `**grassetto**` e `` `codice` ``: l'unico markdown che le voci usano. */
const INLINE = /\*\*(.+?)\*\*|`(.+?)`/g;

/**
 * Spezza una voce nei suoi pezzi, così la scheda Info può renderla in DOM
 * senza un parser markdown e senza mai passare da innerHTML.
 */
export function inlineSegments(text: string): InlineSegment[] {
  const out: InlineSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const at = m.index;
    if (at > last) out.push({ text: text.slice(last, at), style: 'plain' });
    out.push(m[1] !== undefined ? { text: m[1], style: 'strong' } : { text: m[2] as string, style: 'code' });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), style: 'plain' });
  return out;
}

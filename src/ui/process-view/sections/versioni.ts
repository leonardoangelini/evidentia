/**
 * Versioni: una riga per versione con il passaggio dalla precedente (tipo,
 * parole aggiunte/eliminate/sostituite, grandi inserimenti), e sotto il
 * confronto parola per parola fra due versioni selezionate.
 */
import type { Analysis } from '@/analysis';
import type { DocumentDataset, Snapshot, SnapshotDiff } from '@/models';
import { badge, h } from '@/ui/shared/dom';
import { formatInt } from '@/utils/text';
import { formatDateTime, formatDuration } from '@/utils/time';
import type { ViewContext } from '../context';
import { renderSnapshotComparison } from '../diff-view';
import { info, kv, th } from '../widgets';

const COLUMNS = 12;

export function renderVersioni(ds: DocumentDataset, an: Analysis, ctx: ViewContext): HTMLElement {
  const { state } = ctx;
  const m = an.metrics;
  const el = h('section', {});
  const snaps = [...ds.snapshots].sort((a, b) => a.index - b.index);
  const diffByTo = new Map(ds.diffs.map((d) => [d.toSnapshotId, d]));
  const threshold = m.insertions.thresholdWords;
  const isLarge = (d: SnapshotDiff): boolean => d.wordCountDelta >= threshold;

  el.appendChild(h('h2', {}, `Versioni (${snaps.length})`, info('versions')));
  el.appendChild(h('p', { class: 'muted' }, 'Ogni riga è una versione e il passaggio dalla precedente. Seleziona due versioni per confrontarle, una per leggerne il testo.'));
  el.appendChild(
    h(
      'p',
      { class: 'summary' },
      h('span', {}, badge(`${m.insertions.numberOfLargeInsertions} ${m.insertions.numberOfLargeInsertions === 1 ? 'grande inserimento' : 'grandi inserimenti'}`, m.insertions.numberOfLargeInsertions > 0 ? 'danger' : ''), ` soglia ${formatInt(threshold)} parole`, info('largeInsertions')),
      h('span', {}, badge(`${m.revision.numberOfRevisionEvents} ${m.revision.numberOfRevisionEvents === 1 ? 'passaggio con revisione' : 'passaggi con revisione'}`, m.revision.numberOfRevisionEvents > 0 ? 'rev' : ''), info('revisions')),
    ),
  );

  const toggle = (s: Snapshot): void => {
    const i = state.selected.indexOf(s.id);
    if (i >= 0) state.selected.splice(i, 1);
    else {
      state.selected.push(s.id);
      if (state.selected.length > 2) state.selected.shift();
    }
    ctx.render();
  };

  const rows: HTMLElement[] = [];
  let prevWords: number | null = null;
  for (const s of snaps) {
    const un = s.extractionStatus === 'UNAVAILABLE';
    const d = diffByTo.get(s.id);
    // Δ rispetto alla versione leggibile precedente, come dice il glossario:
    // salta le versioni non leggibili invece di mostrare un salto fittizio.
    const delta = !un && prevWords !== null ? s.wordCount - prevWords : null;
    if (!un) prevWords = s.wordCount;
    const large = d !== undefined && isLarge(d);
    const selected = state.selected.includes(s.id);
    rows.push(
      h(
        'tr',
        { class: `selectable ${selected ? 'selected' : ''} ${large ? 'large' : ''}`, onclick: () => toggle(s) },
        h('td', {}, h('input', { type: 'checkbox', checked: selected, onclick: (e: Event) => { e.stopPropagation(); toggle(s); } })),
        h('td', {}, String(s.index)),
        h('td', {}, `${s.versionLabel}${s.isCurrent ? ' (corrente)' : ''}`),
        h('td', { class: 'mono' }, formatDateTime(s.timestamp)),
        h('td', {}, d ? formatDuration(d.elapsedMs) : '–'),
        h('td', {}, s.authorLabel ?? '–'),
        h('td', {}, un ? '–' : formatInt(s.wordCount)),
        h('td', {}, delta === null ? '–' : `${delta >= 0 ? '+' : ''}${formatInt(delta)}`, large ? [' ', badge('grande inserimento', 'danger')] : null),
        h('td', {}, d ? classificationBadge(d) : '–'),
        h('td', { class: 'mono' }, d && d.classification !== 'UNKNOWN' ? `+${formatInt(d.wordsAdded)} / −${formatInt(d.wordsDeleted)} / ~${formatInt(d.wordsReplaced)}` : '–'),
        h('td', {}, d && d.classification !== 'UNKNOWN' ? `${d.paragraphsAdded}/${d.paragraphsDeleted}/${d.paragraphsModified}` : '–'),
        h('td', {}, badge(s.extractionStatus, un ? 'danger' : 'ok'), s.extractionNotes.length ? h('div', { class: 'muted small' }, s.extractionNotes.join('; ')) : null),
      ),
    );
    if (large && d) {
      rows.push(
        h(
          'tr',
          { class: 'excerpt-row', onclick: (e: Event) => e.stopPropagation() },
          h(
            'td',
            { colspan: COLUMNS },
            h(
              'details',
              {},
              h('summary', {}, `Testo aggiunto in questo passaggio (+${formatInt(d.wordCountDelta)} parole, ${formatDuration(d.elapsedMs)} dalla versione precedente)`, info('excerpt')),
              d.addedBlocks.length ? d.addedBlocks.slice(0, 2).map((b) => h('blockquote', { class: 'add' }, b.excerpt)) : h('p', { class: 'muted small' }, 'Testo non registrato (modalità METRICS_ONLY).'),
              h('p', { class: 'muted small' }, 'Fra le due versioni non è osservato nulla: la provenienza del testo non è determinabile.'),
            ),
          ),
        ),
      );
    }
  }

  el.appendChild(
    h(
      'table',
      { class: 'versions' },
      h('thead', {}, h('tr', {}, h('th', {}, ''), th('versionIndex'), th('versionLabel'), th('versionDate'), th('interval'), th('versionAuthor'), th('versionWords'), th('versionDelta'), th('diffType'), th('diffWords'), th('paragraphsPDM'), th('versionStatus'))),
      h('tbody', {}, ...rows),
    ),
  );

  if (state.selected.length === 2) {
    const pair = state.selected.map((id) => snaps.find((s) => s.id === id)).filter((s): s is Snapshot => s !== undefined);
    if (pair.length === 2) {
      const [a, b] = pair as [Snapshot, Snapshot];
      const [from, to] = a.index <= b.index ? [a, b] : [b, a];
      el.appendChild(h('h2', {}, `Confronto versione ${from.versionLabel} → ${to.versionLabel}`));
      el.appendChild(renderSnapshotComparison(a, b));
    }
  } else if (state.selected.length === 1) {
    const s = snaps.find((x) => x.id === state.selected[0]);
    if (s) {
      el.appendChild(h('h2', {}, `Versione ${s.versionLabel}`));
      el.appendChild(h('table', { class: 'kv' }, kv('versionDate', formatDateTime(s.timestamp)), kv('versionParagraphs', s.extractionStatus === 'UNAVAILABLE' ? '–' : String(s.paragraphCount)), kv('versionHash', h('span', { class: 'mono' }, s.textHash.slice(0, 10) || '–'))));
      el.appendChild(s.text !== null ? h('pre', { style: 'white-space:pre-wrap' }, s.text) : h('p', { class: 'muted' }, 'Testo non disponibile per questa versione.'));
    }
  }
  return el;
}

function classificationBadge(d: SnapshotDiff): HTMLElement {
  const c = d.classification;
  return badge(c, c === 'REWRITING' ? 'rev' : c === 'DELETING' ? 'danger' : c === 'ADDING' ? 'ok' : c === 'UNKNOWN' ? 'warn' : '');
}

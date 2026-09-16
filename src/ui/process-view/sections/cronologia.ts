/**
 * Cronologia: il grafico, le sessioni con il tempo stimato, le giornate, le
 * avvertenze e, chiuso, il registro di ogni evento.
 */
import type { Analysis } from '@/analysis';
import { wordCountChart } from '@/export/html-report';
import type { DocumentDataset } from '@/models';
import { badge, h, html } from '@/ui/shared/dom';
import { formatInt } from '@/utils/text';
import { formatDateTime, formatDuration } from '@/utils/time';
import { info, th } from '../widgets';

export function renderCronologia(ds: DocumentDataset, an: Analysis): HTMLElement {
  const t = an.time;
  const rate = (n: number | null): string => (n === null ? '–' : formatInt(n));
  const el = h('section', {});
  el.appendChild(h('h2', {}, 'Cronologia', info('chart')));
  el.appendChild(html(wordCountChart(ds, an)));
  el.appendChild(h('p', { class: 'muted' }, `Le sessioni sono gruppi di versioni salvate a meno di ${an.options.sessionGapMinutes} minuti l'una dall'altra: indicano quando il documento è stato salvato, non quanto tempo è stato dedicato. Il tempo attivo è una stima dai soli orari delle versioni: arco di ogni sessione più ${t.leadInMinutes} minuti di avvio (modificabile nelle impostazioni); parole/ora solo su sessioni con almeno ${t.minSessionForRateMinutes} minuti stimati.`));
  el.appendChild(
    h(
      'p',
      { class: 'summary' },
      h('span', {}, 'Tempo osservato ', h('strong', {}, formatDuration(t.observedTotalMs)), info('observedTotal')),
      h('span', {}, 'Tempo attivo stimato ', h('strong', {}, formatDuration(t.estimatedActiveTotalMs)), info('estimatedActiveTotal')),
      h('span', {}, h('strong', {}, String(t.daysWithVersions)), ` ${t.daysWithVersions === 1 ? 'giornata' : 'giornate'} con versioni`, info('daysWithVersions')),
    ),
  );

  el.appendChild(h('h3', {}, `Sessioni (${t.sessions.length})`, info('sessions')));
  el.appendChild(
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, th('sessionIndex'), th('sessionStart'), th('sessionEnd'), th('sessionVersions'), th('observedSpan'), th('estimatedActive'), th('sessionWords'), th('netWords'), th('plusMinus'), th('wordsPerHour'), th('sessionAuthors'))),
      h(
        'tbody',
        {},
        ...t.sessions.map((s, i) => {
          const base = an.sessions[i];
          return h(
            'tr',
            {},
            h('td', {}, String(s.sessionIndex + 1)),
            h('td', { class: 'mono' }, formatDateTime(s.startedAt)),
            h('td', { class: 'mono' }, s.versionCount > 1 ? formatDateTime(s.endedAt) : '–'),
            h('td', {}, String(s.versionCount)),
            h('td', {}, s.versionCount > 1 ? formatDuration(s.observedSpanMs) : '0'),
            h('td', {}, formatDuration(s.estimatedActiveMs)),
            h('td', {}, `${base?.wordCountStart ?? '–'} → ${base?.wordCountEnd ?? '–'}`),
            h('td', {}, `${s.netWords >= 0 ? '+' : ''}${formatInt(s.netWords)}${s.includesFirstVersionContent ? '' : ' *'}`),
            h('td', {}, `+${formatInt(s.wordsAdded)} / −${formatInt(s.wordsDeleted)}`),
            h('td', {}, rate(s.wordsPerHourNet)),
            h('td', {}, s.authorLabels.join(', ') || '–'),
          );
        }),
      ),
    ),
  );
  el.appendChild(h('p', { class: 'muted small' }, '* Prima sessione: il contenuto della prima versione disponibile non è attribuito (scritto prima dell\'osservazione).'));

  el.appendChild(h('h3', {}, 'Per giornata'));
  el.appendChild(
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, th('day'), th('daySessions'), th('dayVersions'), th('estimatedActive'), th('netWords'), th('plusMinus'), th('sessionAuthors'))),
      h('tbody', {}, ...t.days.map((d) => h('tr', {}, h('td', { class: 'mono' }, d.date), h('td', {}, String(d.sessions)), h('td', {}, String(d.versions)), h('td', {}, formatDuration(d.estimatedActiveMs)), h('td', {}, `${d.netWords >= 0 ? '+' : ''}${formatInt(d.netWords)}`), h('td', {}, `+${formatInt(d.wordsAdded)} / −${formatInt(d.wordsDeleted)}`), h('td', {}, d.authorLabels.join(', ') || '–')))),
    ),
  );

  el.appendChild(h('h3', {}, 'Avvertenze'));
  el.appendChild(h('ul', {}, ...t.caveats.map((x) => h('li', { class: 'muted' }, x))));

  el.appendChild(
    h(
      'details',
      {},
      h('summary', {}, `Registro degli eventi (${an.timeline.length})`, info('timelineEvent')),
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('timelineTime'), th('timelineEvent'), th('timelineDetail'))),
        h('tbody', {}, ...an.timeline.map((e) => h('tr', {}, h('td', { class: 'mono' }, formatDateTime(e.time)), h('td', {}, badge(e.type, e.type === 'LARGE_INSERTION' ? 'danger' : e.type === 'REVISION' ? 'rev' : e.type === 'GAP' ? 'warn' : e.type === 'VERSION' ? 'ok' : '')), h('td', {}, [e.versionLabel ? `versione ${e.versionLabel}` : null, e.author ?? null, e.wordCount !== undefined ? `${formatInt(e.wordCount)} parole` : null, e.words !== undefined ? `${formatInt(e.words)} parole` : null, e.durationMs !== undefined ? formatDuration(e.durationMs) : null, e.label ?? null].filter(Boolean).join(' · '))))),
      ),
    ),
  );
  return el;
}

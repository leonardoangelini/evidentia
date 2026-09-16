/**
 * Panoramica: i numeri essenziali, il grafico e i punti da guardare. Il resto
 * vive nelle schede di dettaglio: qui isolare un rapporto in una card
 * inviterebbe a leggerlo come indizio.
 */
import type { Analysis } from '@/analysis';
import { wordCountChart } from '@/export/html-report';
import type { DocumentDataset } from '@/models';
import { h, html } from '@/ui/shared/dom';
import { formatInt } from '@/utils/text';
import { formatDateTime, formatDuration } from '@/utils/time';
import type { ViewContext } from '../context';
import { callout, card, info } from '../widgets';

export function renderPanoramica(ds: DocumentDataset, an: Analysis, ctx: ViewContext): HTMLElement {
  const m = an.metrics;
  const t = an.time;
  const o = an.observation;
  const el = h('section', {});
  el.appendChild(h('h1', {}, ds.document.name || '(senza nome)'));
  el.appendChild(h('p', { class: 'muted' }, `${ds.document.host} · creato ${ds.document.timeCreated ? formatDateTime(ds.document.timeCreated) : '–'} · ultima modifica ${ds.document.timeLastModified ? formatDateTime(ds.document.timeLastModified) : '–'} · analizzato ${formatDateTime(ds.document.lastAnalyzedAt)} · modalità ${ds.document.privacyMode}`));

  const first = m.versions.firstVersionWordCount;
  el.appendChild(
    h(
      'div',
      { class: 'cards' },
      card('versions', String(m.versions.numberOfVersions), { sub: m.versions.numberOfReadableVersions === m.versions.numberOfVersions ? 'tutte leggibili' : `${m.versions.numberOfReadableVersions} leggibili` }),
      card('calendarSpan', formatDuration(m.versions.totalSpanMs), { sub: [`${t.daysWithVersions} ${t.daysWithVersions === 1 ? 'giornata' : 'giornate'} con versioni`, info('daysWithVersions')] }),
      card('sessions', String(m.sessions.numberOfSessions)),
      card('wordsProgress', `${first === null ? '–' : formatInt(first)} → ${formatInt(m.document.finalWordCount)}`, { sub: `+${formatInt(m.writing.estimatedWordsAdded)} / −${formatInt(m.writing.estimatedWordsDeleted)}` }),
      card('estimatedActiveTotal', formatDuration(t.estimatedActiveTotalMs), { sub: [`di cui osservato ${formatDuration(t.observedTotalMs)}`, info('observedTotal')] }),
      m.versions.numberOfAuthors > 1 ? card('authors', String(m.versions.numberOfAuthors)) : null,
    ),
  );

  el.appendChild(h('h2', {}, 'Parole per versione nel tempo', info('chart')));
  el.appendChild(html(wordCountChart(ds, an)));

  el.appendChild(h('h2', {}, 'Da guardare'));
  const threshold = m.insertions.thresholdWords;
  const largest = [...ds.diffs].filter((d) => d.wordCountDelta >= threshold).sort((a, b) => b.wordCountDelta - a.wordCountDelta)[0];
  const gapTypes = Array.from(new Set(o.knownGaps.map((g) => g.type)));
  const callouts = [
    largest
      ? callout({ id: 'largeInsertions', kind: 'ins', count: m.insertions.numberOfLargeInsertions, title: m.insertions.numberOfLargeInsertions === 1 ? 'grande inserimento' : 'grandi inserimenti', context: `il più grande +${formatInt(largest.wordCountDelta)} parole · soglia ${formatInt(threshold)}`, onclick: () => ctx.select([largest.fromSnapshotId, largest.toSnapshotId], 'versioni') })
      : null,
    m.revision.numberOfRevisionEvents > 0
      ? callout({ id: 'revisions', kind: 'rev', count: m.revision.numberOfRevisionEvents, title: m.revision.numberOfRevisionEvents === 1 ? 'passaggio con revisione' : 'passaggi con revisione', context: `${formatInt(m.revision.paragraphsRewritten)} paragrafi modificati · ~${formatInt(m.writing.estimatedWordsRewritten)} parole riscritte`, onclick: () => ctx.setTab('versioni') })
      : null,
    o.knownGaps.length > 0
      ? callout({ id: 'gaps', kind: 'gap', count: o.knownGaps.length, title: o.knownGaps.length === 1 ? 'gap di osservazione' : 'gap di osservazione', context: gapTypes.join(' · '), onclick: () => ctx.setTab('copertura') })
      : null,
  ].filter((c): c is HTMLElement => c !== null);
  if (callouts.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessun grande inserimento, nessun passaggio con revisione, nessun gap di osservazione.'));
  else el.appendChild(h('div', { class: 'callouts' }, ...callouts));

  el.appendChild(h('div', { class: 'notice' }, h('strong', {}, 'Evidentia non dimostra chi abbia scritto un testo e non dimostra l\'uso di AI.'), ' Rende osservabile una parte del processo con cui il testo è stato prodotto, attraverso le versioni conservate dal server.'));
  return el;
}

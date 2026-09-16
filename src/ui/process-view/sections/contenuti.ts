/** Contenuti per fase: che cosa è comparso, cambiato o scomparso in ogni sessione. */
import type { Analysis } from '@/analysis';
import { h } from '@/ui/shared/dom';
import { formatInt } from '@/utils/text';
import { info, th } from '../widgets';

export function renderContenuti(an: Analysis): HTMLElement {
  const c = an.content;
  const sess = (i: number): string => `S${i + 1}`;
  const el = h('section', {});
  el.appendChild(h('h2', {}, 'Evoluzione dei contenuti per fase', info('phases')));
  el.appendChild(h('p', { class: 'muted' }, 'Le fasi coincidono con le sessioni. Per ogni fase: paragrafi del testo finale comparsi o rivisti, paragrafi eliminati senza ricomparire, sezioni cambiate (parole prima → dopo). Sono descritti i cambiamenti, non le loro cause.'));
  if (c.notes.length) el.appendChild(h('ul', {}, ...c.notes.map((n) => h('li', { class: 'muted' }, n))));
  if (c.basis === 'NONE') return el;
  for (const p of c.phases) {
    const box = h('div', { class: 'notice' }, h('div', {}, p.summary));
    const changed = p.sections.filter((x) => x.wordsAdded + x.wordsDeleted + x.paragraphsAdded + x.paragraphsDeleted + x.paragraphsModified > 0);
    if (c.hasSections && changed.length) {
      box.appendChild(
        h(
          'table',
          {},
          h('thead', {}, h('tr', {}, th('section'), th('wordsBeforeAfter'), th('sectionWordsAdded'), th('sectionWordsDeleted'), th('paragraphsPDM'))),
          h('tbody', {}, ...changed.map((x) => h('tr', {}, h('td', {}, x.section), h('td', {}, `${formatInt(x.wordsBefore)} → ${formatInt(x.wordsAfter)}`), h('td', {}, formatInt(x.wordsAdded)), h('td', {}, formatInt(x.wordsDeleted)), h('td', {}, `${x.paragraphsAdded}/${x.paragraphsDeleted}/${x.paragraphsModified}`)))),
        ),
      );
    }
    el.appendChild(box);
  }
  if (c.hasSections) {
    el.appendChild(h('h3', {}, `Sezioni del testo finale (${c.sections.length})`));
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('section'), th('sectionFinalWords'), th('sectionParagraphs'), th('firstSeen'), th('sessionsTouched'), th('wordsByPhase'))),
        h('tbody', {}, ...c.sections.map((x) => h('tr', {}, h('td', { style: `padding-left:${8 + Math.max(0, x.level - 1) * 14}px` }, x.section), h('td', {}, formatInt(x.finalWords)), h('td', {}, String(x.finalParagraphs)), h('td', {}, `v${x.firstSeenVersion} (${sess(x.firstSeenSession)})`), h('td', {}, x.sessionsTouched.map(sess).join(', ') || '–'), h('td', { class: 'mono' }, x.wordsByPhase.map((w) => `${sess(w.sessionIndex)}: ${formatInt(w.words)}`).join(' · '))))),
      ),
    );
  }
  el.appendChild(h('h3', {}, `Mappa del testo finale (${c.finalParagraphs.length} paragrafi)`));
  el.appendChild(h('p', { class: 'muted' }, 'Per ogni paragrafo: quando è comparso (versione e sessione), da quando non cambia più, quante varianti precedenti sono state trovate.'));
  el.appendChild(
    h(
      'table',
      {},
      h('thead', {}, h('tr', {}, th('position'), th('section'), th('paragraphWords'), th('firstSeen'), th('lastChanged'), th('variants'), th('incipit'))),
      h('tbody', {}, ...c.finalParagraphs.map((p) => h('tr', { style: p.isHeading ? 'font-weight:600' : '' }, h('td', {}, String(p.position + 1)), h('td', {}, p.section ?? '–'), h('td', {}, p.words === null ? '–' : String(p.words)), h('td', {}, `v${p.firstSeenVersion} (${sess(p.firstSeenSession)})`), h('td', {}, p.lastChangedIndex === p.firstSeenIndex ? '=' : `v${p.lastChangedVersion} (${sess(p.lastChangedSession)})`), h('td', {}, String(p.revisions)), h('td', {}, p.excerpt ?? '–')))),
    ),
  );
  el.appendChild(h('h3', {}, `Contenuto eliminato e non ripreso (${c.abandoned.length})`, info('abandoned')));
  if (c.abandoned.length === 0) el.appendChild(h('p', { class: 'muted' }, 'Nessun paragrafo eliminato definitivamente fra le versioni leggibili.'));
  else
    el.appendChild(
      h(
        'table',
        {},
        h('thead', {}, h('tr', {}, th('removedIn'), th('removedSession'), th('section'), th('paragraphWords'), th('presentSince'), th('excerpt'))),
        h('tbody', {}, ...c.abandoned.map((a) => h('tr', {}, h('td', {}, `v${a.removedVersion}`), h('td', {}, sess(a.removedSession)), h('td', {}, a.section ?? '–'), h('td', {}, a.words === null ? '–' : String(a.words)), h('td', {}, `v${a.firstSeenVersion}`), h('td', {}, a.excerpt ?? '–')))),
      ),
    );
  return el;
}

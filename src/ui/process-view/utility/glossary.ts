/** Glossario: ogni valore mostrato da Evidentia, con la sua definizione. */
import { GLOSSARY_GROUPS, KIND_LABEL, KIND_MEANING, term } from '@/analysis/glossary';
import { badge, h } from '@/ui/shared/dom';

export function renderGlossary(): HTMLElement {
  const el = h('section', { class: 'glossary' });
  el.appendChild(h('h2', {}, 'Glossario dei dati'));
  el.appendChild(h('p', { class: 'muted' }, 'Ogni valore mostrato da Evidentia è spiegato qui e nei tooltip (icona "i"). Le stesse definizioni sono incluse negli export.'));
  el.appendChild(h('ul', {}, ...(Object.keys(KIND_LABEL) as Array<keyof typeof KIND_LABEL>).map((k) => h('li', {}, h('strong', {}, KIND_LABEL[k]), `: ${KIND_MEANING[k]}.`))));
  for (const g of GLOSSARY_GROUPS) {
    el.appendChild(h('h3', {}, g.title));
    const dl = h('dl', {});
    for (const id of g.ids) {
      const e = term(id);
      dl.appendChild(h('dt', {}, e.label, badge(KIND_LABEL[e.kind], e.kind === 'stima' ? 'warn' : e.kind === 'osservato' ? 'ok' : '')));
      dl.appendChild(h('dd', {}, [e.meaning, e.method, e.use].filter(Boolean).join(' ')));
    }
    el.appendChild(dl);
  }
  return el;
}

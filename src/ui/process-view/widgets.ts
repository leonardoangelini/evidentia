/**
 * Mattoni condivisi dalle sezioni. Ogni valore mostrato porta l'icona "i" con
 * la definizione del glossario: la regola vale per card, intestazioni di
 * tabella, righe chiave-valore e richiami.
 */
import { explain, label as glossaryLabel, type GlossaryId } from '@/analysis/glossary';
import { h, type Child } from '@/ui/shared/dom';

/** Small "i" that shows the glossary definition on hover or keyboard focus. */
export function info(id: GlossaryId): HTMLElement {
  const text = explain(id);
  const flip = (e: Event): void => {
    const el = e.currentTarget as HTMLElement;
    el.classList.toggle('left', el.getBoundingClientRect().left + 340 > window.innerWidth);
  };
  return h('button', { class: 'info', type: 'button', 'data-tip': text, title: text, 'aria-label': `Spiegazione: ${glossaryLabel(id)}`, onmouseenter: flip, onfocus: flip }, 'i');
}

export function card(id: GlossaryId, value: string, opts: { label?: string; sub?: Child } = {}): HTMLElement {
  return h('div', { class: 'card' }, h('div', { class: 'v' }, value), h('div', { class: 'k' }, opts.label ?? glossaryLabel(id), info(id)), opts.sub ? h('div', { class: 'sub' }, opts.sub) : null);
}

export function th(id: GlossaryId, labelOverride?: string): HTMLElement {
  return h('th', {}, labelOverride ?? glossaryLabel(id), info(id));
}

export function kv(id: GlossaryId, value: Child): HTMLElement {
  return h('tr', {}, h('th', {}, glossaryLabel(id), info(id)), h('td', {}, value));
}

/** Link esterno: si apre in una scheda nuova e non passa il referrer. */
export function link(href: string, text: string): HTMLElement {
  return h('a', { href, target: '_blank', rel: 'noreferrer noopener' }, text);
}

/**
 * Richiamo della Panoramica: un conteggio, che cosa conta e una riga di
 * contesto; il click porta dove il dettaglio si guarda.
 */
export function callout(opts: { id: GlossaryId; kind: 'ins' | 'rev' | 'gap'; count: number; title: string; context: string; onclick: () => void }): HTMLElement {
  return h(
    'button',
    { class: `callout ${opts.kind}`, type: 'button', onclick: opts.onclick },
    h('div', { class: 'n' }, String(opts.count)),
    h('div', { class: 't' }, opts.title, info(opts.id)),
    h('div', { class: 'muted small' }, opts.context),
  );
}

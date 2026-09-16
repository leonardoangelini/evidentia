/**
 * Le viste della Process View: cinque schede di analisi nella barra in alto e
 * quattro viste di servizio raggiunte dai link in fondo alla barra laterale.
 * Tutte sono indirizzabili con l'hash dell'URL; gli hash delle vecchie schede
 * (fino alla 0.1.x) portano alla scheda che le ha assorbite.
 */
import { h } from '@/ui/shared/dom';

export type TabId = 'panoramica' | 'cronologia' | 'contenuti' | 'versioni' | 'copertura';
export type UtilityId = 'glossary' | 'settings' | 'about' | 'raw';
export type ViewId = TabId | UtilityId;

export const TABS: ReadonlyArray<readonly [TabId, string]> = [
  ['panoramica', 'Panoramica'],
  ['cronologia', 'Cronologia'],
  ['contenuti', 'Contenuti'],
  ['versioni', 'Versioni'],
  ['copertura', 'Copertura'],
];

export const UTILITIES: ReadonlyArray<readonly [UtilityId, string]> = [
  ['glossary', 'Glossario'],
  ['settings', 'Impostazioni'],
  ['about', 'Info'],
  ['raw', 'Dati grezzi'],
];

const VIEWS = new Set<string>([...TABS.map(([id]) => id), ...UTILITIES.map(([id]) => id)]);

/** Hash delle schede precedenti alla 0.2: ogni vecchia scheda ha una nuova casa. */
const ALIASES: Record<string, ViewId> = {
  overview: 'panoramica',
  timeline: 'cronologia',
  sessions: 'cronologia',
  time: 'cronologia',
  content: 'contenuti',
  versions: 'versioni',
  insertions: 'versioni',
  revisions: 'versioni',
  gaps: 'copertura',
};

export function parseHash(hash: string): ViewId {
  const key = hash.replace(/^#/, '');
  if (VIEWS.has(key)) return key as ViewId;
  return ALIASES[key] ?? 'panoramica';
}

export function isTab(view: ViewId): view is TabId {
  return TABS.some(([id]) => id === view);
}

export function viewLabel(view: ViewId): string {
  return [...TABS, ...UTILITIES].find(([id]) => id === view)?.[1] ?? '';
}

/** La barra delle schede; su una vista di servizio nessuna scheda è attiva e il nome compare a destra. */
export function renderTabBar(current: ViewId, onSelect: (tab: TabId) => void): HTMLElement {
  return h(
    'nav',
    { class: 'tabs' },
    ...TABS.map(([id, label]) => h('button', { class: current === id ? 'active' : '', onclick: () => onSelect(id) }, label)),
    isTab(current) ? null : h('span', { class: 'tabs-current' }, viewLabel(current)),
  );
}

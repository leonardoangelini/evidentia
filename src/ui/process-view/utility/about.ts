/**
 * Scheda Info: che cos'è Evidentia, che cosa è cambiato, chi la fa. Le note
 * di versione vengono da CHANGELOG.md incluso nel pacchetto, quindi si
 * leggono anche senza rete, come tutto il resto dell'estensione.
 */
import { h, type Child } from '@/ui/shared/dom';
import { logoMark } from '@/ui/shared/logo';
import { changelog, entryFor, inlineSegments, type ChangelogEntry } from '@/utils/changelog';
import { getExtensionVersion, getVersionLabel } from '@/utils/version';
import { link } from '../widgets';

/** Repository pubblico: l'unica fonte di codice, licenza, privacy e segnalazioni. */
const REPO_URL = 'https://github.com/leonardoangelini/evidentia';

/** Una voce del changelog, con il poco markdown che usa reso in DOM. */
function entryLine(text: string): Child[] {
  return inlineSegments(text).map((seg) => (seg.style === 'strong' ? h('strong', {}, seg.text) : seg.style === 'code' ? h('code', { class: 'mono' }, seg.text) : seg.text));
}

function changes(entry: ChangelogEntry): HTMLElement {
  return h('div', {}, entry.intro ? h('p', {}, ...entryLine(entry.intro)) : null, entry.changes.length > 0 ? h('ul', {}, ...entry.changes.map((c) => h('li', {}, ...entryLine(c)))) : null);
}

export function renderAbout(): HTMLElement {
  const el = h('section', { class: 'about' });
  const entries = changelog();
  // Sul canale testing la version del manifest ha una quarta componente:
  // l'etichetta la mostra per intero, le note vengono dalla release di base.
  const current = entryFor(getExtensionVersion(), entries);

  el.appendChild(h('div', { class: 'about-head' }, logoMark(40), h('div', {}, h('div', { class: 'about-name' }, 'EVIDENTIA'), h('div', { class: 'muted' }, `versione ${getVersionLabel()}`))));
  el.appendChild(h('p', { class: 'lead' }, 'Rende visibile il processo con cui un testo è stato scritto, a partire dalla cronologia delle versioni che il server conserva già — Word su SharePoint e OneDrive, Google Docs attraverso le revisioni di Google Drive.'));
  el.appendChild(h('div', { class: 'notice' }, h('strong', {}, 'Evidentia non è un rilevatore di AI.'), ' Non dimostra chi abbia scritto un testo e non dimostra l\'uso di un modello linguistico. Mostra che cosa il server ha conservato del percorso di scrittura, e dichiara accanto ciò che non può mostrare. Il tempo è sempre una stima, mai un\'osservazione.'));

  el.appendChild(h('h2', {}, 'Novità di questa versione'));
  if (current) el.appendChild(changes(current));
  else el.appendChild(h('p', { class: 'muted' }, 'Questa build non ha note di versione: è una build di sviluppo, costruita fra una release e l\'altra.'));

  const previous = entries.filter((e) => e !== current);
  if (previous.length > 0) {
    el.appendChild(h('h2', {}, 'Versioni precedenti'));
    for (const e of previous) {
      el.appendChild(h('details', {}, h('summary', {}, `${e.version}${e.date ? ` — ${e.date}` : ''}`), changes(e)));
    }
  }

  el.appendChild(h('h2', {}, 'Progetto'));
  const dl = h('dl', {});
  dl.appendChild(h('dt', {}, 'Autore'));
  dl.appendChild(h('dd', {}, 'Leonardo Angelini — ', link('https://www.linkedin.com/in/leonardoangelini/', 'LinkedIn')));
  dl.appendChild(h('dt', {}, 'Codice'));
  dl.appendChild(h('dd', {}, link(REPO_URL, 'github.com/leonardoangelini/evidentia'), ' — software libero, licenza ', link(`${REPO_URL}/blob/main/LICENSE`, 'Apache 2.0')));
  dl.appendChild(h('dt', {}, 'Segnalazioni'));
  dl.appendChild(h('dd', {}, 'Un problema o una proposta: ', link(`${REPO_URL}/issues`, 'Issues del repository'), '.'));
  dl.appendChild(h('dt', {}, 'Privacy'));
  dl.appendChild(h('dd', {}, 'I documenti e le analisi restano in questo browser. Nessun server di Evidentia, nessuna telemetria. ', link(`${REPO_URL}/blob/main/PRIVACY.md`, 'Informativa completa'), '.'));
  el.appendChild(dl);

  return el;
}

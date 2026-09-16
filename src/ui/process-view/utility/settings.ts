/** Impostazioni: privacy, soglie di analisi, Google, identificativi, dati. */
import type { Settings } from '@/models';
import { h } from '@/ui/shared/dom';
import type { ViewContext } from '../context';

export function renderSettings(ctx: ViewContext): HTMLElement {
  const s = ctx.state.settings;
  const el = h('section', {});
  el.appendChild(h('h2', {}, 'Impostazioni'));
  const privacy = h('select', {}, h('option', { value: 'FULL', selected: s.privacyMode === 'FULL' }, 'FULL — salva il testo delle versioni e i nomi degli autori'), h('option', { value: 'METRICS_ONLY', selected: s.privacyMode === 'METRICS_ONLY' }, 'METRICS_ONLY — solo conteggi, hash ed etichette pseudonime')) as HTMLSelectElement;
  const gap = h('input', { type: 'number', min: 5, max: 720, value: s.sessionGapMinutes }) as HTMLInputElement;
  const large = h('input', { type: 'number', min: 50, max: 10000, value: s.largeInsertionWords }) as HTMLInputElement;
  const longGap = h('input', { type: 'number', min: 1, max: 720, value: s.longIntervalHours }) as HTMLInputElement;
  const leadIn = h('input', { type: 'number', min: 0, max: 60, value: s.sessionLeadInMinutes }) as HTMLInputElement;
  const maxV = h('input', { type: 'number', min: 10, max: 5000, value: s.maxVersions }) as HTMLInputElement;
  const googleClientId = h('input', { type: 'text', value: s.googleClientId, placeholder: 'xxxxxxxx.apps.googleusercontent.com (vuoto: usa quello incluso nella build, se presente)', spellcheck: 'false' }) as HTMLInputElement;
  const studentId = h('input', { type: 'text', value: s.student.studentId ?? '', placeholder: 'pseudonimo, es. studente-17' }) as HTMLInputElement;
  const assignmentId = h('input', { type: 'text', value: s.student.assignmentId ?? '', placeholder: 'es. saggio-1' }) as HTMLInputElement;
  const courseId = h('input', { type: 'text', value: s.student.courseId ?? '', placeholder: 'es. PED-101' }) as HTMLInputElement;
  const save = (): Promise<void> => {
    const next: Settings = {
      ...s,
      privacyMode: privacy.value as Settings['privacyMode'],
      sessionGapMinutes: clamp(Number(gap.value), 5, 720),
      largeInsertionWords: clamp(Number(large.value), 50, 10000),
      longIntervalHours: clamp(Number(longGap.value), 1, 720),
      sessionLeadInMinutes: clamp(Number(leadIn.value), 0, 60),
      maxVersions: clamp(Number(maxV.value), 10, 5000),
      googleClientId: googleClientId.value.trim(),
      student: { studentId: studentId.value.trim() || undefined, assignmentId: assignmentId.value.trim() || undefined, courseId: courseId.value.trim() || undefined },
    };
    return ctx.saveSettings(next);
  };
  el.append(
    h('label', {}, 'Modalità privacy (fissata alla prima analisi di ciascun documento)'), privacy,
    h('label', {}, 'Nuova sessione dopo un intervallo fra versioni di (minuti)'), gap,
    h('label', {}, 'Grande inserimento: aumento di almeno (parole)'), large,
    h('label', {}, 'Intervallo fra versioni segnalato come gap dopo (ore)'), longGap,
    h('label', {}, 'Stima del tempo: margine di avvio per sessione (minuti, lavoro prima della prima versione salvata)'), leadIn,
    h('label', {}, 'Numero massimo di versioni da scaricare'), maxV,
    h('h3', {}, 'Google Docs'),
    h('label', {}, 'Client ID OAuth 2.0 (progetto Google Cloud della scuola; redirect URI ' + googleRedirectUrl() + ')'), googleClientId,
    h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => void ctx.disconnectGoogle() }, 'Disconnetti Google e revoca il permesso'), h('span', { class: 'muted small' }, 'Dimentica l\'autorizzazione e ritira l\'accesso a googleapis.com / docs.google.com fino alla prossima analisi di un documento Google.')),
    h('h3', {}, 'Identificativi opzionali (preferisci pseudonimi)'),
    h('label', {}, 'Student ID / pseudonimo'), studentId,
    h('label', {}, 'Assignment ID'), assignmentId,
    h('label', {}, 'Course ID'), courseId,
    h('div', { class: 'row', style: 'margin-top:16px' }, h('button', { class: 'primary', onclick: () => void save() }, 'Salva impostazioni')),
    h('h3', {}, 'Dati'),
    h('div', { class: 'row' }, h('button', { class: 'danger', onclick: () => void ctx.deleteAll() }, 'Elimina tutti i dati'), h('span', { class: 'muted small' }, 'Cancella ogni documento analizzato e ogni versione conservata in questo browser. Le impostazioni restano.')),
    h('div', { class: 'notice' }, h('strong', {}, 'Privacy.'), ' Tutti i dati restano nel browser. Le versioni sono lette in sola lettura: con la tua sessione Microsoft 365 per SharePoint/OneDrive, con la tua autorizzazione Google (Drive API) per Google Docs. Nessun server, nessuna telemetria, nessuna API AI. L\'unico modo in cui i dati escono è l\'export avviato da te.'),
  );
  return el;
}

function googleRedirectUrl(): string {
  try {
    return chrome.identity.getRedirectURL();
  } catch {
    return 'https://<id-estensione>.chromiumapp.org/';
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}

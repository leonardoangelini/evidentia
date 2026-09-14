/**
 * Self-contained HTML report readable without a server.
 */
import type { Analysis } from '@/analysis';
import { documentProvider, providerName, sourceLabel, type DocumentDataset } from '@/models';
import { formatDateTime, formatDuration, parseIso } from '@/utils/time';
import { formatInt } from '@/utils/text';
import { GLOSSARY_GROUPS, KIND_LABEL, KIND_MEANING, explain, label as glossaryLabel, term, type GlossaryId } from '@/analysis/glossary';
import { LOGO_MONO_SVG } from '@/ui/shared/logo';

const FOOTER_NOTICE =
  'Questo report descrive esclusivamente il processo osservato attraverso le versioni conservate dal server (SharePoint/OneDrive o Google Drive). Non dimostra l\'origine del testo e non costituisce un sistema di rilevamento dell\'utilizzo di intelligenza artificiale.';

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

/** Inline "i" with the glossary definition on hover/focus. */
type GlossaryKindKey = keyof typeof KIND_LABEL;

function info(id: GlossaryId): string {
  return `<span class="info" tabindex="0" data-tip="${esc(explain(id))}" title="${esc(explain(id))}">i</span>`;
}
function th(id: GlossaryId, labelOverride?: string): string {
  return `<th>${esc(labelOverride ?? glossaryLabel(id))}${info(id)}</th>`;
}
function k(id: GlossaryId, labelOverride?: string): string {
  return `${esc(labelOverride ?? glossaryLabel(id))}${info(id)}`;
}

export function buildHtmlReport(dataset: DocumentDataset, analysis: Analysis, generatedAt: string): string {
  const { metrics: m, sessions, observation: o, majorTransitions } = analysis;
  const doc = dataset.document;
  const snapshots = [...dataset.snapshots].sort((a, b) => a.index - b.index);
  const byId = new Map(snapshots.map((s) => [s.id, s]));
  const large = [...dataset.diffs].filter((d) => d.wordCountDelta >= m.insertions.thresholdWords).sort((a, b) => a.toIndex - b.toIndex);
  const revisions = [...dataset.diffs].filter((d) => d.classification !== 'UNCHANGED' && d.classification !== 'ADDING' && d.classification !== 'UNKNOWN').sort((a, b) => a.toIndex - b.toIndex);
  const authors = doc.authors.map((a) => `${a.label}${a.displayName ? ` (${esc(a.displayName)})` : ''}: ${a.versions} versioni`).join(' · ');

  const overviewRows: Array<[string, string]> = [
    ['Documento', esc(doc.name || '(senza nome)')],
    ['Sito', esc(doc.host)],
    ['Modalità privacy', esc(doc.privacyMode)],
    ['Creato / ultima modifica', `${doc.timeCreated ? formatDateTime(doc.timeCreated) : '–'} / ${doc.timeLastModified ? formatDateTime(doc.timeLastModified) : '–'}`],
    [k('versions'), `${m.versions.numberOfVersions} (${m.versions.numberOfReadableVersions} leggibili) dal ${m.versions.firstVersionAt ? formatDateTime(m.versions.firstVersionAt) : '–'} al ${m.versions.lastVersionAt ? formatDateTime(m.versions.lastVersionAt) : '–'}`],
    [`${k('calendarSpan')} · ${k('medianInterval')}`, `${formatDuration(m.versions.totalSpanMs)} · intervallo mediano fra versioni ${m.versions.medianIntervalMs === null ? '–' : formatDuration(m.versions.medianIntervalMs)}`],
    [k('authors', 'Autori delle versioni'), authors || '–'],
    [k('sessions', 'Sessioni (versioni vicine nel tempo)'), `${m.sessions.numberOfSessions} (media ${formatDuration(m.sessions.averageSessionSpanMs)}, max ${formatDuration(m.sessions.longestSessionSpanMs)}; ${m.sessions.singleVersionSessions} con una sola versione)`],
    [k('finalWords'), `${formatInt(m.document.finalWordCount)} (${formatInt(m.document.finalParagraphCount)} paragrafi)`],
    [k('firstVersionWords'), m.versions.firstVersionWordCount === null ? '–' : `${formatInt(m.versions.firstVersionWordCount)} parole`],
    [`Parole aggiunte${info('wordsAdded')} / eliminate${info('wordsDeleted')} / riscritte${info('wordsRewritten')} (stima)`, `+${formatInt(m.writing.estimatedWordsAdded)} / −${formatInt(m.writing.estimatedWordsDeleted)} / ~${formatInt(m.writing.estimatedWordsRewritten)}`],
    [k('largeInsertions'), `${m.insertions.numberOfLargeInsertions} (soglia ${m.insertions.thresholdWords} parole; il più grande ${formatInt(m.insertions.largestInsertionWords)} parole)`],
    [k('revisions'), `${m.revision.numberOfRevisionEvents} passaggi con revisione, ${m.revision.paragraphsRewritten} paragrafi modificati, intensità ${m.revision.revisionIntensity}`],
    [k('afterFirstDraft', 'Quota di versioni dopo la prima bozza completa'), m.revision.proportionOfVersionsAfterFirstCompleteDraft === null ? 'non determinabile' : `${Math.round(m.revision.proportionOfVersionsAfterFirstCompleteDraft * 100)}%`],
    [k('chain'), analysis.chain.valid ? `valida (${analysis.chain.checked} eventi)` : `NON valida dall'evento ${analysis.chain.firstBrokenSeq}`],
  ];
  if (doc.student && Object.values(doc.student).some(Boolean)) overviewRows.splice(1, 0, ['Identificativi (pseudonimi)', esc([doc.student.studentId, doc.student.assignmentId, doc.student.courseId].filter(Boolean).join(' · '))]);

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Evidentia — Writing Process Report — ${esc(doc.name)}</title>
<style>
  :root{--fg:#1f2937;--muted:#6b7280;--line:#e5e7eb;--bg:#fff;--accent:#1d4ed8;--warn:#b45309;--ins:#b91c1c;--rev:#7c3aed}
  body{font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--fg);background:var(--bg);margin:0;padding:32px 24px;max-width:1000px;margin-inline:auto}
  h1{font-size:26px;margin:0 0 4px}h2{font-size:19px;margin:36px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}h3{font-size:15px;margin:20px 0 8px}
  .sub{color:var(--muted);margin-bottom:24px}
  table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600;white-space:nowrap}
  .kv th{width:38%}
  .notice{border:1px solid var(--line);border-left:4px solid var(--accent);padding:12px 16px;border-radius:6px;background:#f8fafc;margin-top:36px}
  .gap{border-left:4px solid var(--warn);padding:8px 12px;margin:8px 0;background:#fffbeb;border-radius:4px}
  .muted{color:var(--muted)}.mono{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
  blockquote{margin:4px 0;padding:6px 10px;background:#f3f4f6;border-radius:4px;font-size:13px;white-space:pre-wrap}
  .del{border-left:3px solid var(--ins)}.add{border-left:3px solid #15803d}
  svg text{font-family:system-ui,sans-serif}
  .legend span{display:inline-block;margin-right:14px;font-size:12px}.legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}
  ul.lim{font-size:13px;color:var(--muted)}
  .phase{border-left:4px solid #dbeafe;padding:4px 12px;margin:10px 0}
  .info{display:inline-flex;align-items:center;justify-content:center;width:15px;height:15px;margin-left:5px;border-radius:50%;border:1px solid var(--muted);color:var(--muted);background:#fff;font:600 10px/1 system-ui,sans-serif;cursor:help;vertical-align:middle;position:relative}
  .info:hover,.info:focus{border-color:var(--accent);color:var(--accent);outline:none}
  .info::after{content:attr(data-tip);position:absolute;left:0;top:20px;z-index:20;width:320px;max-width:70vw;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:#fff;color:var(--fg);font:400 12px/1.45 system-ui,sans-serif;text-align:left;white-space:normal;box-shadow:0 6px 20px rgba(0,0,0,.12);display:none}
  .info:hover::after,.info:focus::after{display:block}.info.left::after{left:auto;right:0}
  .badge{display:inline-block;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;background:var(--line);color:var(--muted)}
  dl.glossary dt{font-weight:600;margin-top:8px}dl.glossary dd{margin:2px 0 0 0;font-size:13px}
  @media print{.info::after{display:none!important}}
  @media print{body{padding:0}}
</style>
</head>
<body>
<h1 style="display:flex;align-items:center;gap:10px"><span style="color:var(--accent);display:inline-flex">${LOGO_MONO_SVG.replace('width="20" height="20"', 'width="28" height="28"')}</span>Evidentia — Writing Process Report</h1>
<div class="sub">${esc(doc.name || '(senza nome)')} · ${esc(sourceLabel(doc))} · generato il ${formatDateTime(generatedAt)} · Evidentia v${esc(doc.extensionVersion)}</div>

<h2>Overview</h2>
<table class="kv">${overviewRows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>

<h2>Process Timeline${info('chart')}</h2>
${wordCountChart(dataset, analysis)}
<table>
<thead><tr>${th('timelineTime')}${th('timelineEvent')}${th('timelineDetail')}</tr></thead>
<tbody>
${analysis.timeline.map((t) => `<tr><td class="mono">${formatDateTime(t.time)}</td><td>${esc(t.type)}</td><td>${esc(timelineDetail(t))}</td></tr>`).join('\n')}
</tbody></table>

<h2>Versions</h2>
<table><thead><tr>${th('versionIndex')}${th('versionLabel')}${th('versionDate')}${th('versionAuthor')}${th('versionWords')}${th('versionDelta')}${th('versionParagraphs')}${th('versionStatus')}</tr></thead><tbody>
${snapshots.map((s, i) => { const prev = snapshots.slice(0, i).reverse().find((p) => p.extractionStatus !== 'UNAVAILABLE'); const un = s.extractionStatus === 'UNAVAILABLE'; const delta = !un && prev ? s.wordCount - prev.wordCount : null; return `<tr><td>${s.index}</td><td>${esc(s.versionLabel)}${s.isCurrent ? ' (corrente)' : ''}</td><td class="mono">${formatDateTime(s.timestamp)}</td><td>${esc(s.authorLabel ?? '–')}</td><td>${un ? '–' : formatInt(s.wordCount)}</td><td>${delta === null ? '–' : `${delta >= 0 ? '+' : ''}${formatInt(delta)}`}</td><td>${un ? '–' : s.paragraphCount}</td><td>${esc(s.extractionStatus)}${s.extractionNotes.length ? ` <span class="muted">${esc(s.extractionNotes.join('; '))}</span>` : ''}</td></tr>`; }).join('\n')}
</tbody></table>

<h2>Sessions</h2>
<p class="muted">Gruppi di versioni salvate a meno di ${analysis.options.sessionGapMinutes} minuti l'una dall'altra. Indicano quando il documento è stato salvato, non quanto tempo è stato dedicato.</p>
<table><thead><tr>${th('sessionIndex')}${th('sessionStart')}${th('sessionEnd')}${th('sessionSpan')}${th('sessionVersions')}${th('sessionWords')}${th('sessionAuthors')}</tr></thead><tbody>
${sessions.map((s) => `<tr><td>${s.index + 1}</td><td class="mono">${formatDateTime(s.startedAt)}</td><td class="mono">${formatDateTime(s.endedAt)}</td><td>${s.versionCount > 1 ? formatDuration(s.spanMs) : '–'}</td><td>${s.versionCount}</td><td>${s.wordCountStart ?? '–'} → ${s.wordCountEnd ?? '–'}</td><td>${esc(s.authorLabels.join(', ') || '–')}</td></tr>`).join('\n')}
</tbody></table>

<h2>Major Transitions${info('majorTransitions')}</h2>
${majorTransitions.length === 0 ? '<p class="muted">Nessuna transizione di rilievo fra versioni consecutive.</p>' : `<table><thead><tr>${th('versionLabel', 'Versioni')}${th('interval')}${th('versionWords')}${th('variation')}${th('paragraphsPDM', 'Paragrafi +/−/mod')}${th('diffType')}${th('versionAuthor')}</tr></thead><tbody>
${majorTransitions.map((t) => `<tr><td>${esc(t.fromVersion)} → ${esc(t.toVersion)}</td><td>${t.elapsedMinutes} min</td><td>${formatInt(t.wordsBefore)} → ${formatInt(t.wordsAfter)}</td><td>${t.netChange >= 0 ? '+' : ''}${formatInt(t.netChange)}</td><td>${t.addedParagraphs}/${t.deletedParagraphs}/${t.modifiedParagraphs}</td><td>${esc(t.classification)}</td><td>${esc(t.author ?? '–')}</td></tr>`).join('\n')}
</tbody></table>`}

<h2>Large Insertions${info('largeInsertions')}</h2>
${large.length === 0 ? `<p class="muted">Nessun aumento di almeno ${m.insertions.thresholdWords} parole fra due versioni consecutive.</p>` : `<table><thead><tr>${th('versionLabel', 'Versioni')}${th('versionDate', 'Ora')}${th('interval')}${th('variation', 'Parole')}${th('insertionParagraphs')}${th('excerpt')}</tr></thead><tbody>
${large.map((d) => { const to = byId.get(d.toSnapshotId); const from = byId.get(d.fromSnapshotId); return `<tr><td>${esc(from?.versionLabel ?? '')} → ${esc(to?.versionLabel ?? '')}</td><td class="mono">${formatDateTime(to?.timestamp ?? generatedAt)}</td><td>${formatDuration(d.elapsedMs)}</td><td>+${formatInt(d.wordCountDelta)}</td><td>${d.paragraphsAdded}</td><td>${d.addedBlocks.slice(0, 2).map((b) => `<blockquote class="add">${esc(b.excerpt)}</blockquote>`).join('') || '<span class="muted">testo non registrato</span>'}</td></tr>`; }).join('\n')}
</tbody></table>
<p class="muted">Un grande inserimento fra due versioni è solo un grande inserimento: fra una versione e l'altra non è osservato nulla, e la provenienza del testo non è determinabile.</p>`}

<h2>Revision Activity</h2>
${revisions.length === 0 ? '<p class="muted">Nessun passaggio con cancellazioni o riscritture rilevanti.</p>' : `<table><thead><tr>${th('versionLabel', 'Versioni')}${th('versionDate', 'Ora')}${th('diffType')}${th('diffAdded')}${th('diffDeleted')}${th('diffReplaced')}${th('paragraphsRewritten', 'Paragrafi mod.')}${th('excerpt', 'Estratti')}</tr></thead><tbody>
${revisions.map((d) => `<tr><td>${esc(byId.get(d.fromSnapshotId)?.versionLabel ?? '')} → ${esc(byId.get(d.toSnapshotId)?.versionLabel ?? '')}</td><td class="mono">${formatDateTime(byId.get(d.toSnapshotId)?.timestamp ?? generatedAt)}</td><td>${esc(d.classification)}</td><td>${d.wordsAdded}</td><td>${d.wordsDeleted}</td><td>${d.wordsReplaced}</td><td>${d.paragraphsModified}</td><td>${d.deletedBlocks.slice(0, 2).map((b) => `<blockquote class="del">− ${esc(b.excerpt)}</blockquote>`).join('')}${d.addedBlocks.slice(0, 2).map((b) => `<blockquote class="add">+ ${esc(b.excerpt)}</blockquote>`).join('')}</td></tr>`).join('\n')}
</tbody></table>`}

<h2>Tempo stimato e ritmo${info('estimatedActiveTotal')}</h2>
${timeSection(analysis)}

<h2>Evoluzione dei contenuti per fase${info('phases')}</h2>
${contentSection(analysis)}

<h2>Observation Coverage</h2>
<table class="kv">
<tr><th>${k('source')}</th><td>${esc(capitalize(sourceLabel(doc)))} (${o.versionsOnServer} versioni sul server, ${o.versionsStored} lette, ${o.versionsReadable} con testo)</td></tr>
<tr><th>${k('firstLast')}</th><td>${o.firstVersionAt ? formatDateTime(o.firstVersionAt) : '–'} / ${o.lastVersionAt ? formatDateTime(o.lastVersionAt) : '–'}</td></tr>
<tr><th>${k('lastAnalyzed')}</th><td>${o.lastAnalyzedAt ? formatDateTime(o.lastAnalyzedAt) : '–'}</td></tr>
</table>
<h3>Gap noti (${o.knownGaps.length})${info('gaps')}</h3>
${o.knownGaps.length === 0 ? '<p class="muted">Nessun gap rilevato.</p>' : o.knownGaps.map((g) => `<div class="gap"><strong>${esc(g.type)}</strong> · ${formatDateTime(g.from)}${g.to ? ` → ${formatDateTime(g.to)}` : ''}${g.durationMs !== null ? ` (${formatDuration(g.durationMs)})` : ''}<br>${esc(g.description)}</div>`).join('')}
<h3>Versioni non leggibili (${o.extractionFailures.length})${info('extractionFailures')}</h3>
${o.extractionFailures.length === 0 ? '<p class="muted">Tutte le versioni sono state lette.</p>' : `<ul>${o.extractionFailures.map((f) => `<li class="mono">${formatDateTime(f.at)} — versione ${esc(f.versionLabel)}: ${esc(f.reason)}</li>`).join('')}</ul>`}
<h3>Avvisi (${o.continuityWarnings.length})${info('warnings')}</h3>
${o.continuityWarnings.length === 0 ? '<p class="muted">Nessuno.</p>' : `<ul>${o.continuityWarnings.map((w) => `<li class="mono">${formatDateTime(w.at)} — ${esc(w.type)}: ${esc(w.description)}</li>`).join('')}</ul>`}
<h3>Limiti strutturali${info('limitations')}</h3>
<ul class="lim">${o.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>

<h2>Glossario dei dati</h2>
<p class="muted">Ogni valore del report è spiegato qui e nei tooltip (icona "i"). ${(Object.keys(KIND_LABEL) as GlossaryKindKey[]).map((kk) => `<strong>${KIND_LABEL[kk]}</strong>: ${esc(KIND_MEANING[kk])}`).join('. ')}.</p>
${GLOSSARY_GROUPS.map((g) => `<h3>${esc(g.title)}</h3><dl class="glossary">${g.ids.map((id) => { const e = term(id); return `<dt>${esc(e.label)} <span class="badge">${KIND_LABEL[e.kind]}</span></dt><dd>${esc([e.meaning, e.method, e.use].filter(Boolean).join(' '))}</dd>`; }).join('')}</dl>`).join('\n')}

<script>for(const el of document.querySelectorAll('.info')){const f=()=>el.classList.toggle('left',el.getBoundingClientRect().left+340>window.innerWidth);el.addEventListener('mouseenter',f);el.addEventListener('focus',f);}</script>
<div class="notice"><strong>${esc(FOOTER_NOTICE)}</strong><br><span class="muted">La hash chain degli eventi rileva alterazioni accidentali del dataset esportato; non è una protezione forense.</span></div>
</body></html>`;
}

function timeSection(analysis: Analysis): string {
  const t = analysis.time;
  const rate = (n: number | null): string => (n === null ? '–' : formatInt(n));
  const kv: Array<[string, string]> = [
    [k('estimatedActiveTotal', 'Metodo'), `somma degli archi delle sessioni + ${t.leadInMinutes} min di avvio per sessione; parole/ora solo su sessioni con almeno ${t.minSessionForRateMinutes} min stimati`],
    [`${k('calendarSpan', 'Arco di calendario')} · ${k('daysWithVersions')}`, `${formatDuration(t.calendarSpanMs)} · ${t.daysWithVersions} giornate con versioni`],
    [`${k('observedTotal')} / ${k('estimatedActiveTotal', 'attivo stimato')}`, `${formatDuration(t.observedTotalMs)} / ${formatDuration(t.estimatedActiveTotalMs)}`],
    [`Parole per ora (stima): nette${info('wordsPerHourNet')} · aggiunte${info('wordsPerHourAdded')} · mediana${info('medianSessionRate')}`, `nette ${rate(t.wordsPerHourNet)} · aggiunte ${rate(t.wordsPerHourAdded)} · mediana per sessione ${rate(t.medianSessionWordsPerHourNet)}`],
    [k('maxIntervalRate'), t.maxIntervalRate ? `${esc(t.maxIntervalRate.fromVersion)} → ${esc(t.maxIntervalRate.toVersion)}: ${formatInt(t.maxIntervalRate.netWords)} parole nette in ${formatDuration(t.maxIntervalRate.elapsedMs)} (${formatInt(t.maxIntervalRate.wordsPerHourNet)} parole/ora)` : '–'],
  ];
  return `<p class="muted">Stime derivate dai soli orari delle versioni: il tempo attivo non è osservato.</p>
<table class="kv">${kv.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</table>
<h3>Per sessione</h3>
<table><thead><tr>${th('sessionIndex')}${th('sessionStart')}${th('sessionEnd')}${th('sessionVersions')}${th('observedSpan')}${th('leadIn')}${th('estimatedActive')}${th('netWords')}${th('plusMinus')}${th('wordsPerHour')}</tr></thead><tbody>
${t.sessions.map((s) => `<tr><td>${s.sessionIndex + 1}</td><td class="mono">${formatDateTime(s.startedAt)}</td><td class="mono">${s.versionCount > 1 ? formatDateTime(s.endedAt) : '–'}</td><td>${s.versionCount}</td><td>${s.versionCount > 1 ? formatDuration(s.observedSpanMs) : '0'}</td><td>${formatDuration(s.leadInMs)}</td><td>${formatDuration(s.estimatedActiveMs)}</td><td>${s.netWords >= 0 ? '+' : ''}${formatInt(s.netWords)}${s.includesFirstVersionContent ? '' : ' *'}</td><td>+${formatInt(s.wordsAdded)} / −${formatInt(s.wordsDeleted)}</td><td>${rate(s.wordsPerHourNet)}</td></tr>`).join('\n')}
</tbody></table>
<p class="muted">* Prima sessione: il contenuto della prima versione disponibile non è attribuito (scritto prima dell'osservazione).</p>
<h3>Per giornata</h3>
<table><thead><tr>${th('day')}${th('daySessions')}${th('dayVersions')}${th('estimatedActive')}${th('netWords')}${th('plusMinus')}${th('sessionAuthors')}</tr></thead><tbody>
${t.days.map((d) => `<tr><td class="mono">${esc(d.date)}</td><td>${d.sessions}</td><td>${d.versions}</td><td>${formatDuration(d.estimatedActiveMs)}</td><td>${d.netWords >= 0 ? '+' : ''}${formatInt(d.netWords)}</td><td>+${formatInt(d.wordsAdded)} / −${formatInt(d.wordsDeleted)}</td><td>${esc(d.authorLabels.join(', ') || '–')}</td></tr>`).join('\n')}
</tbody></table>
<ul class="lim">${t.caveats.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
}

function contentSection(analysis: Analysis): string {
  const c = analysis.content;
  const sess = (i: number): string => `S${i + 1}`;
  if (c.basis === 'NONE') return `<p class="muted">${esc(c.notes.join(' '))}</p>`;
  const phases = c.phases.map((p) => {
    const changed = p.sections.filter((x) => x.wordsAdded + x.wordsDeleted + x.paragraphsAdded + x.paragraphsDeleted + x.paragraphsModified > 0);
    const table = c.hasSections && changed.length ? `<table><thead><tr>${th('section')}${th('wordsBeforeAfter')}${th('sectionWordsAdded')}${th('sectionWordsDeleted')}${th('paragraphsPDM')}</tr></thead><tbody>${changed.map((x) => `<tr><td>${esc(x.section)}</td><td>${formatInt(x.wordsBefore)} → ${formatInt(x.wordsAfter)}</td><td>${formatInt(x.wordsAdded)}</td><td>${formatInt(x.wordsDeleted)}</td><td>${x.paragraphsAdded}/${x.paragraphsDeleted}/${x.paragraphsModified}</td></tr>`).join('')}</tbody></table>` : '';
    return `<div class="phase"><p>${esc(p.summary)}</p>${table}</div>`;
  }).join('\n');
  const sections = c.hasSections ? `<h3>Sezioni del testo finale (${c.sections.length})</h3>
<table><thead><tr>${th('section')}${th('sectionFinalWords')}${th('sectionParagraphs')}${th('firstSeen')}${th('sessionsTouched')}${th('wordsByPhase')}</tr></thead><tbody>
${c.sections.map((x) => `<tr><td style="padding-left:${8 + Math.max(0, x.level - 1) * 14}px">${esc(x.section)}</td><td>${formatInt(x.finalWords)}</td><td>${x.finalParagraphs}</td><td>v${esc(x.firstSeenVersion)} (${sess(x.firstSeenSession)})</td><td>${x.sessionsTouched.map(sess).join(', ') || '–'}</td><td class="mono">${x.wordsByPhase.map((w) => `${sess(w.sessionIndex)}: ${formatInt(w.words)}`).join(' · ')}</td></tr>`).join('\n')}
</tbody></table>` : '';
  const map = `<h3>Mappa del testo finale (${c.finalParagraphs.length} paragrafi)</h3>
<p class="muted">Per ogni paragrafo: quando è comparso (versione e sessione), da quando non cambia più, quante varianti precedenti sono state trovate.</p>
<table><thead><tr>${th('position')}${th('section')}${th('paragraphWords')}${th('firstSeen')}${th('lastChanged')}${th('variants')}${th('incipit')}</tr></thead><tbody>
${c.finalParagraphs.map((p) => `<tr${p.isHeading ? ' style="font-weight:600"' : ''}><td>${p.position + 1}</td><td>${esc(p.section ?? '–')}</td><td>${p.words ?? '–'}</td><td>v${esc(p.firstSeenVersion)} (${sess(p.firstSeenSession)})</td><td>${p.lastChangedIndex === p.firstSeenIndex ? '=' : `v${esc(p.lastChangedVersion)} (${sess(p.lastChangedSession)})`}</td><td>${p.revisions}</td><td>${esc(p.excerpt ?? '–')}</td></tr>`).join('\n')}
</tbody></table>`;
  const abandoned = `<h3>Contenuto eliminato e non ripreso (${c.abandoned.length})${info('abandoned')}</h3>
${c.abandoned.length === 0 ? '<p class="muted">Nessun paragrafo eliminato definitivamente fra le versioni leggibili.</p>' : `<table><thead><tr>${th('removedIn')}${th('removedSession')}${th('section')}${th('paragraphWords')}${th('presentSince')}${th('excerpt')}</tr></thead><tbody>${c.abandoned.map((a) => `<tr><td>v${esc(a.removedVersion)}</td><td>${sess(a.removedSession)}</td><td>${esc(a.section ?? '–')}</td><td>${a.words ?? '–'}</td><td>v${esc(a.firstSeenVersion)}</td><td>${esc(a.excerpt ?? '–')}</td></tr>`).join('')}</tbody></table>`}`;
  return `<p class="muted">Le fasi coincidono con le sessioni. Sono descritti i cambiamenti del testo, non le loro cause.</p>
${c.notes.length ? `<ul class="lim">${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
${phases}
${sections}
${map}
${abandoned}`;
}

function timelineDetail(t: Analysis['timeline'][number]): string {
  const parts: string[] = [];
  if (t.versionLabel) parts.push(`versione ${t.versionLabel}`);
  if (t.author) parts.push(t.author);
  if (t.wordCount !== undefined) parts.push(`${formatInt(t.wordCount)} parole`);
  if (t.words !== undefined) parts.push(`${formatInt(t.words)} parole`);
  if (t.durationMs !== undefined) parts.push(formatDuration(t.durationMs));
  if (t.label) parts.push(t.label);
  return parts.join(' · ');
}

/** Inline SVG chart: word count per version with sessions, large insertions, revisions and gaps. */
export function wordCountChart(dataset: DocumentDataset, analysis: Analysis, width = 940, height = 260): string {
  const snapshots = [...dataset.snapshots].filter((s) => s.extractionStatus !== 'UNAVAILABLE').sort((a, b) => a.index - b.index);
  if (snapshots.length === 0) return '<p class="muted">Nessuna versione leggibile: grafico non disponibile.</p>';
  const times = snapshots.map((s) => parseIso(s.timestamp));
  const t0 = Math.min(...times);
  const t1 = Math.max(...times, t0 + 60_000);
  const maxWords = Math.max(10, ...snapshots.map((s) => s.wordCount));
  const pad = { l: 56, r: 16, t: 16, b: 36 };
  const x = (t: number): number => pad.l + ((t - t0) / (t1 - t0)) * (width - pad.l - pad.r);
  const y = (w: number): number => height - pad.b - (w / maxWords) * (height - pad.t - pad.b);
  const path = snapshots.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(parseIso(s.timestamp)).toFixed(1)},${y(s.wordCount).toFixed(1)}`).join(' ');
  const sessionsRects = analysis.sessions.map((s) => { const a = x(parseIso(s.startedAt)); const b = x(parseIso(s.endedAt)); return `<rect x="${(a - 2).toFixed(1)}" y="${pad.t}" width="${Math.max(4, b - a + 4).toFixed(1)}" height="${height - pad.t - pad.b}" fill="#dbeafe" opacity="0.6"/>`; }).join('');
  const insertionMarks = analysis.timeline.filter((t) => t.type === 'LARGE_INSERTION').map((t) => { const px = x(parseIso(t.time)); return `<line x1="${px.toFixed(1)}" y1="${pad.t}" x2="${px.toFixed(1)}" y2="${height - pad.b}" stroke="#b91c1c" stroke-dasharray="3,3"/><text x="${(px + 3).toFixed(1)}" y="${pad.t + 12}" font-size="10" fill="#b91c1c">+${t.words}</text>`; }).join('');
  const revisionMarks = analysis.timeline.filter((t) => t.type === 'REVISION').map((t) => `<circle cx="${x(parseIso(t.time)).toFixed(1)}" cy="${(pad.t + 6).toFixed(1)}" r="4" fill="#7c3aed"><title>${esc(t.label ?? 'revisione')}</title></circle>`).join('');
  const gapMarks = analysis.observation.knownGaps.filter((g) => g.to && g.type === 'LONG_INTERVAL').map((g) => { const a = x(parseIso(g.from)); const b = x(parseIso(g.to as string)); return `<rect x="${a.toFixed(1)}" y="${pad.t}" width="${Math.max(2, b - a).toFixed(1)}" height="${height - pad.t - pad.b}" fill="url(#hatch)" opacity="0.5"><title>${esc(g.type)}: ${esc(g.description)}</title></rect>`; }).join('');
  const points = snapshots.map((s) => `<circle cx="${x(parseIso(s.timestamp)).toFixed(1)}" cy="${y(s.wordCount).toFixed(1)}" r="3" fill="#1d4ed8"><title>v${esc(s.versionLabel)} · ${s.wordCount} parole · ${esc(s.authorLabel ?? '')} · ${esc(s.timestamp)}</title></circle>`).join('');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => `<text x="${pad.l - 6}" y="${(y(f * maxWords) + 4).toFixed(1)}" font-size="10" text-anchor="end" fill="#6b7280">${formatInt(f * maxWords)}</text><line x1="${pad.l}" x2="${width - pad.r}" y1="${y(f * maxWords).toFixed(1)}" y2="${y(f * maxWords).toFixed(1)}" stroke="#e5e7eb"/>`).join('');
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => { const t = t0 + f * (t1 - t0); return `<text x="${x(t).toFixed(1)}" y="${height - 4}" font-size="10" text-anchor="middle" fill="#6b7280">${formatDateTime(new Date(t).toISOString())}</text>`; }).join('');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img" aria-label="Parole per versione nel tempo" style="max-width:100%;height:auto;background:#fff;border:1px solid #e5e7eb;border-radius:6px">
<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="#b45309" stroke-width="2"/></pattern></defs>
${sessionsRects}${gapMarks}${yTicks}${xTicks}${insertionMarks}<path d="${path}" fill="none" stroke="#1d4ed8" stroke-width="2"/>${points}${revisionMarks}
</svg>
<div class="legend"><span><i style="background:#1d4ed8"></i>parole per versione</span><span><i style="background:#dbeafe"></i>sessione</span><span><i style="background:#b91c1c"></i>grande inserimento</span><span><i style="background:#7c3aed"></i>revisione</span><span><i style="background:#b45309"></i>intervallo lungo</span></div>`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

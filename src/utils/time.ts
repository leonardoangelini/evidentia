/**
 * Timestamps are ISO 8601 with the local UTC offset, e.g.
 * 2026-09-12T09:03:12.123+02:00, so exported data is readable in the
 * student's local time while remaining unambiguous.
 */

function pad(n: number, width = 2): string {
  return String(Math.trunc(Math.abs(n))).padStart(width, '0');
}

export function toIsoLocal(date: Date = new Date()): string {
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `.${pad(date.getMilliseconds(), 3)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  );
}

export function nowIso(): string {
  return toIsoLocal(new Date());
}

export function parseIso(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new Error(`Invalid timestamp: ${iso}`);
  return ms;
}

export function diffMs(fromIso: string, toIso: string): number {
  return parseIso(toIso) - parseIso(fromIso);
}

export function addMs(iso: string, ms: number): string {
  return toIsoLocal(new Date(parseIso(iso) + ms));
}

export function compareIso(a: string, b: string): number {
  return parseIso(a) - parseIso(b);
}

/** Human readable duration: "1 h 12 min", "42 min", "18 s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '–';
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return s > 0 && m < 5 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function formatMinutes(ms: number): number {
  return Math.round((ms / 60000) * 10) / 10;
}

/** Short local time for the UI: "09:03:12". */
export function formatClock(iso: string): string {
  const d = new Date(parseIso(iso));
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Local date and time: "12/09/2026 09:03". */
export function formatDateTime(iso: string): string {
  const d = new Date(parseIso(iso));
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function todayISO(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

/** Whole days from today until iso (negative = past). */
export function daysUntil(iso: string, from = todayISO()): number {
  const a = parseISO(from).getTime();
  const b = parseISO(iso).getTime();
  return Math.round((b - a) / 86400000);
}

/** Monday of the week containing iso. */
export function weekStart(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - dow);
  return todayISO(d);
}

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseISO(iso).toLocaleDateString(undefined, opts);
}

export function weekdayShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

export function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function uid(prefix = ''): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export type ExpiryState = 'expired' | 'today' | 'soon3' | 'soon7' | 'ok' | 'none';

export function expiryState(iso?: string): ExpiryState {
  if (!iso) return 'none';
  const d = daysUntil(iso);
  if (d < 0) return 'expired';
  if (d === 0) return 'today';
  if (d <= 3) return 'soon3';
  if (d <= 7) return 'soon7';
  return 'ok';
}

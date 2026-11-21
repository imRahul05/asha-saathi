/** Today's calendar date in India (YYYY-MM-DD). Follow-up dates are planned in this zone, not the server's. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from `today` to `due` (both YYYY-MM-DD). Negative when overdue. */
export function daysBetween(today: string, due: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * A calendar date read from a database DATE column, as YYYY-MM-DD. The driver hands DATE columns back as a JS Date at LOCAL midnight, so the
 * calendar day must be read with local getters: going through toISOString() (UTC) moved every date one day back on a server in India's timezone
 * (a developer laptop) and was only right on UTC servers such as Vercel.
 */
export function dateColumnToIso(v: unknown): string | null {
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return v == null ? null : String(v).slice(0, 10);
}

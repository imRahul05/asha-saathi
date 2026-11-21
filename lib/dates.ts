/** Today's calendar date in India (YYYY-MM-DD). Follow-up dates are planned in this zone, not the server's. */
export function todayInIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Whole days from `today` to `due` (both YYYY-MM-DD). Negative when overdue. */
export function daysBetween(today: string, due: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

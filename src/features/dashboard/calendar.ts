export type CalendarCell = { date: string; day: number; inMonth: boolean };

const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Today's date (YYYY-MM-DD) in an IANA timezone. */
export function todayInTimezone(timezone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * Six-week (42-cell) month grid starting on Sunday. `month` is 0-based.
 * Works purely on calendar dates, so it is unaffected by DST or the host timezone.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = first.getUTCDay();
  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(year, month, 1 - startOffset + i));
    cells.push({
      date: isoDate(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month,
    });
  }
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
}

/** Local calendar day as `YYYY-MM-DD`. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** The `count` days ending on `end`, oldest first. */
export function lastNDays(count: number, end = new Date()): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - (count - 1)));
}

const WeekdayInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function weekdayInitial(date: Date): string {
  return WeekdayInitials[date.getDay()];
}

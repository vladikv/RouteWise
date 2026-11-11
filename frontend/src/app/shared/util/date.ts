/** Today's date in the user's time zone as an ISO date (YYYY-MM-DD), as date inputs and the API use. */
export function todayIso(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** The ISO date `days` after `dateIso` (negative goes back). */
export function addDaysIso(dateIso: string, days: number): string {
  const [year, month, day] = dateIso.split('-').map(Number);
  return todayIso(new Date(year, month - 1, day + days));
}

/** Whole days from `fromIso` to `toIso`; negative when `toIso` is earlier. */
export function daysBetween(fromIso: string, toIso: string): number {
  const utc = (iso: string): number => {
    const [year, month, day] = iso.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((utc(toIso) - utc(fromIso)) / 86_400_000);
}

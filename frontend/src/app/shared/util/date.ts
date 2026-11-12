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

/** Weather forecasts reach today plus this many days (the API's provider window). */
export const FORECAST_DAYS_AHEAD = 15;

/** Day of the week of an ISO date: 0 = Sunday … 6 = Saturday. */
function weekday(dateIso: string): number {
  const [year, month, day] = dateIso.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/** This weekend's Saturday, or today when today is Saturday or Sunday. */
export function weekendIso(todayIsoDate: string): string {
  const day = weekday(todayIsoDate);
  return day === 6 || day === 0 ? todayIsoDate : addDaysIso(todayIsoDate, 6 - day);
}

/** Monday of next week. */
export function nextWeekIso(todayIsoDate: string): string {
  const day = weekday(todayIsoDate);
  return addDaysIso(todayIsoDate, day === 0 ? 1 : 8 - day);
}

/** Whether the weather provider has a forecast for this date yet. */
export function hasForecast(todayIsoDate: string, dateIso: string): boolean {
  const days = daysBetween(todayIsoDate, dateIso);
  return days >= 0 && days <= FORECAST_DAYS_AHEAD;
}

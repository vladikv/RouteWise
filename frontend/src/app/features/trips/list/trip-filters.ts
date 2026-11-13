import { TransportModeCode, TripPage, TripPriority, TripSearch } from '../../../core/api/models';

export type SortKey = 'date' | 'cost' | 'co2';
export type SortDirection = 'asc' | 'desc';

export interface TripSort {
  key: SortKey;
  direction: SortDirection;
}

export interface TripFilter {
  search: string;
  /** None selected means all. */
  priorities: readonly TripPriority[];
  /** None selected means all. */
  modes: readonly TransportModeCode[];
}

export const DEFAULT_SORT: TripSort = { key: 'date', direction: 'asc' };

export const FILTER_MODES: readonly TransportModeCode[] = ['TRAIN', 'BUS', 'CAR', 'BIKE', 'PLANE'];

/** Trips the board loads at once (the API's maximum); the board has no paging controls. */
export const PAGE_SIZE = 100;

/** Trips per page in the list view, which has paging controls. */
export const LIST_PAGE_SIZE = 20;

/** Which page of how many trips to ask for (`page` is zero-based). */
export interface TripPaging {
  page: number;
  size: number;
}

/** The API query for the toolbar's filters, the table's sort and the page asked for (default: the board's single page). */
export function tripSearch(
  filter: TripFilter,
  sort: TripSort,
  paging: TripPaging = { page: 0, size: PAGE_SIZE },
): TripSearch {
  return {
    q: filter.search.trim(),
    priority: filter.priorities,
    mode: filter.modes,
    sort: sort.key,
    direction: sort.direction,
    page: paging.page,
    size: paging.size,
  };
}

/** The API's priority facet as chip counts. */
export function priorityCounts(page: TripPage): Record<TripPriority, number> {
  return Object.fromEntries(
    page.facets.priorities.map(({ priority, count }) => [priority, count]),
  ) as Record<TripPriority, number>;
}

/** The API's mode facet as chip counts. */
export function modeCounts(page: TripPage): Record<TransportModeCode, number> {
  return Object.fromEntries(page.facets.modes.map(({ mode, count }) => [mode, count])) as Record<
    TransportModeCode,
    number
  >;
}

/** "3 of 5 trips" (and "1 of 1 trip"). */
export function resultSummary(shown: number, total: number): string {
  return `${shown} of ${total} ${total === 1 ? 'trip' : 'trips'}`;
}

/** Selected chips; the search text is not counted. */
export function activeChipCount(filter: Pick<TripFilter, 'priorities' | 'modes'>): number {
  return filter.priorities.length + filter.modes.length;
}

/** Whether the list is narrowed by a search or any chip. */
export function hasActiveFilters(filter: TripFilter): boolean {
  return filter.search.trim() !== '' || activeChipCount(filter) > 0;
}

/** The sort after a click on a column: the same column flips its direction, another starts ascending. */
export function toggleSort(current: TripSort, key: SortKey): TripSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { key, direction: 'asc' };
}

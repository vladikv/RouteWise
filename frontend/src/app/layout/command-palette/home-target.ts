import { Params } from '@angular/router';

/** Which Home field a city chosen in the palette fills. */
export type HomeField = 'from' | 'to';

/**
 * A city chosen in the palette fills From while Home has none (or Home is not open), otherwise
 * To. `params` are Home's current query parameters, or null on another page.
 */
export function homeFieldFor(params: Params | null): HomeField {
  return params?.['from'] ? 'to' : 'from';
}

/**
 * Home's query parameters with the city in its field. On Home the rest of the state (date,
 * travelers, priority, the other city) is kept; from another page only the city is set.
 */
export function homeQueryFor(cityId: number, params: Params | null): Params {
  return { ...(params ?? {}), [homeFieldFor(params)]: cityId };
}

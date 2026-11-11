import { City, Trip } from '../../core/api/models';

/** Test data and DOM helpers shared by the trip form specs. */

export const BERLIN: City = {
  id: 3,
  name: 'Berlin',
  country: 'DE',
  latitude: 52.52,
  longitude: 13.405,
};
export const VIENNA: City = {
  id: 23,
  name: 'Vienna',
  country: 'AT',
  latitude: 48.2082,
  longitude: 16.3738,
};
export const CITIES: City[] = [BERLIN, VIENNA];

export const TRIP: Trip = {
  id: 7,
  title: 'Berlin to Vienna',
  origin: { id: 3, name: 'Berlin', country: 'DE' },
  destination: { id: 23, name: 'Vienna', country: 'AT' },
  departureDate: '2099-05-20',
  travelers: 2,
  priority: 'GREENEST',
  notes: 'Window seat',
  createdAt: '2026-11-11T10:00:00Z',
  updatedAt: '2026-11-11T10:00:00Z',
};

export function typeInto(root: HTMLElement, selector: string, value: string): void {
  const element = root.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!element) {
    throw new Error(`No element matches ${selector}`);
  }
  element.value = value;
  element.dispatchEvent(new Event('input'));
  element.dispatchEvent(new Event('blur'));
}

/** Selects the option whose text starts with `optionText`. */
export function choose(root: HTMLElement, selector: string, optionText: string): void {
  const select = root.querySelector<HTMLSelectElement>(selector);
  const index = Array.from(select?.options ?? []).findIndex((option) =>
    option.text.trim().startsWith(optionText),
  );
  if (!select || index < 0) {
    throw new Error(`No option "${optionText}" in ${selector}`);
  }
  select.selectedIndex = index;
  select.dispatchEvent(new Event('change'));
  select.dispatchEvent(new Event('blur'));
}

export function fillValidTrip(root: HTMLElement): void {
  typeInto(root, '#trip-title', '  Berlin to Vienna ');
  choose(root, '#trip-origin', 'Berlin');
  choose(root, '#trip-destination', 'Vienna');
  typeInto(root, '#trip-date', '2099-05-20');
  typeInto(root, '#trip-travelers', '2');
}

export function submit(root: HTMLElement): void {
  root.querySelector('form')?.dispatchEvent(new Event('submit'));
}

export function errorText(root: HTMLElement, fieldId: string): string | undefined {
  return root.querySelector(`#${fieldId}-error`)?.textContent?.trim();
}

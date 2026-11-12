import { ComponentFixture } from '@angular/core/testing';
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
export const PRAGUE: City = {
  id: 18,
  name: 'Prague',
  country: 'CZ',
  latitude: 50.0755,
  longitude: 14.4378,
};
export const CITIES: City[] = [BERLIN, PRAGUE, VIENNA];

export const TRIP: Trip = {
  id: 7,
  title: 'Berlin to Vienna',
  stops: [
    { cityId: 3, cityName: 'Berlin', country: 'DE', position: 0 },
    { cityId: 23, cityName: 'Vienna', country: 'AT', position: 1 },
  ],
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

/**
 * Picks a city for stop `index` (0-based) the way a user does: type into the
 * stop's city picker, then click the matching option.
 */
export async function pickStop(
  fixture: ComponentFixture<unknown>,
  index: number,
  cityName: string,
): Promise<void> {
  const root = fixture.nativeElement as HTMLElement;
  const field = root.querySelector<HTMLInputElement>(`#trip-stop-${index}`);
  if (!field) {
    throw new Error(`No stop ${index}`);
  }
  field.value = cityName;
  field.dispatchEvent(new Event('input'));
  fixture.detectChanges();
  await fixture.whenStable();
  const option = Array.from(root.querySelectorAll<HTMLElement>('[role="option"]')).find(
    (candidate) => candidate.querySelector('.picker__name')?.textContent?.trim() === cityName,
  );
  if (!option) {
    throw new Error(`No option "${cityName}" for stop ${index}`);
  }
  option.click();
  await fixture.whenStable();
}

/** The city name shown in stop `index`, or "" when none is chosen. */
export function stopName(root: HTMLElement, index: number): string | undefined {
  return root.querySelector<HTMLInputElement>(`#trip-stop-${index}`)?.value;
}

/** Berlin to Vienna on 2099-05-20 for 2 travelers, with a padded title. */
export async function fillValidTrip(fixture: ComponentFixture<unknown>): Promise<void> {
  const root = fixture.nativeElement as HTMLElement;
  typeInto(root, '#trip-title', '  Berlin to Vienna ');
  await pickStop(fixture, 0, 'Berlin');
  await pickStop(fixture, 1, 'Vienna');
  typeInto(root, '#trip-date', '2099-05-20');
  typeInto(root, '#trip-travelers', '2');
  await fixture.whenStable();
}

export function submit(root: HTMLElement): void {
  root.querySelector('form')?.dispatchEvent(new Event('submit'));
}

export function errorText(root: HTMLElement, fieldId: string): string | undefined {
  return root.querySelector(`#${fieldId}-error`)?.textContent?.trim();
}

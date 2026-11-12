import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TripRequest } from '../../core/api/models';
import { DRAFT } from './comparison/comparison.testing';
import { TripForm } from './trip-form';
import {
  CITIES,
  TRIP,
  errorText,
  fillValidTrip,
  pickStop,
  stopName,
  submit,
  typeInto,
} from './trip-form.testing';

describe('TripForm', () => {
  let fixture: ComponentFixture<TripForm>;
  let form: HTMLElement;
  let emitted: TripRequest[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripForm],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(TripForm);
    fixture.componentRef.setInput('cities', CITIES);
    fixture.componentRef.setInput('cancelLink', '/trips');
    emitted = [];
    fixture.componentInstance.submitted.subscribe((request) => emitted.push(request));
    form = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const button = (name: string) =>
    Array.from(form.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) =>
        (candidate.getAttribute('aria-label') ?? candidate.textContent?.trim()) === name,
    );
  const stopCount = () => form.querySelectorAll('.stop').length;

  it('shows required errors and a summary when submitted empty, and emits nothing', async () => {
    submit(form);
    await fixture.whenStable();

    expect(form.querySelector('.form-summary')?.textContent).toContain(
      'fix the highlighted fields',
    );
    expect(errorText(form, 'trip-title')).toBe('This field is required.');
    expect(errorText(form, 'trip-stop-0')).toBe('Choose a city for this stop.');
    expect(errorText(form, 'trip-stop-1')).toBe('Choose a city for this stop.');
    expect(errorText(form, 'trip-date')).toBe('This field is required.');
    expect(form.querySelector('#trip-stop-0')?.getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelector('#trip-stop-0')?.getAttribute('aria-describedby')).toBe(
      'trip-stop-0-error',
    );
    expect(emitted).toEqual([]);
  });

  it('emits a trimmed request with the stops in order and defaults for a valid new trip', async () => {
    await fillValidTrip(fixture);
    submit(form);
    await fixture.whenStable();

    expect(emitted).toEqual([
      {
        title: 'Berlin to Vienna',
        stops: [{ cityId: 3 }, { cityId: 23 }],
        departureDate: '2099-05-20',
        travelers: 2,
        priority: 'BALANCED',
        notes: null,
      },
    ]);
    expect(form.querySelector('.form-summary')).toBeNull();
    expect(form.querySelector('button[type="submit"]')?.textContent).toContain('Create trip');
  });

  it('adds, moves and removes stops, within 2 to 10', async () => {
    await fillValidTrip(fixture);
    expect(button('Remove stop 1')?.disabled).toBe(true);

    button('+ Add stop')?.click();
    await fixture.whenStable();
    await pickStop(fixture, 2, 'Prague');
    expect(stopCount()).toBe(3);

    button('Move stop 3 up')?.click();
    await fixture.whenStable();
    expect([0, 1, 2].map((i) => stopName(form, i))).toEqual(['Berlin', 'Prague', 'Vienna']);
    expect(button('Move stop 1 up')?.disabled).toBe(true);
    expect(button('Move stop 3 down')?.disabled).toBe(true);

    button('Remove stop 2')?.click();
    await fixture.whenStable();
    expect([0, 1].map((i) => stopName(form, i))).toEqual(['Berlin', 'Vienna']);

    for (let i = 0; i < 8; i++) {
      button('+ Add stop')?.click();
    }
    await fixture.whenStable();
    expect(stopCount()).toBe(10);
    expect(button('+ Add stop')?.disabled).toBe(true);
  });

  it('rejects the same city in two stops in a row, like the API', async () => {
    await fillValidTrip(fixture);
    button('+ Add stop')?.click();
    await fixture.whenStable();
    await pickStop(fixture, 2, 'Berlin');
    button('Remove stop 2')?.click(); // Berlin, Berlin
    await fixture.whenStable();
    submit(form);
    await fixture.whenStable();

    expect(errorText(form, 'trip-stop-1')).toBe('Choose a different city than the stop before.');
    expect(emitted).toEqual([]);
  });

  it('rejects a past date, a blank title and travelers out of range', async () => {
    await fillValidTrip(fixture);
    typeInto(form, '#trip-title', '   ');
    typeInto(form, '#trip-date', '2000-01-01');
    typeInto(form, '#trip-travelers', '10');
    await fixture.whenStable();

    expect(errorText(form, 'trip-title')).toBe('This field is required.');
    expect(errorText(form, 'trip-date')).toBe('The departure date must be today or later.');
    expect(errorText(form, 'trip-travelers')).toBe('At most 9 travelers.');

    typeInto(form, '#trip-travelers', '0');
    await fixture.whenStable();
    expect(errorText(form, 'trip-travelers')).toBe('At least 1 traveler.');

    typeInto(form, '#trip-travelers', '1.5');
    await fixture.whenStable();
    expect(errorText(form, 'trip-travelers')).toBe('Enter a whole number.');
  });

  it('prefills an existing trip with its stops and keeps its unchanged past date valid', async () => {
    fixture.componentRef.setInput('trip', { ...TRIP, departureDate: '2000-01-01' });
    await fixture.whenStable();

    expect(form.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('Berlin to Vienna');
    expect([stopName(form, 0), stopName(form, 1)]).toEqual(['Berlin', 'Vienna']);
    expect(form.querySelector<HTMLInputElement>('#trip-date')?.value).toBe('2000-01-01');
    expect(form.querySelector<HTMLTextAreaElement>('#trip-notes')?.value).toBe('Window seat');
    expect(
      form.querySelector('input[type="radio"]:checked')?.closest('label')?.textContent,
    ).toContain('Greenest');
    expect(form.querySelector('button[type="submit"]')?.textContent).toContain('Save changes');

    submit(form);
    await fixture.whenStable();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].stops).toEqual([{ cityId: 3 }, { cityId: 23 }]);
    expect(emitted[0].departureDate).toBe('2000-01-01');
    expect(emitted[0].notes).toBe('Window seat');
  });

  it('shows field errors returned by the API on the field or stop until it is edited', async () => {
    await fillValidTrip(fixture);
    fixture.componentRef.setInput('serverErrors', [
      { field: 'departureDate', message: 'must be today or later' },
      { field: 'stops[1].cityId', message: 'unknown city id 23' },
    ]);
    await fixture.whenStable();

    expect(errorText(form, 'trip-date')).toBe('Must be today or later.');
    expect(errorText(form, 'trip-stop-1')).toBe('Unknown city id 23.');

    typeInto(form, '#trip-date', '2099-06-01');
    await pickStop(fixture, 1, 'Prague');

    expect(errorText(form, 'trip-date')).toBeUndefined();
    expect(errorText(form, 'trip-stop-1')).toBeUndefined();
  });

  it('prefills a new trip from an advisor draft and leaves unknown stops empty', async () => {
    fixture.componentRef.setInput('draft', DRAFT);
    await fixture.whenStable();

    expect(form.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('Berlin to Vienna');
    expect([stopName(form, 0), stopName(form, 1)]).toEqual(['Berlin', '']);
    expect(form.querySelector<HTMLInputElement>('#trip-date')?.value).toBe('2099-05-20');
    expect(form.querySelector<HTMLInputElement>('#trip-travelers')?.value).toBe('3');
    expect(
      form.querySelector('input[type="radio"]:checked')?.closest('label')?.textContent,
    ).toContain('Cheapest');
    expect(form.querySelector('button[type="submit"]')?.textContent).toContain('Create trip');

    submit(form);
    await fixture.whenStable();

    expect(errorText(form, 'trip-stop-1')).toBe('Choose a city for this stop.');
    expect(emitted).toEqual([]);
  });

  it('fills stops from the map: the first empty one, then a new last stop', async () => {
    const marker = (name: string) =>
      Array.from(form.querySelectorAll('app-route-map g.city')).find((g) =>
        g.getAttribute('aria-label')?.startsWith(name),
      );
    const clickMarker = async (name: string) => {
      marker(name)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await fixture.whenStable();
    };

    await clickMarker('Berlin');
    await clickMarker('Prague');
    await clickMarker('Vienna');

    expect([0, 1, 2].map((i) => stopName(form, i))).toEqual(['Berlin', 'Prague', 'Vienna']);
    expect(marker('Prague')?.getAttribute('aria-label')).toBe('Prague, stop 2');
    expect(form.querySelector('app-route-map [role="status"]')?.textContent).toContain(
      'Route Berlin → Prague → Vienna',
    );
  });

  it('starts a new trip from preset values and leaves the rest untouched', async () => {
    fixture.componentRef.setInput('preset', {
      title: 'Berlin to Vienna',
      stops: [3, 23],
      departureDate: '2099-05-20',
      travelers: 4,
      priority: 'FASTEST',
    });
    await fixture.whenStable();
    submit(form);
    await fixture.whenStable();

    expect(emitted).toEqual([
      {
        title: 'Berlin to Vienna',
        stops: [{ cityId: 3 }, { cityId: 23 }],
        departureDate: '2099-05-20',
        travelers: 4,
        priority: 'FASTEST',
        notes: null,
      },
    ]);
  });

  it('suggests a title from the stops and keeps a title the user wrote', async () => {
    const title = () => form.querySelector<HTMLInputElement>('#trip-title')?.value;

    await pickStop(fixture, 0, 'Berlin');
    await pickStop(fixture, 1, 'Vienna');
    expect(title()).toBe('Berlin to Vienna');

    button('+ Add stop')?.click();
    await fixture.whenStable();
    await pickStop(fixture, 2, 'Prague');
    expect(title()).toBe('Berlin to Prague via Vienna');

    await pickStop(fixture, 2, 'Berlin');
    expect(title()).toBe('Round trip from Berlin');

    typeInto(form, '#trip-title', 'Anniversary weekend');
    await pickStop(fixture, 1, 'Prague');
    expect(title()).toBe('Anniversary weekend');
  });

  it('disables the submit button while saving', async () => {
    fixture.componentRef.setInput('submitting', true);
    await fixture.whenStable();

    const submitButton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submitButton?.disabled).toBe(true);
    expect(submitButton?.textContent).toContain('Saving…');
  });
});

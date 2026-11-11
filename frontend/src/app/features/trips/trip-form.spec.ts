import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TripRequest } from '../../core/api/models';
import { TripForm } from './trip-form';
import {
  CITIES,
  TRIP,
  choose,
  errorText,
  fillValidTrip,
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

  it('shows required errors and a summary when submitted empty, and emits nothing', async () => {
    submit(form);
    await fixture.whenStable();

    expect(form.querySelector('.form-summary')?.textContent).toContain(
      'fix the highlighted fields',
    );
    expect(errorText(form, 'trip-title')).toBe('This field is required.');
    expect(errorText(form, 'trip-origin')).toBe('This field is required.');
    expect(errorText(form, 'trip-destination')).toBe('This field is required.');
    expect(errorText(form, 'trip-date')).toBe('This field is required.');
    expect(form.querySelector('#trip-title')?.getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelector('#trip-title')?.getAttribute('aria-describedby')).toBe(
      'trip-title-error',
    );
    expect(emitted).toEqual([]);
  });

  it('emits a trimmed request with defaults for a valid new trip', async () => {
    fillValidTrip(form);
    submit(form);
    await fixture.whenStable();

    expect(emitted).toEqual([
      {
        title: 'Berlin to Vienna',
        originCityId: 3,
        destinationCityId: 23,
        departureDate: '2099-05-20',
        travelers: 2,
        priority: 'BALANCED',
        notes: null,
      },
    ]);
    expect(form.querySelector('.form-summary')).toBeNull();
    expect(form.querySelector('button[type="submit"]')?.textContent).toContain('Create trip');
  });

  it('rejects the same city as origin and destination', async () => {
    fillValidTrip(form);
    choose(form, '#trip-destination', 'Berlin');
    submit(form);
    await fixture.whenStable();

    expect(errorText(form, 'trip-destination')).toBe(
      'Origin and destination must be different cities.',
    );
    expect(emitted).toEqual([]);
  });

  it('rejects a past date, a blank title and travelers out of range', async () => {
    fillValidTrip(form);
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

  it('prefills an existing trip and keeps its unchanged past date valid', async () => {
    fixture.componentRef.setInput('trip', { ...TRIP, departureDate: '2000-01-01' });
    await fixture.whenStable();

    expect(form.querySelector<HTMLInputElement>('#trip-title')?.value).toBe('Berlin to Vienna');
    expect(form.querySelector<HTMLInputElement>('#trip-date')?.value).toBe('2000-01-01');
    expect(form.querySelector<HTMLTextAreaElement>('#trip-notes')?.value).toBe('Window seat');
    expect(
      form.querySelector('input[type="radio"]:checked')?.closest('label')?.textContent,
    ).toContain('Greenest');
    expect(form.querySelector('button[type="submit"]')?.textContent).toContain('Save changes');

    submit(form);
    await fixture.whenStable();

    expect(emitted).toHaveLength(1);
    expect(emitted[0].departureDate).toBe('2000-01-01');
    expect(emitted[0].notes).toBe('Window seat');
  });

  it('shows field errors returned by the API until the field is edited', async () => {
    fillValidTrip(form);
    fixture.componentRef.setInput('serverErrors', [
      { field: 'departureDate', message: 'must be today or later' },
    ]);
    await fixture.whenStable();

    expect(errorText(form, 'trip-date')).toBe('Must be today or later.');

    typeInto(form, '#trip-date', '2099-06-01');
    await fixture.whenStable();

    expect(errorText(form, 'trip-date')).toBeUndefined();
  });

  it('disables the submit button while saving', async () => {
    fixture.componentRef.setInput('submitting', true);
    await fixture.whenStable();

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(button?.disabled).toBe(true);
    expect(button?.textContent).toContain('Saving…');
  });
});

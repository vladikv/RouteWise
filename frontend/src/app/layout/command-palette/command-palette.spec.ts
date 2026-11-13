import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { AuthApi } from '../../core/api/auth-api';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { pageOf } from '../../features/trips/trip-list.testing';
import { CITIES, TRIP } from '../../features/trips/trip-form.testing';
import { installDialogSupport } from '../../shared/ui/dialog.testing';
import { CommandPalette, PALETTE_DEBOUNCE_MS } from './command-palette';

const API = 'http://api.test/api';

describe('CommandPalette', () => {
  let fixture: ComponentFixture<CommandPalette>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let closed: number;

  beforeEach(async () => {
    installDialogSupport();
    await TestBed.configureTestingModule({
      imports: [CommandPalette],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(CommandPalette);
    element = fixture.nativeElement as HTMLElement;
    closed = 0;
    fixture.componentInstance.closed.subscribe(() => closed++);
  });

  afterEach(() => httpTesting.verify());

  function logIn(): void {
    vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
    TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();
  }

  async function openPalette(): Promise<void> {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const input = () => element.querySelector('input[role="combobox"]') as HTMLInputElement;
  const options = () =>
    Array.from(element.querySelectorAll('[role="option"]')).map((option) =>
      option.querySelector('.option__name')?.textContent?.trim(),
    );
  const status = () => element.querySelector('[role="status"]')?.textContent?.trim();

  async function type(text: string): Promise<void> {
    input().value = text;
    input().dispatchEvent(new Event('input'));
    fixture.detectChanges();
    // The search waits for a pause in typing before it goes to the API.
    await new Promise((resolve) => setTimeout(resolve, PALETTE_DEBOUNCE_MS + 20));
  }

  function key(name: string): void {
    input().dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));
    fixture.detectChanges();
  }

  async function answer(cities = CITIES, trips = [TRIP]): Promise<void> {
    httpTesting.expectOne((request) => request.url === `${API}/cities`).flush(cities);
    httpTesting
      .match((request) => request.url === `${API}/trips`)
      .forEach((call) => {
        expect(call.request.params.get('size')).toBe('5');
        call.flush(pageOf(trips));
      });
    await fixture.whenStable();
  }

  it('is a labelled combobox that starts empty with a hint', async () => {
    await openPalette();

    expect(element.querySelector('dialog')?.open).toBe(true);
    expect(input().getAttribute('aria-label')).toBe('Search cities and trips');
    expect(input().getAttribute('aria-controls')).toBe('palette-results');
    expect(input().getAttribute('aria-expanded')).toBe('false');
    expect(status()).toBe('Type a city. Log in to search your trips too.');
  });

  it('searches cities and the user’s trips after a pause, the first result highlighted', async () => {
    logIn();
    await openPalette();
    await type('ber');

    const citiesCall = httpTesting.expectOne(`${API}/cities?q=ber`);
    const tripsCall = httpTesting.expectOne((request) => request.url === `${API}/trips`);
    expect(tripsCall.request.params.get('q')).toBe('ber');
    citiesCall.flush([CITIES[0]]);
    tripsCall.flush(pageOf([TRIP]));
    await fixture.whenStable();

    expect(options()).toEqual(['Berlin', 'Berlin to Vienna']);
    expect(input().getAttribute('aria-expanded')).toBe('true');
    expect(input().getAttribute('aria-activedescendant')).toBe('palette-city-3');
    expect(element.querySelector('#palette-city-3')?.getAttribute('aria-selected')).toBe('true');
    expect(status()).toBe('1 city, 1 trip.');
  });

  it('searches only cities while logged out', async () => {
    await openPalette();
    await type('pra');
    httpTesting.expectNone((request) => request.url === `${API}/trips`);
    await answer([CITIES[1]]);

    expect(options()).toEqual(['Prague']);
    expect(status()).toBe('1 city.');
  });

  it('moves with the arrows (wrapping) and opens the highlighted trip on Enter', async () => {
    logIn();
    await openPalette();
    await type('b');
    await answer();

    key('ArrowUp');
    expect(input().getAttribute('aria-activedescendant')).toBe('palette-trip-7');
    key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe('palette-city-3');
    key('ArrowUp');
    key('Enter');

    expect(navigate).toHaveBeenCalledWith(['/trips', 7]);
    expect(closed).toBe(1);
  });

  it('sets a city as From on Home, or as To when Home already has a From', async () => {
    await openPalette();
    await type('b');
    await answer();
    expect(element.querySelector('.group__label')?.textContent).toContain('set as From on Home');
    key('Enter');
    expect(navigate).toHaveBeenLastCalledWith(['/'], { queryParams: { from: 3 } });

    vi.spyOn(TestBed.inject(Router), 'url', 'get').mockReturnValue('/?from=23&travelers=2');
    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    await openPalette();
    await type('b');
    await answer();
    expect(element.querySelector('.group__label')?.textContent).toContain('set as To on Home');
    (element.querySelector('#palette-city-3') as HTMLElement).click();

    expect(navigate).toHaveBeenLastCalledWith(['/'], {
      queryParams: { from: '23', travelers: '2', to: 3 },
    });
  });

  it('says when nothing matches and shows a failed search with retry', async () => {
    await openPalette();
    await type('zzz');
    await answer([]);
    expect(status()).toBe('Nothing found for “zzz”.');

    await type('ber');
    httpTesting.expectOne(`${API}/cities?q=ber`).error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(options()).toEqual([]);
  });

  it('asks to close on Escape and starts empty when opened again', async () => {
    await openPalette();
    await type('ber');
    await answer();

    element.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    expect(closed).toBe(1);

    fixture.componentRef.setInput('open', false);
    await fixture.whenStable();
    await openPalette();
    expect(input().value).toBe('');
    expect(options()).toEqual([]);
  });

  it('uses a plain text field: a search field would swallow the first Escape to clear itself', async () => {
    await openPalette();

    expect(input().type).toBe('text');
    expect(input().getAttribute('role')).toBe('combobox');
  });

  it('keeps the previous results (busy) while a new search loads, and keeps the highlight', async () => {
    logIn();
    await openPalette();
    await type('b');
    await answer();
    const before = options();
    key('ArrowDown');
    const highlighted = input().getAttribute('aria-activedescendant');
    expect(highlighted).not.toBe(`palette-city-${CITIES[0].id}`);
    const listbox = element.querySelector('[role="listbox"]')!;
    expect(listbox.getAttribute('aria-busy')).toBe('false');

    await type('be');

    expect(options()).toEqual(before);
    expect(listbox.getAttribute('aria-busy')).toBe('true');
    expect(status()).toBe('Searching…');
    expect(input().getAttribute('aria-activedescendant')).toBe(highlighted);

    await answer();
    expect(options()).toEqual(before);
    expect(listbox.getAttribute('aria-busy')).toBe('false');
    expect(input().getAttribute('aria-activedescendant')).toBe(highlighted);
  });

  it('ignores Enter until the results for the current text have arrived', async () => {
    await openPalette();
    await type('b');
    await answer();

    await type('be');
    key('Enter');
    expect(navigate).not.toHaveBeenCalled();
    expect(closed).toBe(0);

    await answer([CITIES[0]], []);
    key('Enter');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('gives the options no tab stop or key handling: focus stays in the input', async () => {
    await openPalette();
    await type('b');
    await answer();

    expect(element.querySelector('[role="option"]')?.hasAttribute('tabindex')).toBe(false);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { AuthApi } from '../../core/api/auth-api';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { TRIP } from '../../features/trips/trip-form.testing';
import { MIXED_FIGURES, listItem, pageOf } from '../../features/trips/trip-list.testing';
import { todayIso } from '../../shared/util/date';
import { UpcomingTrips } from './upcoming-trips';

const API = 'http://api.test/api';

describe('UpcomingTrips', () => {
  let fixture: ComponentFixture<UpcomingTrips>;
  let element: HTMLElement;
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingTrips],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  async function render(loggedIn: boolean): Promise<void> {
    if (loggedIn) {
      vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
      TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();
    }
    fixture = TestBed.createComponent(UpcomingTrips);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    TestBed.tick();
  }

  function expectSearch() {
    const call = httpTesting.expectOne((request) => request.url === `${API}/trips`);
    expect(call.request.params.get('sort')).toBe('date');
    expect(call.request.params.get('direction')).toBe('asc');
    expect(call.request.params.get('from')).toBe(todayIso());
    expect(call.request.params.get('size')).toBe('5');
    return call;
  }

  it('lists the next 5 upcoming trips with date and recommended mode, each opening the trip', async () => {
    await render(true);
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading trips');

    const second = { ...TRIP, id: 8, title: 'Berlin to Lisbon' };
    expectSearch().flush({
      ...pageOf([TRIP, second]),
      items: [listItem(TRIP), listItem(second, MIXED_FIGURES)],
    });
    await fixture.whenStable();

    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('ul a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/trips/7', '/trips/8']);
    expect(links[0].textContent).toContain('Berlin to Vienna');
    expect(links[0].textContent).toContain('Train');
    expect(links[0].querySelector('app-mode-icon')).not.toBeNull();
    expect(links[1].textContent).toContain('Mixed:');
    expect(element.querySelector('ul')?.getAttribute('aria-labelledby')).toBe(
      'upcoming-trips-title',
    );
    expect(element.querySelector('a.more')?.getAttribute('href')).toBe('/trips');
  });

  it('has an empty state and an error state', async () => {
    await render(true);
    expectSearch().flush(pageOf([]));
    await fixture.whenStable();
    expect(element.textContent).toContain('No upcoming trips');
    expect(element.querySelector('a.more')?.getAttribute('href')).toBe('/trips/new');

    fixture.destroy();
    fixture = TestBed.createComponent(UpcomingTrips);
    element = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    TestBed.tick();
    expectSearch().flush(null, { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain("Couldn't load");
  });

  it('asks to log in instead of loading while logged out', async () => {
    await render(false);
    await fixture.whenStable();

    httpTesting.expectNone((request) => request.url === `${API}/trips`);
    expect(element.querySelector('a.more')?.getAttribute('href')).toBe('/login');
  });
});

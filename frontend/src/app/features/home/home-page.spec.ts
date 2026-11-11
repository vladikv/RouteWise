import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { TransportMode } from '../../core/api/models';
import { HomePage } from './home-page';

const MODES_URL = 'http://api.test/api/transport-modes';
const TRAIN: TransportMode = {
  code: 'TRAIN',
  avgSpeedKmh: 110,
  costPerKm: 0.12,
  co2GramsPerKm: 35,
  fixedOverheadMinutes: 30,
  maxDistanceKm: 2000,
};

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    // The route explorer above loads the cities; these specs cover the modes section only.
    httpTesting.expectOne('http://api.test/api/cities').flush([]);
    page = (fixture.nativeElement as HTMLElement).querySelector(
      'section[aria-labelledby="modes-heading"]',
    ) as HTMLElement;
  });

  afterEach(() => httpTesting.verify());

  it('shows a loading state while the modes load', () => {
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading transport modes');

    httpTesting.expectOne(MODES_URL).flush([]);
  });

  it('renders the modes in a table', async () => {
    httpTesting.expectOne(MODES_URL).flush([TRAIN]);
    await fixture.whenStable();

    const row = page.querySelector('tbody tr');
    expect(row?.querySelector('th')?.textContent).toContain('Train');
    const cells = Array.from(row?.querySelectorAll('td') ?? []).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells).toEqual(['110 km/h', '€0.12', '35 g', '2,000 km']);
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('shows an empty state when there are no modes', async () => {
    httpTesting.expectOne(MODES_URL).flush([]);
    await fixture.whenStable();

    expect(page.textContent).toContain('No transport modes are configured.');
    expect(page.querySelector('table')).toBeNull();
  });

  it('shows the API error and reloads on retry', async () => {
    httpTesting.expectOne(MODES_URL).error(new ProgressEvent('error'));
    await fixture.whenStable();

    const alert = page.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('API unreachable');

    alert?.querySelector('button')?.click();
    TestBed.tick(); // start the reload; the app is not stable again until it is answered
    httpTesting.expectOne(MODES_URL).flush([TRAIN]);
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelector('tbody tr')).not.toBeNull();
  });
});

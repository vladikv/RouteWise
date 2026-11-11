import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { TripDetailsPage } from './trip-details-page';
import { TRIP } from './trip-form.testing';

const TRIP_URL = 'http://api.test/api/trips/7';

describe('TripDetailsPage', () => {
  let fixture: ComponentFixture<TripDetailsPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripDetailsPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(TripDetailsPage);
    fixture.componentRef.setInput('id', '7');
    page = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => httpTesting.verify());

  function click(text: string): void {
    const button = Array.from(page.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(text),
    );
    if (!button) {
      throw new Error(`No button "${text}"`);
    }
    button.click();
  }

  it('shows the trip details with an edit link', async () => {
    httpTesting.expectOne(TRIP_URL).flush(TRIP);
    await fixture.whenStable();

    expect(page.querySelector('h1')?.textContent).toContain('Berlin to Vienna');
    const details = page.querySelector('dl')?.textContent ?? '';
    expect(details).toContain('Berlin (DE)');
    expect(details).toContain('Vienna (AT)');
    expect(details).toContain('Wednesday, May 20, 2099');
    expect(details).toContain('2 travelers');
    expect(details).toContain('Greenest');
    expect(details).toContain('Window seat');
    expect(page.querySelector('.actions a')?.getAttribute('href')).toBe('/trips/7/edit');
  });

  it('omits the notes row when the trip has no notes', async () => {
    httpTesting.expectOne(TRIP_URL).flush({ ...TRIP, notes: null });
    await fixture.whenStable();

    expect(page.querySelector('dl')?.textContent).not.toContain('Notes');
  });

  it('shows a not-found error for an unknown trip', async () => {
    httpTesting
      .expectOne(TRIP_URL)
      .flush(
        { title: 'Not Found', detail: 'Trip with id 7 not found', status: 404 },
        { status: 404, statusText: 'Not Found' },
      );
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('Trip with id 7 not found');
    expect(page.querySelector('dl')).toBeNull();
  });

  it('deletes after confirmation and returns to the list', async () => {
    httpTesting.expectOne(TRIP_URL).flush(TRIP);
    await fixture.whenStable();

    click('Delete');
    await fixture.whenStable();
    click('Yes, delete');
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: TRIP_URL }).flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    expect(navigate).toHaveBeenCalledWith(['/trips']);
  });

  it('stays on the page and shows an error when deleting fails', async () => {
    httpTesting.expectOne(TRIP_URL).flush(TRIP);
    await fixture.whenStable();

    click('Delete');
    await fixture.whenStable();
    click('Yes, delete');
    TestBed.tick();
    httpTesting.expectOne({ method: 'DELETE', url: TRIP_URL }).error(new ProgressEvent('error'));
    await fixture.whenStable();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(navigate).not.toHaveBeenCalled();
  });
});

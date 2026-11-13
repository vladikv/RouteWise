import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { apiErrorInterceptor } from '../../core/api/api-error';
import { API_BASE_URL } from '../../core/api/api-config';
import { TransportMode } from '../../core/api/models';
import { ModesPage } from './modes-page';

const MODES_URL = 'http://api.test/api/transport-modes';
const TRAIN: TransportMode = {
  code: 'TRAIN',
  avgSpeedKmh: 110,
  costPerKm: 0.12,
  co2GramsPerKm: 35,
  fixedOverheadMinutes: 30,
  maxDistanceKm: 2000,
};
const PLANE: TransportMode = {
  code: 'PLANE',
  avgSpeedKmh: 800,
  costPerKm: 0.2,
  co2GramsPerKm: 183,
  fixedOverheadMinutes: 150,
  maxDistanceKm: 20000,
};

describe('ModesPage', () => {
  let fixture: ComponentFixture<ModesPage>;
  let httpTesting: HttpTestingController;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModesPage],
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ModesPage);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => httpTesting.verify());

  async function load(modes: TransportMode[]): Promise<void> {
    httpTesting.expectOne(MODES_URL).flush(modes);
    await fixture.whenStable();
  }

  const text = (element: Element | null): string =>
    (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const widths = (): string[] =>
    Array.from(page.querySelectorAll<HTMLElement>('.bar__fill')).map((fill) => fill.style.width);
  const values = (): string[] =>
    Array.from(page.querySelectorAll('.bar__value')).map((value) => text(value));

  async function chooseMetric(label: string): Promise<void> {
    const tab = Array.from(page.querySelectorAll<HTMLElement>('[role="tab"]')).find(
      (item) => item.textContent?.trim() === label,
    );
    tab?.click();
    await fixture.whenStable();
  }

  it('has a Modes heading', async () => {
    await load([]);

    expect(page.querySelector('h1')?.textContent).toBe('Modes');
  });

  it('shows a loading state while the modes load', () => {
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading transport modes');

    httpTesting.expectOne(MODES_URL).flush([]);
  });

  it('shows one card per mode with the API values, and the per-traveler note', async () => {
    await load([TRAIN, PLANE]);

    const cards = Array.from(page.querySelectorAll('app-mode-card')).map((card) => ({
      name: text(card.querySelector('h3')),
      labels: Array.from(card.querySelectorAll('dt')).map((dt) => text(dt)),
      values: Array.from(card.querySelectorAll('dd')).map((dd) => text(dd)),
    }));
    const labels = ['Avg. speed', 'Cost per km', 'CO₂ per km', 'Max. distance'];
    expect(cards).toEqual([
      { name: 'Train', labels, values: ['110 km/h', '€0.12', '35 g', '2,000 km'] },
      { name: 'Plane', labels, values: ['800 km/h', '€0.20', '183 g', '20,000 km'] },
    ]);
    expect(text(page.querySelector('.head p'))).toBe(
      'Typical European averages used for every comparison. Cost and CO₂ are per traveler, except car (per vehicle).',
    );
    expect(page.querySelector('[role="status"]')).toBeNull();
  });

  it('charts the speed first, bars proportional to the largest value', async () => {
    await load([TRAIN, PLANE]);

    expect(values()).toEqual(['110 km/h', '800 km/h']);
    expect(parseFloat(widths()[0])).toBeCloseTo(13.75, 6);
    expect(widths()[1]).toBe('100%');
    expect(text(page.querySelector('.hint'))).toBe('Longer is faster');
  });

  it('switches the chart to cost, CO₂ and max distance with the tabs', async () => {
    await load([TRAIN, PLANE]);

    await chooseMetric('Cost');
    expect(values()).toEqual(['€0.12', '€0.20']);
    expect(widths()).toEqual(['60%', '100%']);

    await chooseMetric('CO₂');
    expect(values()).toEqual(['35 g', '183 g']);

    await chooseMetric('Max. distance');
    expect(values()).toEqual(['2,000 km', '20,000 km']);
    expect(widths()).toEqual(['10%', '100%']);
    expect(page.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim()).toBe(
      'Max. distance',
    );
  });

  it('offers every parameter as a table', async () => {
    await load([TRAIN]);

    const row = page.querySelector('tbody tr');
    expect(row?.querySelector('th')?.textContent).toContain('Train');
    const cells = Array.from(row?.querySelectorAll('td') ?? []).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells).toEqual(['110 km/h', '€0.12', '35 g', '2,000 km']);
  });

  it('shows an empty state when there are no modes', async () => {
    await load([]);

    expect(page.textContent).toContain('No transport modes are configured.');
    expect(page.querySelector('table')).toBeNull();
    expect(page.querySelector('app-mode-card')).toBeNull();
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
    expect(page.querySelector('app-mode-card')).not.toBeNull();
  });
});

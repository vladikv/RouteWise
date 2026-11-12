import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ModeOption } from '../../../core/api/models';
import { LegComparison } from './leg-comparison';
import { ComparisonChart } from './comparison-chart';
import { comparisonInsight } from './comparison-insight';
import { LEG_COMPARISON } from './comparison.testing';

function option(overrides: Partial<ModeOption> & Pick<ModeOption, 'mode'>): ModeOption {
  return {
    available: true,
    unavailableReason: null,
    distanceKm: 600,
    durationMinutes: 300,
    totalCost: 100,
    co2Kg: 50,
    score: 50,
    recommended: false,
    notes: [],
    ...overrides,
  };
}

const withOptions = (options: ModeOption[]): LegComparison => ({ ...LEG_COMPARISON, options });

describe('comparisonInsight', () => {
  it('states what the recommended mode saves against the highest-emitting alternative', () => {
    // Fixture: train 44.0 kg / €150.80 (recommended), car 115.7 kg / €136.14.
    // CO₂: 115.7 - 44.0 = 71.7 → 72 kg. The car is cheaper, so no money is mentioned.
    expect(comparisonInsight(LEG_COMPARISON)).toBe('Train instead of car saves 72 kg CO₂.');
  });

  it('adds the money saved when the recommended mode is also cheaper', () => {
    const comparison = withOptions([
      option({ mode: 'TRAIN', recommended: true, co2Kg: 66, totalCost: 226.4 }),
      option({ mode: 'PLANE', co2Kg: 392.7, totalCost: 235.6 }),
      option({ mode: 'BUS', co2Kg: 55.1, totalCost: 122.5 }),
    ]);

    // Plane is the highest emitter: 392.7 - 66 = 326.7 → 327 kg; 235.6 - 226.4 = 9.2 → €9.
    expect(comparisonInsight(comparison)).toBe('Train instead of plane saves 327 kg CO₂ and €9.');
  });

  it('states the time gained when the recommended mode is the highest emitter', () => {
    const comparison = withOptions([
      option({ mode: 'PLANE', recommended: true, co2Kg: 392.7, durationMinutes: 192 }),
      option({ mode: 'TRAIN', co2Kg: 66, durationMinutes: 373 }),
      option({ mode: 'CAR', co2Kg: 115.7, durationMinutes: 464 }),
    ]);

    // Next fastest is the train: 373 - 192 = 181 min = 3 h 1 min.
    expect(comparisonInsight(comparison)).toBe(
      'Plane is 3 h 1 min faster than train, the next fastest option.',
    );
  });

  it('has nothing to say without a recommendation or without an alternative', () => {
    expect(comparisonInsight(withOptions([option({ mode: 'TRAIN' })]))).toBeNull();
    expect(
      comparisonInsight(withOptions([option({ mode: 'TRAIN', recommended: true })])),
    ).toBeNull();
    expect(
      comparisonInsight(
        withOptions([
          option({ mode: 'TRAIN', recommended: true }),
          option({ mode: 'BIKE', available: false, co2Kg: null }),
        ]),
      ),
    ).toBeNull();
  });
});

describe('ComparisonChart', () => {
  let fixture: ComponentFixture<ComparisonChart>;
  let chart: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ComparisonChart);
    fixture.componentRef.setInput('comparison', LEG_COMPARISON);
    chart = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  const rows = (): string[] =>
    Array.from(chart.querySelectorAll('.bar')).map((bar) =>
      (bar.textContent ?? '').replace(/\s+/g, ' ').trim(),
    );
  const widths = (): string[] =>
    Array.from(chart.querySelectorAll<HTMLElement>('.bar__fill')).map((fill) => fill.style.width);

  async function chooseMetric(label: string): Promise<void> {
    const radio = Array.from(chart.querySelectorAll('.segmented label'))
      .find((item) => item.textContent?.trim() === label)
      ?.querySelector('input');
    if (!radio) {
      throw new Error(`No metric ${label}`);
    }
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  it('starts with the score, best first, and marks the recommended mode in words', () => {
    expect(chart.querySelector('.insight')?.textContent).toBe(
      'Train instead of car saves 72 kg CO₂.',
    );
    expect(rows()).toEqual(['Train ★ Recommended 87 out of 100', 'Car 52 out of 100']);
    // Bars are relative to the longest: 87 → 100 %, 52 / 87 = 59.77 %.
    expect(widths()[0]).toBe('100%');
    expect(parseFloat(widths()[1])).toBeCloseTo(59.77, 1);
    expect(chart.querySelector('.bar--recommended .bar__label')?.textContent).toContain('Train');
    expect(chart.querySelector('.hint')?.textContent).toBe('Higher is better');
  });

  it('re-sorts and relabels when another metric is chosen', async () => {
    await chooseMetric('Cost');

    // Cheapest first: car €136.14, then train €150.80 (the longest bar).
    expect(rows()).toEqual(['Car €136.14', 'Train ★ Recommended €150.80']);
    expect(widths()[1]).toBe('100%');
    expect(chart.querySelector('.hint')?.textContent).toBe('Lower is better');

    await chooseMetric('Time');
    expect(rows()).toEqual(['Train ★ Recommended 6 h 13 min', 'Car 8 h 4 min']);

    await chooseMetric('CO₂');
    expect(rows()).toEqual(['Train ★ Recommended 44.0 kg', 'Car 115.7 kg']);
  });

  it('lists unavailable modes with their reason instead of a bar', () => {
    expect(chart.querySelector('.unavailable')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Bike is not available: Route of 681 km exceeds the BIKE limit of 150 km',
    );
  });

  it('gives each bar a tooltip with all four metrics', () => {
    expect(chart.querySelector('.bar')?.getAttribute('title')).toBe(
      'Train: 6 h 13 min · €150.80 · 44.0 kg CO₂ · score 87',
    );
  });
});

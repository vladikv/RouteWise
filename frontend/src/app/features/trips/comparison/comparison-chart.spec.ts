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
    unavailableCode: null,
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

  const tabs = (): HTMLElement[] => Array.from(chart.querySelectorAll<HTMLElement>('[role="tab"]'));
  const selectedTab = (): string | undefined =>
    tabs()
      .find((tab) => tab.getAttribute('aria-selected') === 'true')
      ?.textContent?.trim();

  async function chooseMetric(label: string): Promise<void> {
    const tab = tabs().find((item) => item.textContent?.trim() === label);
    if (!tab) {
      throw new Error(`No metric ${label}`);
    }
    tab.click();
    await fixture.whenStable();
  }

  it('starts with the score, best first, and marks the recommended mode in words', () => {
    expect(chart.querySelector('.insight')?.textContent).toBe(
      'Train instead of car saves 72 kg CO₂.',
    );
    expect(rows()).toEqual(['Train ★ Recommended 87 out of 100', 'Car 52 out of 100']);
    // Score bars are the score itself: 100 fills the track.
    expect(widths()).toEqual(['87%', '52%']);
    expect(chart.querySelector('.bar--recommended .bar__label')?.textContent).toContain('Train');
    expect(chart.querySelector('.hint')?.textContent).toBe('Higher is better');
  });

  it('fills the whole track for a score of 100', async () => {
    fixture.componentRef.setInput(
      'comparison',
      withOptions([option({ mode: 'TRAIN', score: 100, recommended: true })]),
    );
    await fixture.whenStable();

    expect(widths()).toEqual(['100%']);
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

  it('lists one line per unavailable group with the API message instead of a bar', () => {
    const lines = chart.querySelectorAll('.unavailable');

    expect(lines).toHaveLength(1);
    expect(lines[0].textContent?.replace(/\s+/g, ' ').trim()).toBe(
      '⊘ Too far between Berlin and Vienna for: bike',
    );
    expect(lines[0].classList).toContain('muted');
    expect(lines[0].querySelectorAll('app-mode-icon')).toHaveLength(1);
  });

  it('shows a mode icon per mode of a group, one line per group', async () => {
    fixture.componentRef.setInput('comparison', {
      ...LEG_COMPARISON,
      unavailableGroups: [
        {
          code: 'DIFFERENT_LANDMASS',
          modes: ['TRAIN', 'BUS', 'CAR'],
          message: 'Not reachable by land between Dublin and Madrid: train, bus, car',
        },
        {
          code: 'TOO_FAR',
          modes: ['BIKE'],
          message: 'Too far between Dublin and Madrid for: bike',
        },
      ],
    });
    await fixture.whenStable();

    const lines = Array.from(chart.querySelectorAll('.unavailable'));
    expect(lines).toHaveLength(2);
    expect(lines[0].querySelector('.unavailable__text')?.textContent).toContain(
      'Not reachable by land between Dublin and Madrid: train, bus, car',
    );
    expect(lines[1].querySelector('.unavailable__text')?.textContent).toContain(
      'Too far between Dublin and Madrid for: bike',
    );
    expect(lines[0].querySelectorAll('app-mode-icon')).toHaveLength(3);
    expect(lines[1].querySelectorAll('app-mode-icon')).toHaveLength(1);
  });

  it('shows no unavailable line when every mode is available', async () => {
    fixture.componentRef.setInput('comparison', { ...LEG_COMPARISON, unavailableGroups: [] });
    await fixture.whenStable();

    expect(chart.querySelector('.unavailable')).toBeNull();
  });

  it('gives each bar a tooltip with all four metrics', () => {
    expect(chart.querySelector('.bar')?.getAttribute('title')).toBe(
      'Train: 6 h 13 min · €150.80 · 44.0 kg CO₂ · score 87',
    );
  });

  it('is a tab list whose selected tab owns the bars panel', () => {
    expect(tabs().map((tab) => tab.textContent?.trim())).toEqual(['Score', 'Time', 'Cost', 'CO₂']);
    expect(chart.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Compare by');
    expect(selectedTab()).toBe('Score');
    const selected = tabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
    const panel = chart.querySelector('[role="tabpanel"]');
    expect(panel?.id).toBe(selected?.getAttribute('aria-controls'));
    expect(panel?.getAttribute('aria-labelledby')).toBe(selected?.id);
    expect(panel?.querySelectorAll('.bar')).toHaveLength(2);
  });

  it('switches the metric with the arrow keys, Home and End', async () => {
    const press = async (key: string) => {
      const current = tabs().find((tab) => tab.getAttribute('aria-selected') === 'true');
      current?.dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await fixture.whenStable();
    };

    await press('ArrowRight');
    expect(selectedTab()).toBe('Time');
    expect(rows()[0]).toBe('Train ★ Recommended 6 h 13 min');
    expect(chart.querySelector('.hint')?.textContent).toBe('Shorter is better');

    await press('End');
    expect(selectedTab()).toBe('CO₂');

    await press('ArrowRight');
    expect(selectedTab()).toBe('Score');

    await press('ArrowLeft');
    expect(selectedTab()).toBe('CO₂');
  });
});

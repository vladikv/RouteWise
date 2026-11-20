import { TestBed } from '@angular/core/testing';
import { LegComparison } from './leg-comparison';
import { AdvicePanel } from './advice-panel';
import { ComparisonPanel } from './comparison-panel';
import { ADVICE, LEG_COMPARISON } from './comparison.testing';

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map((cell) =>
    (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

describe('ComparisonPanel', () => {
  function render(comparison: LegComparison): HTMLElement {
    const fixture = TestBed.createComponent(ComparisonPanel);
    fixture.componentRef.setInput('comparison', comparison);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows time, cost, CO₂ and score side by side and marks the recommended mode', () => {
    const panel = render(LEG_COMPARISON);
    const rows = panel.querySelectorAll('tbody tr');

    expect(panel.querySelector('.summary')?.textContent).toContain('524 km straight-line');
    expect(panel.querySelector('.summary')?.textContent).toContain('2 travelers');
    expect(panel.querySelector('.summary')?.textContent).toContain('priority: Greenest');

    expect(rows[0].querySelector('th')?.textContent).toContain('Train');
    expect(rows[0].querySelector('th')?.textContent).toContain('Recommended');
    expect(rows[0].classList.contains('recommended')).toBe(true);
    expect(cells(rows[0])).toEqual(['6 h 13 min', '€150.80', '44.0 kg', '87 out of 100']);

    expect(rows[1].querySelector('th')?.textContent).not.toContain('Recommended');
    expect(rows[1].querySelector('.note')?.textContent).toBe(
      'Rain expected in Vienna, CAR score reduced',
    );
    expect(cells(rows[1])).toEqual(['8 h 4 min', '€136.14', '115.7 kg', '52 out of 100']);
  });

  describe('cost source', () => {
    const plane = (costSource: 'ESTIMATE' | 'LIVE') => ({
      ...LEG_COMPARISON.options[0],
      mode: 'PLANE' as const,
      recommended: false,
      totalCost: 237,
      costSource,
      costRetrievedAt: costSource === 'LIVE' ? '2026-11-20T09:30:00Z' : null,
    });
    const text = (element: Element | null | undefined) =>
      element?.textContent?.replace(/\s+/g, ' ').trim();

    it('labels a live plane price and says the other costs are estimates', () => {
      const panel = render({
        ...LEG_COMPARISON,
        options: [...LEG_COMPARISON.options, plane('LIVE')],
      });
      const planeRow = panel.querySelectorAll('tbody tr')[3];

      expect(text(planeRow.querySelector('.cost-source--live'))).toMatch(/^Live price ,? ?\S/);
      expect(text(panel.querySelector('.summary'))).toContain(
        "The plane's cost is the cheapest live flight on Google Flights; the other costs are estimates",
      );
    });

    it('labels an estimated plane price and keeps the estimates sentence', () => {
      const panel = render({
        ...LEG_COMPARISON,
        options: [...LEG_COMPARISON.options, plane('ESTIMATE')],
      });
      const planeRow = panel.querySelectorAll('tbody tr')[3];

      expect(text(planeRow.querySelector('.cost-source'))).toBe('Estimate');
      expect(text(panel.querySelector('.summary'))).toContain(
        'Costs are estimates from regional fuel prices, tolls and average fares.',
      );
    });

    it('labels no other mode', () => {
      expect(render(LEG_COMPARISON).querySelector('.cost-source')).toBeNull();
    });
  });

  it('says only "Not available" for an unavailable mode, without metrics', () => {
    const row = render(LEG_COMPARISON).querySelectorAll('tbody tr')[2];

    expect(row.querySelector('th')?.textContent).toContain('Bike');
    expect(cells(row)).toEqual(['⊘ Not available']);
    expect(row.querySelector('td')?.getAttribute('colspan')).toBe('4');
    expect(row.classList).toContain('unavailable');
    expect(row.querySelector('.reason__icon')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('leaves the reason out of the row whatever the API sent', () => {
    const row = render({
      ...LEG_COMPARISON,
      options: LEG_COMPARISON.options.map((option) =>
        option.mode === 'BIKE'
          ? { ...option, unavailableCode: null, unavailableReason: 'Route is closed' }
          : option,
      ),
    }).querySelectorAll('tbody tr')[2];

    expect(cells(row)).toEqual(['⊘ Not available']);
    expect(row.textContent).not.toContain('Route is closed');
  });

  it('shows the forecast with hazards as text', () => {
    const weather = render(LEG_COMPARISON).querySelector('.weather li')?.textContent ?? '';

    expect(weather).toContain('Vienna');
    expect(weather).toContain('Rain');
    expect(weather.replace(/\s+/g, ' ')).toContain('4 to 9 °C');
    expect(weather).toContain('90% precipitation');
    expect(weather).toContain('⚠ Rain');
  });

  it('says so when there is no forecast', () => {
    const panel = render({ ...LEG_COMPARISON, weather: [] });

    expect(panel.querySelector('.weather')).toBeNull();
    expect(panel.textContent).toContain('No forecast is available for this date');
  });
});

describe('AdvicePanel', () => {
  function render(advice: typeof ADVICE): HTMLElement {
    const fixture = TestBed.createComponent(AdvicePanel);
    fixture.componentRef.setInput('advice', advice);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the summary, the tips and a rule-based source', () => {
    const panel = render(ADVICE);

    expect(panel.querySelector('.summary')?.textContent).toBe(
      'Take the train from Berlin to Vienna.',
    );
    const tips = Array.from(panel.querySelectorAll('.tips li')).map((tip) => tip.textContent);
    expect(tips).toEqual(['Alternative: car, 1 h 51 min slower.', 'Pack an umbrella.']);
    expect(panel.querySelector('.badge')?.textContent).toBe('Rule-based advisor');
    expect(panel.querySelector('.source')?.textContent).toContain('without AI');
  });

  it('labels AI advice as AI and omits an empty tip list', () => {
    const panel = render({ ...ADVICE, source: 'AI', tips: [] });

    expect(panel.querySelector('.badge')?.textContent).toBe('AI advisor');
    expect(panel.querySelector('.source')?.textContent).toContain('Written by AI');
    expect(panel.querySelector('.tips')).toBeNull();
  });
});

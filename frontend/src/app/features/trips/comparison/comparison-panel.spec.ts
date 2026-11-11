import { TestBed } from '@angular/core/testing';
import { Comparison } from '../../../core/api/models';
import { AdvicePanel } from './advice-panel';
import { ComparisonPanel } from './comparison-panel';
import { ADVICE, COMPARISON } from './comparison.testing';

function cells(row: Element): string[] {
  return Array.from(row.querySelectorAll('td')).map((cell) =>
    (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

describe('ComparisonPanel', () => {
  function render(comparison: Comparison): HTMLElement {
    const fixture = TestBed.createComponent(ComparisonPanel);
    fixture.componentRef.setInput('comparison', comparison);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows time, cost, CO₂ and score side by side and marks the recommended mode', () => {
    const panel = render(COMPARISON);
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

  it('explains why a mode is unavailable instead of showing metrics', () => {
    const row = render(COMPARISON).querySelectorAll('tbody tr')[2];

    expect(row.querySelector('th')?.textContent).toContain('Bike');
    expect(cells(row)).toEqual(['Not available: Route of 681 km exceeds the BIKE limit of 150 km']);
    expect(row.querySelector('td')?.getAttribute('colspan')).toBe('4');
  });

  it('shows the forecast with hazards as text', () => {
    const weather = render(COMPARISON).querySelector('.weather li')?.textContent ?? '';

    expect(weather).toContain('Vienna');
    expect(weather).toContain('Rain');
    expect(weather.replace(/\s+/g, ' ')).toContain('4 to 9 °C');
    expect(weather).toContain('90% precipitation');
    expect(weather).toContain('⚠ Rain');
  });

  it('says so when there is no forecast', () => {
    const panel = render({ ...COMPARISON, weather: [] });

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

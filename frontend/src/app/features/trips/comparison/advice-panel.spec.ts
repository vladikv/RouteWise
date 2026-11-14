import { TestBed } from '@angular/core/testing';
import { Advice, ItineraryTotals } from '../../../core/api/models';
import { AdvicePanel } from './advice-panel';
import { ADVICE } from './comparison.testing';
import { LegFocus } from './leg-focus';

const LOOP: Advice = {
  ...ADVICE,
  recommendedModes: ['TRAIN', null, 'PLANE'],
  summary: 'Recommended plan for Berlin → Prague → Vienna → Munich.',
  legs: [
    'Leg 1, Berlin to Prague: train.',
    'Leg 2, Prague to Vienna: no mode.',
    'Leg 3, Vienna to Munich: plane.',
  ],
};
const PLAN: ItineraryTotals = {
  modes: ['TRAIN', 'BUS'],
  durationMinutes: 510,
  totalCost: 226.4,
  co2Kg: 66.2,
};

describe('AdvicePanel', () => {
  async function render(
    advice: Advice,
    figures: ItineraryTotals | null = null,
    withFocus = false,
  ): Promise<HTMLElement> {
    if (withFocus) {
      TestBed.configureTestingModule({ providers: [LegFocus] });
    }
    const fixture = TestBed.createComponent(AdvicePanel);
    fixture.componentRef.setInput('advice', advice);
    fixture.componentRef.setInput('figures', figures);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element | null) => element?.textContent?.replace(/\s+/g, ' ').trim();

  it("leads with the plan's key figures when the comparison has them", async () => {
    const panel = await render(ADVICE, PLAN);

    const chips = Array.from(
      panel.querySelectorAll('.figures li'),
      (li) => `${text(li.querySelector('.value'))} | ${text(li.querySelector('.label'))}`,
    );
    expect(chips).toEqual([
      '8 h 30 min | Travel time',
      '€226 | Cost for all travelers',
      '66 kg | CO₂',
    ]);
    expect(panel.querySelector('.figures')?.getAttribute('aria-label')).toBe(
      'Recommended plan in total',
    );
    expect(panel.firstElementChild?.classList).toContain('figures');
  });

  it('shows no figures without them', async () => {
    const panel = await render(ADVICE);

    expect(panel.querySelector('.figures')).toBeNull();
    expect(text(panel.querySelector('.summary'))).toBe('Take the train from Berlin to Vienna.');
  });

  it("shows one row per leg with the mode's icon and the advisor's sentence as written", async () => {
    const panel = await render(LOOP);

    const rows = Array.from(panel.querySelectorAll('.legs .leg'));
    expect(rows.map((row) => text(row.querySelector('.leg__text')))).toEqual(LOOP.legs);
    expect(rows.map((row) => text(row.querySelector('.leg__number')))).toEqual(['1', '2', '3']);
    expect(rows[0].querySelector('app-mode-icon')).not.toBeNull();
    expect(rows[1].querySelector('app-mode-icon')).toBeNull();
    expect(text(rows[1].querySelector('.leg__mode--none'))).toBe('⊘');
  });

  it('keeps a single-leg plan to the summary, without a leg list', async () => {
    const panel = await render(ADVICE);

    expect(panel.querySelector('.legs')).toBeNull();
  });

  it('shows each tip as a callout and says who wrote the advice', async () => {
    const panel = await render(ADVICE);

    expect(Array.from(panel.querySelectorAll('.tip'), (tip) => text(tip))).toEqual(ADVICE.tips);
    expect(text(panel.querySelector('.source'))).toBe(
      'Rule-based advisor Generated from the comparison below without AI.',
    );
  });

  it('offers the map toggles only where there is a map to show the leg on', async () => {
    expect((await render(LOOP)).querySelector('app-leg-map-toggle button')).toBeNull();

    TestBed.resetTestingModule();
    const panel = await render(LOOP, null, true);
    expect(
      Array.from(panel.querySelectorAll('app-leg-map-toggle button'), (button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Show leg 1 on the map', 'Show leg 2 on the map', 'Show leg 3 on the map']);
  });
});

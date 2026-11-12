import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TabOption, Tabs } from './tabs';

type Metric = 'score' | 'time' | 'cost' | 'co2';

@Component({
  imports: [Tabs],
  template: `
    <app-tabs #tabs ariaLabel="Compare by" [options]="options" [(value)]="metric" />
    <div
      role="tabpanel"
      [id]="tabs.panelId(metric())"
      [attr.aria-labelledby]="tabs.tabId(metric())"
    >
      {{ metric() }}
    </div>
  `,
})
class Host {
  readonly options: TabOption<Metric>[] = [
    { value: 'score', label: 'Score' },
    { value: 'time', label: 'Time' },
    { value: 'cost', label: 'Cost' },
    { value: 'co2', label: 'CO₂' },
  ];
  readonly metric = signal<Metric>('score');
}

describe('Tabs', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const tabs = () => Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
    const press = async (target: HTMLElement, key: string) => {
      target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      await fixture.whenStable();
    };
    return { fixture, element, tabs, press };
  }

  it('renders a labelled tablist with the selected tab as the only tab stop', async () => {
    const { element, tabs } = await setup();

    expect(element.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe(
      'Compare by',
    );
    expect(tabs().map((tab) => tab.getAttribute('aria-selected'))).toEqual([
      'true',
      'false',
      'false',
      'false',
    ]);
    expect(tabs().map((tab) => tab.tabIndex)).toEqual([0, -1, -1, -1]);
    element.remove();
  });

  it('links each tab to the parent-rendered panel', async () => {
    const { fixture, element, tabs } = await setup();
    tabs()[2].click();
    await fixture.whenStable();

    const panel = element.querySelector('[role="tabpanel"]')!;
    expect(tabs()[2].getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tabs()[2].id);
    expect(panel.textContent).toContain('cost');
    element.remove();
  });

  it('supports arrow keys, Home and End', async () => {
    const { fixture, element, tabs, press } = await setup();
    tabs()[0].focus();

    await press(tabs()[0], 'ArrowRight');
    expect(fixture.componentInstance.metric()).toBe('time');
    expect(document.activeElement).toBe(tabs()[1]);

    await press(tabs()[1], 'End');
    expect(fixture.componentInstance.metric()).toBe('co2');
    expect(document.activeElement).toBe(tabs()[3]);

    await press(tabs()[3], 'ArrowRight');
    expect(fixture.componentInstance.metric()).toBe('score');

    await press(tabs()[0], 'ArrowLeft');
    expect(fixture.componentInstance.metric()).toBe('co2');

    await press(tabs()[3], 'Home');
    expect(fixture.componentInstance.metric()).toBe('score');
    expect(document.activeElement).toBe(tabs()[0]);
    element.remove();
  });
});

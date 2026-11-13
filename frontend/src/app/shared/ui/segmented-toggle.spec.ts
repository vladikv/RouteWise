import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SegmentedToggle, ToggleOption } from './segmented-toggle';

type View = 'board' | 'list';

@Component({
  imports: [SegmentedToggle],
  template: `<app-segmented-toggle ariaLabel="View" [options]="options" [(value)]="view" />`,
})
class Host {
  readonly options: ToggleOption<View>[] = [
    { value: 'board', label: 'Board' },
    { value: 'list', label: 'List' },
  ];
  readonly view = signal<View>('board');
}

describe('SegmentedToggle', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const radios = () => Array.from(element.querySelectorAll<HTMLElement>('[role="radio"]'));
    return { fixture, element, radios };
  }

  it('is a labelled radio group with one tab stop', async () => {
    const { element, radios } = await setup();

    expect(element.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('View');
    expect(radios().map((radio) => radio.getAttribute('aria-checked'))).toEqual(['true', 'false']);
    expect(radios().map((radio) => radio.tabIndex)).toEqual([0, -1]);
    element.remove();
  });

  it('shows an optional decorative icon next to the visible label', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.options[0].icon = 'M3 5h18v14H3z';
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const radios = element.querySelectorAll<HTMLElement>('[role="radio"]');

    expect(radios[0].querySelector('svg[aria-hidden="true"] path')?.getAttribute('d')).toBe(
      'M3 5h18v14H3z',
    );
    expect(radios[0].textContent).toContain('Board');
    expect(radios[1].querySelector('svg')).toBeNull();
    element.remove();
  });

  it('selects on click', async () => {
    const { fixture, element, radios } = await setup();
    radios()[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.view()).toBe('list');
    expect(radios()[1].getAttribute('aria-checked')).toBe('true');
    expect(radios()[1].tabIndex).toBe(0);
    element.remove();
  });

  it('moves selection and focus with the arrow keys, wrapping around', async () => {
    const { fixture, element, radios } = await setup();
    radios()[0].focus();
    radios()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();

    expect(fixture.componentInstance.view()).toBe('list');
    expect(document.activeElement).toBe(radios()[1]);

    radios()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.view()).toBe('board');
    expect(document.activeElement).toBe(radios()[0]);
    element.remove();
  });
});

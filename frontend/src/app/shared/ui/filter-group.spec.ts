import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FilterGroup, FilterIcon, FilterOption } from './filter-group';

@Component({
  imports: [FilterGroup, FilterIcon],
  template: `
    <app-filter-group
      label="Priority"
      [options]="options"
      [(selected)]="selected"
      [unit]="{ one: 'trip', other: 'trips' }"
    >
      <ng-template appFilterIcon let-option
        ><i class="icon">{{ option.value }}</i></ng-template
      >
    </app-filter-group>
  `,
})
class Host {
  readonly options: FilterOption[] = [
    { value: 'fast', label: 'Fastest', count: 2 },
    { value: 'cheap', label: 'Cheapest', count: 1 },
    { value: 'green', label: 'Greenest' },
  ];
  readonly selected = signal<string[]>(['cheap']);
}

describe('FilterGroup', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const chips = () => Array.from(root.querySelectorAll<HTMLButtonElement>('button'));

  it('is a group named by its visible label', () => {
    const group = root.querySelector('[role="group"]')!;
    const label = root.querySelector(`#${group.getAttribute('aria-labelledby')}`);
    expect(label?.textContent).toBe('Priority');
  });

  it('renders one pressed-state toggle per option with the count in its name', () => {
    expect(chips().map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'Fastest, 2 trips',
      'Cheapest, 1 trip',
      'Greenest',
    ]);
    expect(chips().map((chip) => chip.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
    expect(chips()[1].textContent).toContain('✓');
  });

  it('shows the count as a badge and the icon template before the label', () => {
    expect(chips()[0].querySelector('.count')?.textContent).toBe('2');
    expect(chips()[2].querySelector('.count')).toBeNull();
    expect(chips()[0].querySelector('.icon')?.textContent).toBe('fast');
  });

  it('toggles values in the selected model', async () => {
    chips()[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual(['cheap', 'fast']);
    expect(chips()[0].getAttribute('aria-pressed')).toBe('true');

    chips()[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selected()).toEqual(['fast']);
  });
});

import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterChip } from './filter-chip';

@Component({
  imports: [FilterChip],
  template: `<app-filter-chip label="Cheap" [count]="count()" [(selected)]="selected" />`,
})
class Host {
  readonly selected = signal(false);
  readonly count = signal<number | undefined>(3);
}

describe('FilterChip', () => {
  it('toggles aria-pressed and the bound model on click', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.selected()).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('✓');
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the count only when given', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.count')?.textContent).toBe('3');

    fixture.componentInstance.count.set(undefined);
    await fixture.whenStable();
    expect(element.querySelector('.count')).toBeNull();
  });
});

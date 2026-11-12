import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StatChip } from './stat-chip';

@Component({
  imports: [StatChip],
  template: `
    <app-stat-chip [value]="'12'" label="Trips" [loading]="loading()">
      <svg icon data-testid="icon"></svg>
    </app-stat-chip>
  `,
})
class Host {
  readonly loading = signal(false);
}

describe('StatChip', () => {
  it('shows the value, the label and the projected icon', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('12');
    expect(element.textContent).toContain('Trips');
    expect(element.querySelector('.icon [data-testid="icon"]')).not.toBeNull();
    expect(element.querySelector('app-stat-chip')?.hasAttribute('aria-busy')).toBe(false);
  });

  it('shows a placeholder and aria-busy while loading', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.loading.set(true);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-stat-chip')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.value')?.textContent).toBe('');
    expect(element.textContent).not.toContain('12');
    expect(element.querySelector('.visually-hidden')?.textContent).toBe('Loading');
    expect(element.textContent).toContain('Trips');
  });
});

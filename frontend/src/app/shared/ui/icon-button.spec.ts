import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IconButton } from './icon-button';

@Component({
  imports: [IconButton],
  template: `
    <app-icon-button
      label="Zoom in"
      [pressed]="pressed()"
      [expanded]="expanded()"
      (click)="clicks.set(clicks() + 1)"
    >
      <svg data-testid="icon"></svg>
    </app-icon-button>
  `,
})
class Host {
  readonly pressed = signal<boolean | undefined>(undefined);
  readonly expanded = signal<boolean | undefined>(undefined);
  readonly clicks = signal(0);
}

describe('IconButton', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    return { fixture, button };
  }

  it('is named by its label and holds the icon', async () => {
    const { button } = await setup();

    expect(button.getAttribute('aria-label')).toBe('Zoom in');
    expect(button.getAttribute('title')).toBe('Zoom in');
    expect(button.getAttribute('type')).toBe('button');
    expect(button.querySelector('[data-testid="icon"]')).not.toBeNull();
  });

  it('only sets aria-pressed and aria-expanded when given', async () => {
    const { fixture, button } = await setup();
    expect(button.hasAttribute('aria-pressed')).toBe(false);
    expect(button.hasAttribute('aria-expanded')).toBe(false);

    fixture.componentInstance.pressed.set(false);
    fixture.componentInstance.expanded.set(true);
    await fixture.whenStable();

    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('lets clicks reach the host', async () => {
    const { fixture, button } = await setup();
    button.click();
    expect(fixture.componentInstance.clicks()).toBe(1);
  });
});

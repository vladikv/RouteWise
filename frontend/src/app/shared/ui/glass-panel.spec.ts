import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GlassPanel } from './glass-panel';

@Component({
  imports: [GlassPanel],
  template: `
    <app-glass-panel heading="Filters" [collapsible]="collapsible()" [(collapsed)]="collapsed">
      <p>Inside</p>
    </app-glass-panel>
  `,
})
class Host {
  readonly collapsible = signal(true);
  readonly collapsed = signal(false);
}

describe('GlassPanel', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders a static heading and content when not collapsible', async () => {
    const { fixture, element } = await setup();
    fixture.componentInstance.collapsible.set(false);
    await fixture.whenStable();

    expect(element.querySelector('h2')?.textContent).toContain('Filters');
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('p')?.textContent).toBe('Inside');
  });

  it('toggles the body with the header button and keeps aria in sync', async () => {
    const { fixture, element } = await setup();
    const button = element.querySelector('button') as HTMLButtonElement;
    const body = element.querySelector('.body') as HTMLElement;

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(button.getAttribute('aria-controls')).toBe(body.id);
    expect(body.hidden).toBe(false);

    button.click();
    await fixture.whenStable();

    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(body.hidden).toBe(true);
  });

  it('starts collapsed when told to', async () => {
    const { fixture, element } = await setup();
    fixture.componentInstance.collapsed.set(true);
    await fixture.whenStable();

    expect(element.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    expect((element.querySelector('.body') as HTMLElement).hidden).toBe(true);
  });
});

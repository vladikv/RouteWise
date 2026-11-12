import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BottomSheet, SheetState } from './bottom-sheet';

@Component({
  imports: [BottomSheet],
  template: ` <app-bottom-sheet [(state)]="state"><p>Results</p></app-bottom-sheet> `,
})
class Host {
  readonly state = signal<SheetState>('peek');
}

describe('BottomSheet', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const handle = element.querySelector('button.handle') as HTMLButtonElement;
    const header = element.querySelector('.header') as HTMLElement;
    const pointer = async (type: string, clientY: number) => {
      header.dispatchEvent(new MouseEvent(type, { clientY, bubbles: true }));
      await fixture.whenStable();
    };
    const drag = async (from: number, to: number) => {
      await pointer('pointerdown', from);
      await pointer('pointermove', to);
      await pointer('pointerup', to);
    };
    return { fixture, element, handle, drag };
  }

  it('starts in peek with a labelled handle button controlling the body', async () => {
    const { element, handle } = await setup();
    const body = element.querySelector('.body') as HTMLElement;

    expect(handle.getAttribute('aria-label')).toBe('Show/Hide trip settings and results');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    expect(handle.getAttribute('aria-controls')).toBe(body.id);
    expect(body.hasAttribute('inert')).toBe(true);
  });

  it('toggles by click and updates aria-expanded', async () => {
    const { fixture, element, handle } = await setup();

    handle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('expanded');
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.body')?.hasAttribute('inert')).toBe(false);

    handle.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.state()).toBe('peek');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
  });

  it('is a native button, so Enter and Space activate it', async () => {
    const { handle } = await setup();
    expect(handle.tagName).toBe('BUTTON');
    expect(handle.type).toBe('button');
  });

  it('expands when dragged up past the threshold', async () => {
    const { fixture, handle, drag } = await setup();
    await drag(500, 380);

    expect(fixture.componentInstance.state()).toBe('expanded');
    expect(handle.getAttribute('aria-expanded')).toBe('true');
  });

  it('snaps back after a small drag', async () => {
    const { fixture, drag } = await setup();
    await drag(500, 470);

    expect(fixture.componentInstance.state()).toBe('peek');
  });

  it('collapses when dragged down past the threshold', async () => {
    const { fixture, handle, drag } = await setup();
    handle.click();
    await fixture.whenStable();
    await drag(100, 220);

    expect(fixture.componentInstance.state()).toBe('peek');
  });
});

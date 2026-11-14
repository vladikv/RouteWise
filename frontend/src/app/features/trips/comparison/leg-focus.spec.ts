import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LegFocus, LegHover, LegMapToggle } from './leg-focus';

describe('LegFocus', () => {
  let focus: LegFocus;

  beforeEach(() => {
    focus = new LegFocus();
  });

  it('shows the whole route until a leg is hovered or pinned', () => {
    expect(focus.focused()).toBeNull();
  });

  it('lets a hovered leg win over the pinned one and returns to it on leave', () => {
    focus.togglePin(2);
    focus.hover(0);
    expect(focus.focused()).toBe(0);

    focus.leave(0);
    expect(focus.focused()).toBe(2);
  });

  it('ignores leaving a leg that is no longer the hovered one', () => {
    focus.hover(0);
    focus.hover(1);
    focus.leave(0);

    expect(focus.focused()).toBe(1);
  });

  it('unpins a leg chosen again and moves the pin to another leg', () => {
    focus.togglePin(1);
    focus.togglePin(3);
    expect(focus.pinned()).toBe(3);

    focus.togglePin(3);
    expect(focus.pinned()).toBeNull();
  });
});

@Component({
  imports: [LegHover, LegMapToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (leg of [0, 1]; track leg) {
      <div class="row" [appLegHover]="leg">
        Leg {{ leg + 1 }}
        <app-leg-map-toggle [leg]="leg" />
      </div>
    }
  `,
})
class Rows {}

describe('LegHover and LegMapToggle', () => {
  let fixture: ComponentFixture<Rows>;
  let root: HTMLElement;
  let focus: LegFocus;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [LegFocus] });
    fixture = TestBed.createComponent(Rows);
    root = fixture.nativeElement as HTMLElement;
    focus = TestBed.inject(LegFocus);
    await fixture.whenStable();
  });

  const rows = () => Array.from(root.querySelectorAll<HTMLElement>('.row'));
  const toggle = (index: number) => rows()[index].querySelector<HTMLButtonElement>('button')!;
  const active = () => rows().map((row) => row.classList.contains('leg-hover--active'));

  it('focuses the leg of a row under the pointer and lets go when it leaves', async () => {
    rows()[1].dispatchEvent(new PointerEvent('pointerenter'));
    await fixture.whenStable();
    expect(focus.focused()).toBe(1);
    expect(active()).toEqual([false, true]);

    rows()[1].dispatchEvent(new PointerEvent('pointerleave'));
    await fixture.whenStable();
    expect(focus.focused()).toBeNull();
    expect(active()).toEqual([false, false]);
  });

  it('focuses the leg while keyboard focus is inside its row', async () => {
    toggle(0).dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await fixture.whenStable();
    expect(focus.focused()).toBe(0);

    toggle(0).dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(focus.focused()).toBeNull();
  });

  it('pins a leg with its toggle, states it in aria-pressed, and unpins it again', async () => {
    toggle(1).click();
    await fixture.whenStable();
    expect(focus.pinned()).toBe(1);
    expect(toggle(1).getAttribute('aria-pressed')).toBe('true');
    expect(toggle(0).getAttribute('aria-pressed')).toBe('false');
    expect(active()).toEqual([false, true]);

    toggle(1).click();
    await fixture.whenStable();
    expect(focus.pinned()).toBeNull();
    expect(toggle(1).getAttribute('aria-pressed')).toBe('false');
  });
});

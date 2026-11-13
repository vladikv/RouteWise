import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Menu, MenuContent } from './menu';

@Component({
  imports: [Menu, MenuContent],
  template: `
    <button type="button" id="outside">Outside</button>
    <app-menu label="Actions" panelId="actions" [(open)]="open" [closeOnSelect]="closeOnSelect()">
      <svg menuIcon viewBox="0 0 24 24" aria-hidden="true"><path d="M0 0" /></svg>
      <ng-template appMenuContent>
        <button type="button" (click)="picked.set('one')">One</button>
        <a href="#two">Two</a>
        <button type="button" disabled>Disabled</button>
        <button type="button">Three</button>
      </ng-template>
    </app-menu>
    <app-menu panelId="custom">
      <button type="button" menuTrigger id="custom-trigger">Custom</button>
      <ng-template appMenuContent><button type="button">Item</button></ng-template>
    </app-menu>
    <app-menu panelId="popover" [focusOnOpen]="true">
      <button type="button" menuTrigger id="popover-trigger">Popover</button>
      <ng-template appMenuContent>
        <p>Signed in</p>
        <a href="#first" id="first-item">First</a>
        <button type="button">Second</button>
      </ng-template>
    </app-menu>
  `,
})
class Host {
  readonly open = signal(false);
  readonly closeOnSelect = signal(true);
  readonly picked = signal('');
}

describe('Menu', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const trigger = () => root.querySelector<HTMLButtonElement>('button[aria-label="Actions"]')!;
  const panel = () => root.querySelector('#actions');

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function key(target: Element, name: string): void {
    target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
  }

  it('renders only the trigger while closed, with aria-expanded and aria-controls', () => {
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().getAttribute('aria-controls')).toBe('actions');
    expect(panel()).toBeNull();
  });

  it('opens on click and reflects the state in the open model', async () => {
    trigger().click();
    await settle();

    expect(panel()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.open()).toBe(true);

    trigger().click();
    await settle();
    expect(panel()).toBeNull();
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('closes with Escape and returns focus to the trigger', async () => {
    trigger().click();
    await settle();
    root.querySelector<HTMLElement>('#actions button')!.focus();

    key(document.activeElement!, 'Escape');
    await settle();

    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes on a click outside but not on a click inside the panel padding', async () => {
    trigger().click();
    await settle();
    panel()!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await settle();
    expect(panel()).not.toBeNull();

    root.querySelector<HTMLElement>('#outside')!.click();
    await settle();
    expect(panel()).toBeNull();
  });

  it('closes after an item is activated and focuses the trigger', async () => {
    trigger().click();
    await settle();

    root.querySelector<HTMLButtonElement>('#actions button')!.click();
    await settle();

    expect(fixture.componentInstance.picked()).toBe('one');
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('stays open after an item when closeOnSelect is off', async () => {
    fixture.componentInstance.closeOnSelect.set(false);
    await settle();
    trigger().click();
    await settle();

    root.querySelector<HTMLButtonElement>('#actions button')!.click();
    await settle();

    expect(panel()).not.toBeNull();
  });

  it('moves focus between enabled items with the arrow keys, wrapping around', async () => {
    trigger().click();
    await settle();
    const items = Array.from(
      root.querySelectorAll<HTMLElement>('#actions button:not(:disabled), #actions a'),
    );
    expect(items.map((item) => item.textContent)).toEqual(['One', 'Two', 'Three']);

    trigger().focus();
    key(trigger(), 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    key(items[0], 'ArrowDown');
    expect(document.activeElement).toBe(items[1]);
    key(items[1], 'ArrowDown');
    key(items[2], 'ArrowDown');
    expect(document.activeElement).toBe(items[0]);
    key(items[0], 'ArrowUp');
    expect(document.activeElement).toBe(items[2]);
    key(items[2], 'Home');
    expect(document.activeElement).toBe(items[0]);
    key(items[0], 'End');
    expect(document.activeElement).toBe(items[2]);
  });

  it('opens with ArrowDown on the closed trigger and focuses the first item', async () => {
    trigger().focus();
    key(trigger(), 'ArrowDown');
    await settle();

    expect(panel()).not.toBeNull();
    expect(document.activeElement?.textContent).toBe('One');
  });

  it('wires a custom trigger with aria attributes and toggles on click', async () => {
    const custom = root.querySelector<HTMLButtonElement>('#custom-trigger')!;
    expect(custom.getAttribute('aria-expanded')).toBe('false');
    expect(custom.getAttribute('aria-controls')).toBe('custom');

    custom.click();
    await settle();
    expect(custom.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('#custom')).not.toBeNull();

    key(custom, 'Escape');
    await settle();
    expect(root.querySelector('#custom')).toBeNull();
    expect(document.activeElement).toBe(custom);
  });

  it('moves focus into the panel on open with focusOnOpen, and back to the trigger on Escape', async () => {
    const trigger = root.querySelector<HTMLButtonElement>('#popover-trigger')!;
    const outside = root.querySelector<HTMLButtonElement>('#outside')!;
    document.body.append(root);

    trigger.focus();
    trigger.click();
    await settle();
    expect(document.activeElement?.id).toBe('first-item');

    key(document.activeElement!, 'Escape');
    await settle();
    expect(root.querySelector('#popover')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    outside.click();
    root.remove();
  });

  it('leaves focus on the trigger when focusOnOpen is off', async () => {
    document.body.append(root);
    const custom = root.querySelector<HTMLButtonElement>('#custom-trigger')!;

    custom.focus();
    custom.click();
    await settle();

    expect(document.activeElement).toBe(custom);
    root.remove();
  });

  describe('Escape', () => {
    it('is ignored when it came from a dialog opened over the menu, or was handled already', async () => {
      const popover = root.querySelector<HTMLButtonElement>('#popover-trigger')!;
      popover.click();
      await settle();
      const dialog = document.createElement('dialog');
      const field = document.createElement('input');
      dialog.appendChild(field);
      root.appendChild(dialog);

      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(root.querySelector('#popover')).not.toBeNull();

      const handled = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      handled.preventDefault();
      popover.dispatchEvent(handled);
      await settle();
      expect(root.querySelector('#popover')).not.toBeNull();

      popover.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();
      expect(root.querySelector('#popover')).toBeNull();
    });
  });
});

@Component({
  imports: [Menu, MenuContent],
  template: `
    <app-menu panelId="late" [focusOnOpen]="true">
      <button type="button" menuTrigger id="late-trigger">Late</button>
      <ng-template appMenuContent>
        @if (ready()) {
          <a href="#late-item" id="late-item">Loaded</a>
        } @else {
          <p>Loading…</p>
        }
      </ng-template>
    </app-menu>
    <button type="button" id="elsewhere">Elsewhere</button>
  `,
})
class LateHost {
  readonly ready = signal(false);
}

describe('Menu with content that arrives later', () => {
  let fixture: ComponentFixture<LateHost>;
  let root: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(LateHost);
    root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  async function openAndLoad(moveFocusTo?: string): Promise<void> {
    const trigger = root.querySelector<HTMLButtonElement>('#late-trigger')!;
    trigger.focus();
    trigger.click();
    await fixture.whenStable();
    if (moveFocusTo) {
      root.querySelector<HTMLElement>(moveFocusTo)!.focus();
    }
    fixture.componentInstance.ready.set(true);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
  }

  it('moves focus to the first item once it renders, if focus is still on the trigger', async () => {
    await openAndLoad();

    expect(document.activeElement?.id).toBe('late-item');
  });

  it('leaves focus alone when the user has moved on', async () => {
    await openAndLoad('#elsewhere');

    expect(document.activeElement?.id).toBe('elsewhere');
  });
});

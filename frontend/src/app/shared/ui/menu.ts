import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  afterRenderEffect,
  Directive,
  contentChild,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';
import { IconButton } from './icon-button';

let nextId = 0;

/** Marks the `<ng-template>` that holds a `Menu`'s panel content: `<ng-template appMenuContent>`. */
@Directive({ selector: 'ng-template[appMenuContent]' })
export class MenuContent {
  readonly template = inject(TemplateRef);
}

const ITEM_SELECTOR = 'a[href], button:not(:disabled), [role="menuitem"]';

/**
 * Disclosure menu, also used as a popover (the account panel: `focusOnOpen`). The trigger is either the built-in round `IconButton` (set `label`, project the
 * icon with the `menuIcon` attribute) or your own button projected with the `menuTrigger` attribute
 * (leave `label` unset). The panel content is an `<ng-template appMenuContent>` child, rendered only while open.
 *
 * Escape closes the menu and returns focus to the trigger, so does a click on an item (links,
 * buttons; turn off with `closeOnSelect`). A click outside closes it. ArrowDown / ArrowUp / Home /
 * End move between the items; ArrowDown on the closed trigger opens it.
 */
@Component({
  selector: 'app-menu',
  imports: [IconButton, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'closeOnOutsideClick($event)',
    '(document:keydown.escape)': 'closeWithFocus()',
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
  },
  template: `
    <div #trigger class="trigger">
      @if (label(); as text) {
        <app-icon-button [label]="text" [controls]="panelId()" [expanded]="open()">
          <ng-content select="[menuIcon]" />
        </app-icon-button>
      }
      <ng-content select="[menuTrigger]" />
    </div>
    @if (open()) {
      <div
        class="menu-panel"
        [class.menu-panel--beside]="placement() === 'beside'"
        [id]="panelId()"
      >
        <ng-container [ngTemplateOutlet]="content().template" />
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }

    .menu-panel {
      position: absolute;
      top: calc(100% + var(--space-2));
      right: 0;
      z-index: 10;
      display: grid;
      gap: var(--space-1);
      width: max-content;
      min-width: 12rem;
      max-width: min(20rem, calc(100vw - 2 * var(--space-4)));
      padding: var(--space-2);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      background: var(--glass-bg-menu);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight), var(--shadow-raised);
      animation: menu-panel-in 0.15s ease;
    }

    .menu-panel--beside {
      top: 0;
      right: calc(100% + var(--space-2));
      min-width: 0;
      max-width: 14rem;
    }

    @keyframes menu-panel-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .menu-panel {
        animation: none;
      }
    }
  `,
})
export class Menu {
  /** Accessible name of the built-in icon trigger; leave unset to project your own trigger. */
  readonly label = input<string>();
  readonly open = model(false);
  /** `below`: under the trigger, right-aligned. `beside`: left of the trigger, top-aligned. */
  readonly placement = input<'below' | 'beside'>('below');
  /** Close (and refocus the trigger) after a link, button or `menuitem` in the panel is activated. */
  readonly closeOnSelect = input(true);
  readonly panelId = input(`menu-${nextId++}`);
  /** Move focus to the first item whenever the panel opens (for a popover with its own content). */
  readonly focusOnOpen = input(false);

  protected readonly content = contentChild.required(MenuContent);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

  constructor() {
    afterRenderEffect(() => {
      const custom = this.trigger().nativeElement.querySelector('[menutrigger]');
      custom?.setAttribute('aria-expanded', String(this.open()));
      custom?.setAttribute('aria-controls', this.panelId());
    });
    afterRenderEffect(() => {
      if (this.open() && this.focusOnOpen()) {
        this.items()[0]?.focus();
      }
    });
  }

  protected onClick(event: Event): void {
    const target = event.target as Element;
    if (this.trigger().nativeElement.contains(target)) {
      this.open.update((open) => !open);
    } else if (this.closeOnSelect() && target.closest(`.menu-panel :is(${ITEM_SELECTOR})`)) {
      this.closeWithFocus();
    }
  }

  protected closeWithFocus(): void {
    if (this.open()) {
      this.open.set(false);
      this.focusTrigger();
    }
  }

  protected closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const key = event.key;
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      return;
    }
    const inTrigger = this.trigger().nativeElement.contains(event.target as Node);
    if (!this.open()) {
      if (inTrigger && key === 'ArrowDown') {
        event.preventDefault();
        this.open.set(true);
        afterNextRender(() => this.items()[0]?.focus(), { injector: this.injector });
      }
      return;
    }
    const items = this.items();
    if (items.length === 0) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLElement);
    const down = key === 'ArrowDown';
    const target =
      key === 'Home' || (inTrigger && down)
        ? 0
        : key === 'End'
          ? items.length - 1
          : down
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    event.preventDefault();
    items[target].focus();
  }

  private items(): HTMLElement[] {
    const panel = this.host.nativeElement.querySelector('.menu-panel');
    const items = panel ? Array.from(panel.querySelectorAll<HTMLElement>(ITEM_SELECTOR)) : [];
    return items.sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  }

  private focusTrigger(): void {
    this.trigger().nativeElement.querySelector<HTMLElement>('button')?.focus();
  }
}

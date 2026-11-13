import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, input, output } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { Menu, MenuContent } from './menu';

export interface RailItem {
  /** Accessible name and tooltip. */
  label: string;
  /** The `d` of one 24 by 24 stroked SVG path. */
  icon: string;
  /** A page to open. */
  link?: string;
  /** Content of a popover that opens to the right of the item (rendered only while open). */
  popover?: TemplateRef<unknown>;
  /** Keyboard shortcut: `label` follows the item's label in the tooltip, `aria` is `aria-keyshortcuts`. */
  shortcut?: { label: string; aria: string };
}

/**
 * Vertical glass icon rail. Every item is a labelled link (the current page gets `aria-current`),
 * a button that opens its `popover` (a `Menu` to the right of the rail), or otherwise a button that
 * emits `activate`. Icons are decorative; the tooltip is the label plus the item's shortcut.
 */
@Component({
  selector: 'app-icon-rail',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Menu, MenuContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ul>
        @for (item of items(); track item.label) {
          <li>
            @if (item.link; as link) {
              <a
                [routerLink]="link"
                routerLinkActive="active"
                ariaCurrentWhenActive="page"
                [routerLinkActiveOptions]="exactPath"
                [attr.aria-label]="item.label"
                [attr.title]="item.label"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path [attr.d]="item.icon" />
                </svg>
              </a>
            } @else if (item.popover; as popover) {
              <app-menu placement="end" [focusOnOpen]="true">
                <button
                  type="button"
                  menuTrigger
                  [attr.aria-label]="item.label"
                  [attr.title]="tooltip(item)"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path [attr.d]="item.icon" />
                  </svg>
                </button>
                <ng-template appMenuContent>
                  <ng-container [ngTemplateOutlet]="popover" />
                </ng-template>
              </app-menu>
            } @else {
              <button
                type="button"
                [attr.aria-label]="item.label"
                [attr.aria-keyshortcuts]="item.shortcut?.aria ?? null"
                [attr.title]="tooltip(item)"
                (click)="activate.emit(item)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path [attr.d]="item.icon" />
                </svg>
              </button>
            }
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    /* Above the page area, so a popover opening to the right covers the page (and the globe). */
    :host {
      position: relative;
      z-index: 5;
      align-self: flex-start;
      margin: var(--space-2) 0 var(--space-4) var(--space-4);
    }

    ul {
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding: var(--space-2);
      list-style: none;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
    }

    a,
    button {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    a:hover,
    button:hover,
    button[aria-expanded='true'] {
      background: var(--glass-bg-strong);
      color: var(--color-text);
    }

    app-menu {
      display: block;
    }

    a.active {
      border-color: var(--color-primary-ink);
      background: var(--color-selected-bg);
      color: var(--color-primary-ink);
    }

    svg {
      width: 1.35rem;
      height: 1.35rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class IconRail {
  readonly items = input.required<RailItem[]>();
  readonly ariaLabel = input('Quick access');
  readonly activate = output<RailItem>();

  protected tooltip(item: RailItem): string {
    return item.shortcut ? `${item.label} (${item.shortcut.label})` : item.label;
  }

  /** Query parameters are ignored so the explorer's URL state does not matter. */
  protected readonly exactPath: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };
}

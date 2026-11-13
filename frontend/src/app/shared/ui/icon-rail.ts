import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';

export interface RailItem {
  /** Accessible name and tooltip. */
  label: string;
  /** The `d` of one 24 by 24 stroked SVG path. */
  icon: string;
  /** A page to open; without it the item is a button that emits `activate`. */
  link?: string;
}

/**
 * Vertical glass icon rail. Every item is a labelled link (the current page gets `aria-current`)
 * or, without a `link`, a button that emits `activate`. Icons are decorative.
 */
@Component({
  selector: 'app-icon-rail',
  imports: [RouterLink, RouterLinkActive],
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
            } @else {
              <button
                type="button"
                [attr.aria-label]="item.label"
                [attr.title]="item.label"
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
    :host {
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
    button:hover {
      background: var(--glass-bg-strong);
      color: var(--color-text);
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

  /** Query parameters are ignored so the explorer's URL state does not matter. */
  protected readonly exactPath: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };
}

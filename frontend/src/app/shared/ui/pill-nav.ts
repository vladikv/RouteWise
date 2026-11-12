import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface PillNavItem {
  label: string;
  link: string;
  /** Match the route exactly (needed for `/`). */
  exact?: boolean;
}

/** Navigation as a glass pill group; the current page's item is lighter and has `aria-current`. */
@Component({
  selector: 'app-pill-nav',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav [attr.aria-label]="ariaLabel()">
      <ul>
        @for (item of items(); track item.link) {
          <li>
            <a
              [routerLink]="item.link"
              routerLinkActive="active"
              ariaCurrentWhenActive="page"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              >{{ item.label }}</a
            >
          </li>
        }
      </ul>
    </nav>
  `,
  styles: `
    ul {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin: 0;
      padding: var(--space-1);
      list-style: none;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
      -webkit-backdrop-filter: blur(var(--glass-blur));
      backdrop-filter: blur(var(--glass-blur));
    }

    a {
      display: inline-flex;
      align-items: center;
      min-height: 2.5rem;
      padding: 0 var(--space-4);
      border-radius: var(--radius-pill);
      color: var(--color-text-muted);
      font-weight: 600;
      text-decoration: none;
      transition: background-color 0.15s ease;
    }

    a:hover {
      color: var(--color-text);
    }

    a.active {
      background: var(--glass-bg-strong);
      box-shadow: inset 0 0 0 1px var(--color-border-strong);
      color: var(--color-text);
      font-weight: 700;
    }
  `,
})
export class PillNav {
  readonly items = input.required<PillNavItem[]>();
  readonly ariaLabel = input('Main');
}

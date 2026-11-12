import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IsActiveMatchOptions, RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../core/theme/theme.service';

/** App header: brand, main navigation and the theme toggle. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="header">
      <div class="header__inner">
        <a class="brand" routerLink="/">
          <span class="brand__mark" aria-hidden="true">↗</span>
          RouteWise
        </a>
        <nav aria-label="Main">
          <ul class="nav">
            <li>
              <a
                routerLink="/"
                routerLinkActive="nav__link--active"
                [routerLinkActiveOptions]="homeActiveOptions"
                ariaCurrentWhenActive="page"
                class="nav__link"
              >
                Home
              </a>
            </li>
            <li>
              <a
                routerLink="/trips"
                routerLinkActive="nav__link--active"
                ariaCurrentWhenActive="page"
                class="nav__link"
              >
                Trips
              </a>
            </li>
          </ul>
        </nav>
        <button
          type="button"
          class="button theme-toggle"
          [attr.aria-pressed]="isDark()"
          (click)="theme.toggle()"
        >
          <span aria-hidden="true">{{ isDark() ? '☾' : '☀' }}</span>
          <span class="theme-toggle__label">Dark theme</span>
        </button>
      </div>
    </header>
  `,
  styles: `
    .header {
      background: var(--color-surface);
      border-bottom: 1px solid var(--color-border);
    }

    .header__inner {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3) var(--space-6);
      max-width: var(--content-width);
      margin: 0 auto;
      padding: var(--space-3) var(--space-4);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-text);
      font-size: 1.2rem;
      font-weight: 700;
      text-decoration: none;
    }

    .brand__mark {
      display: grid;
      place-items: center;
      width: 1.9rem;
      height: 1.9rem;
      border-radius: var(--radius-sm);
      background: var(--color-primary);
      color: var(--color-on-primary);
    }

    nav {
      flex: 1;
    }

    .nav {
      display: flex;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .nav__link {
      display: inline-block;
      padding: var(--space-2) var(--space-3);
      border-bottom: 2px solid transparent;
      color: var(--color-text-muted);
      font-weight: 600;
      text-decoration: none;
    }

    .nav__link:hover,
    .nav__link--active {
      color: var(--color-text);
    }

    .nav__link--active {
      border-bottom-color: var(--color-primary);
    }

    .theme-toggle {
      min-height: 2.5rem;
      font-weight: 500;
    }

    /* Phones: icon only, so the header stays on one row; the label remains for screen readers. */
    @media (max-width: 30rem) {
      .theme-toggle__label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip-path: inset(50%);
        white-space: nowrap;
      }
    }
  `,
})
export class Header {
  protected readonly theme = inject(ThemeService);
  protected readonly isDark = computed(() => this.theme.theme() === 'dark');
  /** Home stays highlighted while the route explorer keeps its state in the query string. */
  protected readonly homeActiveOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };
}

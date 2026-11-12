import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { IsActiveMatchOptions, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Session } from '../../core/auth/session';

/** App header: brand, main navigation and the account (log in / log out). */
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
        <div class="account">
          @if (session.user(); as user) {
            <span class="account__name">
              <span class="visually-hidden">Logged in as </span>{{ user.displayName }}
            </span>
            <button type="button" class="button" (click)="logout()">Log out</button>
          } @else {
            <a class="button" routerLink="/login">Log in</a>
          }
        </div>
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
      font-family: var(--font-display);
      font-weight: 700;
      text-decoration: none;
    }

    .nav__link:hover,
    .nav__link--active {
      color: var(--color-text);
    }

    .nav__link--active {
      border-bottom-color: var(--color-primary);
    }

    .account {
      display: flex;
      align-items: center;
      gap: var(--space-3);
    }

    .account__name {
      max-width: 12rem;
      overflow: hidden;
      color: var(--color-text-muted);
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .account .button {
      min-height: 2.5rem;
    }

    /* Phones: the name gives way so brand, navigation and the account button share one row. */
    @media (max-width: 30rem) {
      .account__name {
        display: none;
      }
    }
  `,
})
export class Header {
  protected readonly session = inject(Session);
  /** Home stays highlighted while the route explorer keeps its state in the query string. */
  protected readonly homeActiveOptions: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    matrixParams: 'ignored',
    fragment: 'ignored',
  };

  private readonly router = inject(Router);

  protected logout(): void {
    this.session.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}

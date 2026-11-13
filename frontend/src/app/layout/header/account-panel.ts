import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TripStats, User } from '../../core/api/models';

/** "Alice Smith" becomes "AS": the first letters of up to two words. */
export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

/**
 * The account section of the avatar popover and of the phone navigation menu: who is logged in,
 * two small stats, a link to the trips and Log out. The stats are optional extras: while they
 * load or when they fail, a short note takes their place and the links stay usable.
 */
@Component({
  selector: 'app-account-panel',
  imports: [DecimalPipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="who">
      <span class="who__avatar" aria-hidden="true">{{ initials() }}</span>
      <div class="who__text">
        <p class="who__name">
          <span class="visually-hidden">Logged in as </span>{{ user().displayName }}
        </p>
        <p class="who__email muted">{{ user().email }}</p>
      </div>
    </div>

    @if (stats(); as figures) {
      <dl class="stats">
        <div>
          <dt>Trips planned</dt>
          <dd>{{ figures.tripsPlanned }}</dd>
        </div>
        <div>
          <dt>CO₂ saved vs car</dt>
          <dd>
            @if (figures.co2TripsCounted) {
              {{ figures.co2SavedVsCarKg | number: '1.0-0' }} kg
            } @else {
              –
            }
          </dd>
        </div>
      </dl>
    } @else if (statsFailed()) {
      <p class="note muted">Your stats are not available right now.</p>
    } @else {
      <p class="note muted" role="status">Loading your stats…</p>
    }

    <div class="actions">
      <a class="item" routerLink="/trips">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.3" />
        </svg>
        My trips
      </a>
      <button type="button" class="item" (click)="logout.emit()">
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M15 8l4 4-4 4M19 12H9" />
        </svg>
        Log out
      </button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: var(--space-3);
      min-width: min(16rem, 100%);
    }

    .who {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      min-width: 0;
    }

    .who__avatar {
      display: grid;
      flex: none;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--color-selected-bg);
      color: var(--color-primary-ink);
      font-weight: 800;
    }

    .who__text {
      min-width: 0;
    }

    .who__name,
    .who__email {
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .who__name {
      font-weight: 700;
    }

    .who__email {
      font-size: 0.875rem;
    }

    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
      margin: 0;
    }

    .stats > div {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      background: var(--glass-bg);
    }

    dt {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
    }

    dd {
      margin: 0;
      font-size: 1.125rem;
      font-weight: 800;
    }

    .note {
      margin: 0;
      font-size: 0.875rem;
    }

    .actions {
      display: grid;
      gap: var(--space-1);
      padding-top: var(--space-2);
      border-top: 1px solid var(--glass-border);
    }

    .item {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-3);
      border: 0;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--color-text);
      font: inherit;
      font-weight: 600;
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }

    .item:hover {
      background: var(--color-selected-bg);
    }

    .item svg {
      width: 1.125rem;
      height: 1.125rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class AccountPanel {
  readonly user = input.required<User>();
  /** Null until the stats arrive (or when they could not be loaded). */
  readonly stats = input<TripStats | null>(null);
  readonly statsFailed = input(false);
  readonly logout = output<void>();

  protected readonly initials = computed(() => initialsOf(this.user().displayName));
}

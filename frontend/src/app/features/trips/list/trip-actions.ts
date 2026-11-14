import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { duplicateState } from '../trip-duplicate';

/**
 * Quick actions of a trip card or row: open, edit and duplicate as small icon buttons. The parent
 * decides when they show (hover, focus within, never on touch). Delete is not one of them: it lives
 * in the "⋯" menu and on the trip details page.
 */
@Component({
  selector: 'app-trip-actions',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      class="quick"
      [routerLink]="['/trips', trip().id]"
      [attr.aria-label]="'Open ' + trip().title"
      title="Open"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
    </a>
    <a
      class="quick"
      [routerLink]="['/trips', trip().id, 'edit']"
      [attr.aria-label]="'Edit ' + trip().title"
      title="Edit"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4" />
      </svg>
    </a>
    <a
      class="quick"
      [routerLink]="['/trips', 'new']"
      [state]="duplicateState(trip())"
      [attr.aria-label]="'Duplicate ' + trip().title"
      title="Duplicate"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="9" y="9" width="11" height="11" rx="2" />
        <path d="M15 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h3" />
      </svg>
    </a>
  `,
  styles: `
    :host {
      position: relative;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
    }

    .quick {
      display: inline-grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      padding: 0;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      box-shadow: var(--glass-highlight);
      color: var(--color-text);
      cursor: pointer;
    }

    .quick:hover {
      border-color: var(--color-border-strong);
      background: var(--color-text-a14);
    }

    @media (pointer: coarse) {
      .quick {
        width: 2.75rem;
        height: 2.75rem;
      }
    }

    svg {
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
export class TripActions {
  readonly trip = input.required<Trip>();

  protected readonly duplicateState = duplicateState;
}

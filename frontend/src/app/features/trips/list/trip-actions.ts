import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { duplicateState } from '../trip-duplicate';

/**
 * Quick actions of a trip card or row: open, edit, duplicate and delete as small icon buttons.
 * The parent decides when they show (hover, focus within, never on touch). Delete asks first:
 * the button swaps the row for the inline confirmation, which stays visible until answered.
 */
@Component({
  selector: 'app-trip-actions',
  imports: [RouterLink, ConfirmAction],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.is-confirming]': 'confirming()' },
  template: `
    @if (confirming()) {
      <app-confirm-action
        [asking]="true"
        (askingChange)="answered($event)"
        [showTrigger]="false"
        question="Delete this trip?"
        [busy]="busy()"
        (confirmed)="deleted.emit()"
      />
    } @else {
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
      <button
        #deleteButton
        type="button"
        class="quick"
        [attr.aria-label]="'Delete ' + trip().title"
        title="Delete"
        (click)="confirming.set(true)"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10 11v5M14 11v5" />
        </svg>
      </button>
    }
  `,
  styles: `
    :host {
      position: relative;
      z-index: 2;
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
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
  readonly busy = input(false);
  readonly deleted = output<void>();

  protected readonly confirming = signal(false);
  protected readonly duplicateState = duplicateState;

  private readonly injector = inject(Injector);
  private readonly deleteButton = viewChild<ElementRef<HTMLButtonElement>>('deleteButton');

  /** The confirmation was cancelled: back to the icons, with focus on the delete button again. */
  protected answered(asking: boolean): void {
    if (!asking) {
      this.confirming.set(false);
      afterNextRender(() => this.deleteButton()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }
}

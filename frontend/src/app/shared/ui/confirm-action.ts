import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

/**
 * A destructive action with an inline confirmation step: the first click asks,
 * the second confirms. Keyboard focus moves to the confirm button.
 */
@Component({
  selector: 'app-confirm-action',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (asking()) {
      <span class="confirm" role="group" [attr.aria-label]="question()">
        <span class="confirm__question">{{ question() }}</span>
        <button
          #confirmButton
          type="button"
          class="button button--danger"
          [disabled]="busy()"
          (click)="confirmed.emit()"
        >
          {{ busy() ? busyLabel() : confirmLabel() }}
        </button>
        <button type="button" class="button" [disabled]="busy()" (click)="asking.set(false)">
          Cancel
        </button>
      </span>
    } @else if (showTrigger()) {
      <button
        type="button"
        class="button button--danger"
        [attr.aria-label]="ariaLabel()"
        (click)="asking.set(true)"
      >
        {{ label() }}
      </button>
    }
  `,
  styles: `
    .confirm {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
    }

    .confirm__question {
      font-weight: 600;
    }
  `,
})
export class ConfirmAction {
  readonly label = input('Delete');
  /** Accessible name of the first button when the visible label alone is ambiguous. */
  readonly ariaLabel = input<string | null>(null);
  readonly question = input('Are you sure?');
  readonly confirmLabel = input('Yes, delete');
  readonly busyLabel = input('Deleting…');
  readonly busy = input(false);
  readonly confirmed = output<void>();

  /** Whether the question is showing; set it to open the confirmation from outside. */
  readonly asking = model(false);
  /** Hide the first button when something else opens the question (`asking`). */
  readonly showTrigger = input(true);
  private readonly confirmButton = viewChild<ElementRef<HTMLButtonElement>>('confirmButton');

  constructor() {
    effect(() => this.confirmButton()?.nativeElement.focus());
  }
}

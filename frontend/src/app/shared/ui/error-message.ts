import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ApiError } from '../../core/api/api-error';

/** Error state for a failed load, with an optional retry action. */
@Component({
  selector: 'app-error-message',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="error" role="alert">
      <svg class="error__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3.5l9 16H3l9-16zM12 10v4M12 17h.01" />
      </svg>
      <div class="error__body">
        <p class="error__title">{{ title() }}</p>
        <p class="error__detail">{{ detail() }}</p>
        @if (retryable()) {
          <button type="button" class="button" (click)="retry.emit()">Try again</button>
        }
      </div>
    </div>
  `,
  styles: `
    .error {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-4);
      border: 1px solid var(--color-danger);
      border-radius: var(--radius-lg);
      background: var(--color-danger-bg-a70);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
    }

    .error__icon {
      flex: none;
      width: 1.5rem;
      height: 1.5rem;
      margin-top: 0.1rem;
      fill: none;
      stroke: var(--color-danger-text);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .error__body {
      min-width: 0;
    }

    .error__title {
      margin: 0 0 var(--space-1);
      color: var(--color-danger-text);
      font-weight: 700;
    }

    .error__detail {
      margin: 0 0 var(--space-3);
    }

    .error__detail:last-child {
      margin-bottom: 0;
    }
  `,
})
export class ErrorMessage {
  /** The failure to show; anything that is not an ApiError gets a generic message. */
  readonly error = input.required<unknown>();
  readonly retryable = input(true);
  readonly retry = output<void>();

  protected readonly title = computed(() => {
    const error = this.error();
    return error instanceof ApiError ? error.title : 'Something went wrong';
  });

  protected readonly detail = computed(() => {
    const error = this.error();
    return error instanceof ApiError ? error.detail : 'An unexpected error occurred.';
  });
}

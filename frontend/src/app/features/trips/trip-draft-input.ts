import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TripDraft } from '../../core/api/models';
import { ErrorMessage } from '../../shared/ui/error-message';

/**
 * Free-text trip request. Emits the text; the page asks the advisor to parse it
 * and passes back the resulting draft, whose warnings are shown here.
 */
@Component({
  selector: 'app-trip-draft-input',
  imports: [ReactiveFormsModule, ErrorMessage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="field">
        <label for="trip-description">Describe your trip</label>
        <textarea
          id="trip-description"
          formControlName="text"
          maxlength="1000"
          rows="2"
          aria-describedby="trip-description-hint"
        ></textarea>
        <span id="trip-description-hint" class="field__hint">
          For example: “Berlin to Vienna next Friday with 2 friends, as cheap as possible”
        </span>
      </div>
      <button type="submit" class="button" [disabled]="busy() || text.invalid">
        {{ busy() ? 'Reading…' : 'Fill in the form' }}
      </button>
    </form>

    @if (error(); as failure) {
      <div class="result">
        <app-error-message [error]="failure" [retryable]="false" />
      </div>
    } @else if (draft(); as result) {
      <div class="result" role="status">
        <p class="result__title">
          Form filled in from your description
          <span class="badge">{{ result.source === 'AI' ? 'AI advisor' : 'Rule-based' }}</span>
        </p>
        @if (result.warnings.length > 0) {
          <p class="result__lead">Please check these points:</p>
          <ul>
            @for (warning of result.warnings; track warning) {
              <li>{{ warning }}</li>
            }
          </ul>
        } @else {
          <p class="result__lead">Check the details below, then create the trip.</p>
        }
      </div>
    }
  `,
  styles: `
    .field {
      margin-bottom: var(--space-3);
    }

    textarea {
      min-height: 4.5rem;
    }

    .result {
      margin-top: var(--space-4);
    }

    .result[role='status'] {
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-primary);
      border-radius: var(--radius-md);
      background: var(--color-primary-a12);
    }

    .result__title {
      margin: 0 0 var(--space-1);
      font-weight: 700;
    }

    .result__lead {
      margin: 0;
    }

    ul {
      margin: var(--space-1) 0 0;
      padding-left: 1.25rem;
    }
  `,
})
export class TripDraftInput {
  readonly busy = input(false);
  /** The draft from the last successful parse. */
  readonly draft = input<TripDraft | null>(null);
  /** The failure of the last parse, if it failed. */
  readonly error = input<unknown>(null);
  readonly parse = output<string>();

  protected readonly text = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(1000)],
  });
  protected readonly form = new FormGroup({ text: this.text });

  protected submit(): void {
    if (this.text.valid) {
      this.parse.emit(this.text.value.trim());
    }
  }
}

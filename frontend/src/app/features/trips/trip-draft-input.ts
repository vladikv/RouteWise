import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TripDraft } from '../../core/api/models';
import { ErrorMessage } from '../../shared/ui/error-message';

/** Requests the parser understands; a click puts one in the text field. */
export const DRAFT_EXAMPLES = [
  'Berlin to Vienna next Friday with 2 friends, as cheap as possible',
  'Hamburg to Copenhagen this weekend, greenest option',
  'Munich to Prague, then Paris, fastest',
] as const;

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
        <label for="trip-description" class="title">Describe your trip</label>
        <p id="trip-description-hint" class="field__hint">
          Write it in your own words: the AI advisor fills in the form for you to check.
        </p>
        <textarea
          #textarea
          id="trip-description"
          formControlName="text"
          maxlength="1000"
          rows="5"
          aria-describedby="trip-description-hint"
        ></textarea>
      </div>
      <div class="examples" role="group" aria-labelledby="trip-examples-label">
        <span id="trip-examples-label" class="examples__label">Try an example</span>
        @for (example of examples; track example) {
          <button type="button" class="example" (click)="useExample(example)">
            {{ example }}
          </button>
        }
      </div>
      <button
        type="submit"
        class="button button--primary submit"
        [disabled]="busy() || text.invalid"
      >
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

    .title {
      font-size: 1.125rem;
      font-weight: 700;
    }

    .field__hint {
      margin: 0 0 var(--space-2);
    }

    textarea {
      min-height: 8rem;
      resize: vertical;
    }

    .examples {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: var(--space-2);
      margin-bottom: var(--space-4);
    }

    .examples__label {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 600;
    }

    /* Example chips: a whole request each, so they wrap as full-width pills. */
    .example {
      padding: var(--space-2) var(--space-3);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      background: var(--glass-bg);
      color: var(--color-text);
      font: inherit;
      font-size: 0.875rem;
      line-height: 1.35;
      text-align: start;
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    .example:hover {
      background: var(--glass-bg-strong);
    }

    .submit {
      width: 100%;
    }

    .result {
      margin-top: var(--space-4);
    }

    .result[role='status'] {
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--color-primary-ink);
      border-radius: var(--radius-md);
      background: var(--color-selected-bg);
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
  protected readonly examples = DRAFT_EXAMPLES;
  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');

  /**
   * Puts an example in the text field and focuses it (nothing is sent until the user submits).
   * The example replaces whatever was written.
   */
  protected useExample(example: string): void {
    this.text.setValue(example);
    this.text.markAsDirty();
    this.textarea().nativeElement.focus();
  }

  protected submit(): void {
    if (this.text.valid) {
      this.parse.emit(this.text.value.trim());
    }
  }
}

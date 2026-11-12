import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { FieldError } from '../../core/api/api-error';
import { RegisterRequest } from '../../core/api/models';

export type AuthMode = 'login' | 'register';

type FieldName = 'email' | 'password' | 'displayName';

const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  blank: 'This field is required.',
  email: 'Enter a valid email address.',
  minlength: 'Use at least 8 characters.',
  maxlength: 'This text is too long.',
};

/**
 * Login and registration form. Presentational: it validates and emits the
 * credentials; the page sends them and passes back server-side field errors.
 * In login mode the display name is not shown and is emitted empty.
 */
@Component({
  selector: 'app-auth-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (submitAttempted() && form.invalid) {
        <p class="form-summary" role="alert">Please fix the highlighted fields.</p>
      }

      @if (isRegister()) {
        <div class="field">
          <label for="auth-name">Name</label>
          <input
            id="auth-name"
            type="text"
            formControlName="displayName"
            maxlength="50"
            autocomplete="nickname"
            [attr.aria-invalid]="errorFor('displayName') ? 'true' : null"
            [attr.aria-describedby]="errorFor('displayName') ? 'auth-name-error' : null"
          />
          @if (errorFor('displayName'); as message) {
            <span id="auth-name-error" class="field__error">{{ message }}</span>
          }
        </div>
      }

      <div class="field">
        <label for="auth-email">Email</label>
        <input
          id="auth-email"
          type="email"
          formControlName="email"
          maxlength="254"
          autocomplete="email"
          [attr.aria-invalid]="errorFor('email') ? 'true' : null"
          [attr.aria-describedby]="errorFor('email') ? 'auth-email-error' : null"
        />
        @if (errorFor('email'); as message) {
          <span id="auth-email-error" class="field__error">{{ message }}</span>
        }
      </div>

      <div class="field">
        <label for="auth-password">Password</label>
        <input
          id="auth-password"
          type="password"
          formControlName="password"
          maxlength="72"
          [attr.autocomplete]="isRegister() ? 'new-password' : 'current-password'"
          [attr.aria-invalid]="errorFor('password') ? 'true' : null"
          [attr.aria-describedby]="passwordDescribedBy()"
        />
        @if (isRegister()) {
          <span id="auth-password-hint" class="field__hint">8 to 72 characters.</span>
        }
        @if (errorFor('password'); as message) {
          <span id="auth-password-error" class="field__error">{{ message }}</span>
        }
      </div>

      <div class="actions">
        <button type="submit" class="button button--primary" [disabled]="submitting()">
          {{ submitLabel() }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .form-summary {
      margin: 0 0 var(--space-4);
      color: var(--color-danger);
      font-weight: 600;
    }
  `,
})
export class AuthForm {
  readonly mode = input.required<AuthMode>();
  readonly submitting = input(false);
  readonly serverErrors = input<FieldError[]>([]);
  readonly submitted = output<RegisterRequest>();

  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly submitAttempted = signal(false);
  protected readonly submitLabel = computed(() => {
    if (this.submitting()) {
      return this.isRegister() ? 'Creating account…' : 'Logging in…';
    }
    return this.isRegister() ? 'Create account' : 'Log in';
  });

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    displayName: [''],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: ['', [Validators.required, Validators.maxLength(72)]],
  });

  constructor() {
    // Registration has the stricter rules of the API; login only needs something to check.
    effect(() => {
      const { displayName, password } = this.form.controls;
      if (this.isRegister()) {
        displayName.setValidators([Validators.required, notBlank, Validators.maxLength(50)]);
        password.setValidators([
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(72),
        ]);
      } else {
        displayName.clearValidators();
        password.setValidators([Validators.required, Validators.maxLength(72)]);
      }
      displayName.updateValueAndValidity();
      password.updateValueAndValidity();
    });
    effect(() => {
      for (const error of this.serverErrors()) {
        const control = this.form.get(error.field);
        control?.setErrors({ ...control.errors, server: error.message });
        control?.markAsTouched();
      }
    });
  }

  protected passwordDescribedBy(): string | null {
    const ids = [
      this.isRegister() ? 'auth-password-hint' : null,
      this.errorFor('password') ? 'auth-password-error' : null,
    ].filter((id) => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  }

  protected submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const { displayName, email, password } = this.form.getRawValue();
    this.submitted.emit({
      email: email.trim(),
      password,
      displayName: this.isRegister() ? displayName.trim() : '',
    });
  }

  protected errorFor(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) {
      return null;
    }
    const [key, value] = Object.entries(control.errors)[0];
    return key === 'server' ? capitalize(String(value)) : (MESSAGES[key] ?? 'Invalid value.');
  }
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.length > 0 && control.value.trim() === '' ? { blank: true } : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

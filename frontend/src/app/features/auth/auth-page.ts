import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiError, FieldError } from '../../core/api/api-error';
import { RegisterRequest } from '../../core/api/models';
import { safeReturnUrl } from '../../core/auth/auth-guard';
import { Session } from '../../core/auth/session';
import { ErrorMessage } from '../../shared/ui/error-message';
import { AuthForm, AuthMode } from './auth-form';

/**
 * Log in (`/login`) or create an account (`/register`); the mode comes from the
 * route data. Afterwards it returns to `returnUrl` (a path inside the app) or the trip list.
 */
@Component({
  selector: 'app-auth-page',
  imports: [AuthForm, ErrorMessage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page-header">
      <h1>{{ isRegister() ? 'Create your account' : 'Log in' }}</h1>
    </div>

    <section class="card">
      <p class="muted intro">
        {{
          isRegister()
            ? 'An account keeps your saved trips private to you.'
            : 'Log in to see and plan your saved trips.'
        }}
      </p>
      @if (error(); as error) {
        <div class="error">
          <app-error-message [error]="error" [retryable]="false" />
        </div>
      }
      <app-auth-form
        [mode]="mode()"
        [submitting]="submitting()"
        [serverErrors]="fieldErrors()"
        (submitted)="send($event)"
      />
      <p class="switch">
        @if (isRegister()) {
          Already have an account?
          <a routerLink="/login" [queryParams]="switchParams()">Log in</a>
        } @else {
          New to RouteWise?
          <a routerLink="/register" [queryParams]="switchParams()">Create an account</a>
        }
      </p>
    </section>
  `,
  styles: `
    .card {
      max-width: 28rem;
    }

    .intro {
      margin-top: 0;
    }

    .error {
      margin-bottom: var(--space-4);
    }

    .switch {
      margin: var(--space-4) 0 0;
    }
  `,
})
export class AuthPage {
  /** Route data. */
  readonly mode = input<AuthMode>('login');
  /** Query parameter set by the auth guard. */
  readonly returnUrl = input<string>();

  private readonly session = inject(Session);
  private readonly router = inject(Router);

  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly switchParams = computed(() =>
    this.returnUrl() ? { returnUrl: this.returnUrl() } : {},
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly fieldErrors = signal<FieldError[]>([]);

  protected send(request: RegisterRequest): void {
    this.submitting.set(true);
    this.error.set(null);
    const sent$ = this.isRegister()
      ? this.session.register(request)
      : this.session.login({ email: request.email, password: request.password });
    sent$.subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (error: unknown) => {
        this.submitting.set(false);
        if (error instanceof ApiError && error.isValidation) {
          this.fieldErrors.set(error.fieldErrors);
        } else {
          this.error.set(error);
        }
      },
    });
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiError, FieldError } from '../../core/api/api-error';
import { LoginRequest, RegisterRequest, User } from '../../core/api/models';
import { safeReturnUrl } from '../../core/auth/auth-guard';
import { DEMO_ACCOUNT } from '../../core/auth/demo-account';
import { Session } from '../../core/auth/session';
import { ErrorMessage } from '../../shared/ui/error-message';
import { AuthForm, AuthMode } from './auth-form';

/**
 * Log in (`/login`) or create an account (`/register`); the mode comes from the
 * route data. Afterwards it returns to `returnUrl` (a path inside the app) or the trip list.
 * Split screen on wide screens: what RouteWise offers (with the demo account) on the
 * left, the form on the right. The form comes first in the DOM, so phones and screen
 * readers reach it first.
 */
@Component({
  selector: 'app-auth-page',
  imports: [AuthForm, ErrorMessage, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="auth">
      <section class="card auth__form" aria-labelledby="auth-title">
        <h1 id="auth-title">{{ isRegister() ? 'Create your account' : 'Log in' }}</h1>
        <p class="muted intro">
          {{
            isRegister()
              ? 'An account keeps your saved trips private to you.'
              : 'Welcome back. Log in to see and plan your saved trips.'
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

      <aside class="auth__pitch" aria-labelledby="pitch-title">
        <h2 id="pitch-title" class="pitch__title">
          Plan smarter trips.<span class="pitch__accent"> Greener too.</span>
        </h2>
        <ul class="pitch__list">
          <li>Compare train, bus, car, bike and plane by time, cost and CO₂</li>
          <li>Recommendations that take the weather forecast into account</li>
          <li>Your saved trips stay private to your account</li>
        </ul>
        @if (demo; as account) {
          <section class="demo" aria-labelledby="demo-title">
            <h3 id="demo-title">Just looking around?</h3>
            <p>
              Use the demo account with a few sample trips: email
              <code>{{ account.email }}</code
              >, password <code>{{ account.password }}</code
              >.
            </p>
            <button
              type="button"
              class="button button--primary"
              [disabled]="submitting()"
              (click)="tryDemo(account)"
            >
              Try the demo
            </button>
          </section>
        }
      </aside>
    </div>
  `,
  styles: `
    .auth {
      display: grid;
      grid-template-areas: 'form' 'pitch';
      gap: var(--space-8);
      align-items: center;
      max-width: 60rem;
      margin: 0 auto;
    }

    .auth__form {
      grid-area: form;
      width: 100%;
      max-width: 28rem;
      justify-self: center;
    }

    .auth__pitch {
      grid-area: pitch;
    }

    @media (min-width: 56rem) {
      .auth {
        grid-template-areas: 'pitch form';
        grid-template-columns: 1fr minmax(0, 28rem);
        gap: clamp(var(--space-8), 6vw, 5rem);
        min-height: calc(100dvh - 15rem);
      }
    }

    h1 {
      font-size: 1.9rem;
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

    .pitch__title {
      margin-bottom: var(--space-6);
      font-size: clamp(2rem, 5vw, 3.25rem);
      font-weight: 800;
    }

    .pitch__accent {
      color: var(--color-primary);
    }

    .pitch__list {
      display: grid;
      gap: var(--space-3);
      margin: 0 0 var(--space-8);
      padding: 0;
      list-style: none;
      font-size: 1.1rem;
    }

    .pitch__list li {
      display: flex;
      gap: var(--space-3);
    }

    .pitch__list li::before {
      content: '✓';
      flex: none;
      color: var(--color-primary);
      font-weight: 800;
    }

    .demo {
      padding: var(--space-6);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
    }

    .demo h3 {
      margin-bottom: var(--space-2);
    }

    .demo p {
      color: var(--color-text-muted);
    }

    .demo code {
      color: var(--color-text);
      overflow-wrap: anywhere;
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

  protected readonly demo = inject(DEMO_ACCOUNT);
  protected readonly isRegister = computed(() => this.mode() === 'register');
  protected readonly switchParams = computed(() =>
    this.returnUrl() ? { returnUrl: this.returnUrl() } : {},
  );
  protected readonly submitting = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly fieldErrors = signal<FieldError[]>([]);

  protected send(request: RegisterRequest): void {
    this.submit(
      this.isRegister()
        ? this.session.register(request)
        : this.session.login({ email: request.email, password: request.password }),
    );
  }

  protected tryDemo(account: LoginRequest): void {
    this.submit(this.session.login(account));
  }

  private submit(sent$: Observable<User>): void {
    this.submitting.set(true);
    this.error.set(null);
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

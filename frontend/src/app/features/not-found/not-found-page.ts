import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty-state not-found">
      <p class="not-found__code" aria-hidden="true">404</p>
      <h1>Page not found</h1>
      <p class="muted">The page you are looking for does not exist or has moved.</p>
      <a class="button button--primary" routerLink="/">Back to home</a>
    </section>
  `,
  styles: `
    .not-found {
      max-width: 36rem;
      margin: var(--space-8) auto 0;
    }

    .not-found__code {
      margin: 0 auto var(--space-2);
      color: var(--color-primary);
      font-size: clamp(3.5rem, 14vw, 6rem);
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
    }
  `,
})
export class NotFoundPage {}

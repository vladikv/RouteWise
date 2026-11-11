import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card">
      <h1>Page not found</h1>
      <p class="muted">The page you are looking for does not exist or has moved.</p>
      <a class="button button--primary" routerLink="/">Back to home</a>
    </section>
  `,
})
export class NotFoundPage {}

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';

/** App shell: skip link, header, routed page and footer. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glow-layer" aria-hidden="true"><span></span><span></span><span></span></div>
    <a class="skip-link" href="#main">Skip to content</a>
    <app-header />
    <main id="main" tabindex="-1">
      <router-outlet />
    </main>
    <footer class="footer">
      <p>RouteWise compares travel time, cost and CO₂. Weather data by Open-Meteo.</p>
    </footer>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }

    main {
      flex: 1;
      width: 100%;
      max-width: var(--content-width);
      margin: 0 auto;
      padding: var(--space-8) var(--space-4);
    }

    main:focus {
      outline: none;
    }

    .skip-link {
      position: absolute;
      left: var(--space-4);
      top: -4rem;
      z-index: 10;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: 600;
    }

    .skip-link:focus {
      top: var(--space-2);
    }

    .footer {
      padding: var(--space-4);
      border-top: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 0.875rem;
      text-align: center;
    }

    .footer p {
      margin: 0;
    }
  `,
})
export class App {}

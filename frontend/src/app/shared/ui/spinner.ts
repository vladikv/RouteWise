import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Loading indicator with an announced label. */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p class="spinner" role="status">
      <span class="spinner__ring" aria-hidden="true"></span>
      {{ label() }}
    </p>
  `,
  styles: `
    .spinner {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: fit-content;
      max-width: 100%;
      margin: 0;
      padding: var(--space-2) var(--space-4) var(--space-2) var(--space-3);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
      color: var(--color-text-muted);
    }

    .spinner__ring {
      flex: none;
      width: 1.25rem;
      height: 1.25rem;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class Spinner {
  readonly label = input('Loading…');
}

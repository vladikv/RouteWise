import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A round icon (project it with the `icon` attribute) next to a big value and a small label. */
@Component({
  selector: 'app-stat-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.aria-busy]': 'loading() ? "true" : null' },
  template: `
    <span class="icon" aria-hidden="true"><ng-content select="[icon]" /></span>
    <span class="text">
      @if (loading()) {
        <span class="value placeholder" aria-hidden="true"></span>
        <span class="visually-hidden">Loading</span>
      } @else {
        <span class="value">{{ value() }}</span>
      }
      <span class="label">{{ label() }}</span>
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--space-3);
    }

    .icon {
      display: inline-flex;
      flex: none;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
      color: var(--color-primary);
    }

    .icon ::ng-deep svg {
      width: 1.35rem;
      height: 1.35rem;
    }

    .text {
      display: flex;
      flex-direction: column;
      line-height: 1.2;
    }

    .value {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .placeholder {
      width: 3.5rem;
      height: 1.5rem;
      margin-bottom: 0.1rem;
      border-radius: var(--radius-pill);
      background: var(--color-border);
    }

    .label {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  `,
})
export class StatChip {
  readonly value = input('');
  readonly label = input.required<string>();
  readonly loading = input(false);
}

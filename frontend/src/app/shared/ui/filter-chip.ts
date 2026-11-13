import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

/** Toggle chip with an optional count and projected leading content (an icon); the state is in `aria-pressed` and a check mark. */
@Component({
  selector: 'app-filter-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [attr.aria-pressed]="selected()" (click)="selected.set(!selected())">
      @if (selected()) {
        <span aria-hidden="true">✓</span>
      }
      <ng-content />
      <span>{{ label() }}</span>
      @if (count() !== undefined) {
        <span class="count">{{ count() }}</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 2.5rem;
      padding: 0 var(--space-4);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
      color: var(--color-text);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease;
    }

    button:hover {
      border-color: var(--color-border-strong);
    }

    button[aria-pressed='true'] {
      border-color: var(--color-primary-ink);
      background: var(--color-selected-bg);
      color: var(--color-primary-ink);
    }

    .count {
      color: var(--color-text-muted);
      font-size: 0.875rem;
    }
  `,
})
export class FilterChip {
  readonly label = input.required<string>();
  readonly selected = model(false);
  readonly count = input<number>();
}

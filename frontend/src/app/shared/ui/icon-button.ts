import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Round button holding a projected icon. `label` is its accessible name and
 * tooltip. Clicks bubble to the host, so consumers bind `(click)` on it.
 */
@Component({
  selector: 'app-icon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [attr.type]="type()"
      [attr.aria-label]="label()"
      [attr.title]="label()"
      [attr.aria-pressed]="pressed() ?? null"
      [attr.aria-expanded]="expanded() ?? null"
      [disabled]="disabled()"
    >
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      color: var(--color-text);
      cursor: pointer;
      transition: background-color 0.15s ease;
    }

    button:hover:not(:disabled) {
      border-color: var(--color-border-strong);
      background: var(--color-surface-muted);
    }

    button[aria-pressed='true'],
    button[aria-expanded='true'] {
      border-color: var(--color-primary);
      background: var(--color-primary-a12);
      color: var(--color-primary);
    }

    button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    button ::ng-deep svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class IconButton {
  readonly label = input.required<string>();
  readonly type = input<'button' | 'submit'>('button');
  readonly pressed = input<boolean>();
  readonly expanded = input<boolean>();
  readonly disabled = input(false);
}

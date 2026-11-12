import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';

export interface ToggleOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Pill-shaped single choice (for example Board / List) as a radio group with a
 * roving tabindex: the arrow keys move and select, Tab leaves the group.
 */
@Component({
  selector: 'app-segmented-toggle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="radiogroup" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="radio"
          [attr.aria-checked]="option.value === value()"
          [tabindex]="option.value === focusable() ? 0 : -1"
          (click)="value.set(option.value)"
          (keydown)="onKeydown($event)"
        >
          @if (option.value === value()) {
            <span aria-hidden="true">✓</span>
          }
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
    }

    div {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-1);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight);
    }

    button {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      min-height: 2.25rem;
      padding: 0 var(--space-4);
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text-muted);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }

    button:hover {
      color: var(--color-text);
    }

    button[aria-checked='true'] {
      border-color: var(--color-primary-ink);
      background: var(--color-selected-bg);
      color: var(--color-text);
    }

    button[aria-checked='true'] span {
      color: var(--color-primary-ink);
    }
  `,
})
export class SegmentedToggle<T extends string = string> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly options = input.required<ToggleOption<T>[]>();
  readonly value = model.required<T>();
  readonly ariaLabel = input.required<string>();

  /** The one option in the tab order: the selected one, else the first. */
  protected focusable(): T | undefined {
    const options = this.options();
    return options.some((option) => option.value === this.value())
      ? this.value()
      : options[0]?.value;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    const current = options.findIndex((option) => option.value === this.value());
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step === undefined || options.length === 0) {
      return;
    }
    event.preventDefault();
    const next = (Math.max(current, 0) + step + options.length) % options.length;
    this.value.set(options[next].value);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
}

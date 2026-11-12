import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  model,
} from '@angular/core';

export interface TabOption<T extends string = string> {
  value: T;
  label: string;
}

let nextId = 0;

/**
 * Pill-shaped tab list (WAI-ARIA tabs, automatic activation). The parent owns
 * the content: render one `role="tabpanel"` with `[id]="tabs.panelId(value)"`
 * and `[attr.aria-labelledby]="tabs.tabId(value)"` for the selected value.
 */
@Component({
  selector: 'app-tabs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div role="tablist" [attr.aria-label]="ariaLabel()">
      @for (option of options(); track option.value) {
        <button
          type="button"
          role="tab"
          [id]="tabId(option.value)"
          [attr.aria-selected]="option.value === value()"
          [attr.aria-controls]="panelId(option.value)"
          [tabindex]="option.value === focusable() ? 0 : -1"
          (click)="value.set(option.value)"
          (keydown)="onKeydown($event)"
        >
          {{ option.label }}
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: inline-block;
      max-width: 100%;
    }

    div {
      display: flex;
      gap: var(--space-1);
      padding: var(--space-1);
      overflow-x: auto;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg);
    }

    button {
      flex: none;
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

    button[aria-selected='true'] {
      border-color: var(--color-primary);
      background: var(--color-primary-a12);
      color: var(--color-text);
      font-weight: 700;
    }

    button:focus-visible {
      outline-offset: -2px;
    }
  `,
})
export class Tabs<T extends string = string> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly generatedPrefix = `tabs-${nextId++}`;

  readonly options = input.required<TabOption<T>[]>();
  readonly value = model.required<T>();
  readonly ariaLabel = input.required<string>();
  /** Prefix of the tab and panel ids; unique per instance unless set. */
  readonly idPrefix = input<string>();

  tabId(value: T): string {
    return `${this.idPrefix() ?? this.generatedPrefix}-tab-${value}`;
  }

  panelId(value: T): string {
    return `${this.idPrefix() ?? this.generatedPrefix}-panel-${value}`;
  }

  protected focusable(): T | undefined {
    const options = this.options();
    return options.some((option) => option.value === this.value())
      ? this.value()
      : options[0]?.value;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.options();
    if (options.length === 0) {
      return;
    }
    const current = Math.max(
      options.findIndex((option) => option.value === this.value()),
      0,
    );
    const next = {
      ArrowRight: (current + 1) % options.length,
      ArrowLeft: (current - 1 + options.length) % options.length,
      Home: 0,
      End: options.length - 1,
    }[event.key];
    if (next === undefined) {
      return;
    }
    event.preventDefault();
    this.value.set(options[next].value);
    this.host.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  }
}

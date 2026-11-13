import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  Directive,
  contentChild,
  inject,
  input,
  model,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface FilterOption {
  value: string;
  label: string;
  /** Items behind this option; shown as a muted badge and read out in the button's name. */
  count?: number;
}

export interface FilterUnit {
  one: string;
  other: string;
}

let nextId = 0;

/** Marks the `<ng-template let-option>` that draws the icon in front of each option's label. */
@Directive({ selector: 'ng-template[appFilterIcon]' })
export class FilterIcon {
  readonly template = inject<TemplateRef<{ $implicit: FilterOption }>>(TemplateRef);
}

/**
 * A labelled group of toggle chips (`role="group"`, name from the visible label). Each chip is a
 * button with `aria-pressed`; the selected values are the `selected` model. Project an
 * `<ng-template appFilterIcon let-option>` to draw an icon in front of each label. The group is one
 * block: its chips wrap inside it and never mix with another group's.
 */
@Component({
  selector: 'app-filter-group',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="group" role="group" [attr.aria-labelledby]="labelId">
      <span class="label" [id]="labelId">{{ label() }}</span>
      <div class="chips">
        @for (option of options(); track option.value) {
          <button
            type="button"
            class="chip"
            [attr.aria-pressed]="isSelected(option.value)"
            [attr.aria-label]="name(option)"
            (click)="toggle(option.value)"
          >
            @if (isSelected(option.value)) {
              <span aria-hidden="true">✓</span>
            }
            @if (icon(); as filterIcon) {
              <ng-container
                [ngTemplateOutlet]="filterIcon.template"
                [ngTemplateOutletContext]="{ $implicit: option }"
              />
            }
            <span>{{ option.label }}</span>
            @if (option.count !== undefined) {
              <span class="count" aria-hidden="true">{{ option.count }}</span>
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      flex: 0 1 auto;
      min-width: 0;
    }

    .group {
      display: grid;
      gap: var(--space-2);
    }

    .label {
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .chip {
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

    .chip:hover {
      border-color: var(--color-border-strong);
    }

    .chip[aria-pressed='true'] {
      border-color: var(--color-primary-ink);
      background: var(--color-selected-bg);
      color: var(--color-primary-ink);
    }

    .count {
      min-width: 1.5rem;
      padding: 0 var(--space-2);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      color: var(--color-text-muted);
      font-size: 0.8125rem;
      line-height: 1.5rem;
      text-align: center;
    }
  `,
})
export class FilterGroup {
  readonly label = input.required<string>();
  readonly options = input.required<readonly FilterOption[]>();
  readonly selected = model<string[]>([]);
  /** What the counts count, for the accessible names ("Fastest, 2 trips"). */
  readonly unit = input<FilterUnit>({ one: 'item', other: 'items' });

  protected readonly icon = contentChild(FilterIcon);
  protected readonly labelId = `filter-group-${nextId++}`;

  protected isSelected(value: string): boolean {
    return this.selected().includes(value);
  }

  protected toggle(value: string): void {
    this.selected.update((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
    );
  }

  protected name(option: FilterOption): string {
    if (option.count === undefined) {
      return option.label;
    }
    const unit = option.count === 1 ? this.unit().one : this.unit().other;
    return `${option.label}, ${option.count} ${unit}`;
  }
}

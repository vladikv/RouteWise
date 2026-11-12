import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

let nextId = 0;

/**
 * Glass card with an optional heading. With `collapsible` the heading becomes a
 * button that shows or hides the content (`collapsed` is two-way bindable).
 */
@Component({
  selector: 'app-glass-panel',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template #content>
      @if (collapsible()) {
        <button
          type="button"
          class="toggle"
          [attr.aria-expanded]="!collapsed()"
          [attr.aria-controls]="bodyId"
          (click)="collapsed.set(!collapsed())"
        >
          <span>{{ heading() || 'Details' }}</span>
          <svg
            class="chevron"
            [class.chevron--open]="!collapsed()"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      } @else {
        {{ heading() }}
      }
    </ng-template>
    <section class="panel" [class.panel--strong]="strong()">
      @if (collapsible() || heading()) {
        @switch (headingLevel()) {
          @case (1) {
            <h1 class="heading" [class.heading--static]="!collapsible()">
              <ng-container [ngTemplateOutlet]="content" />
            </h1>
          }
          @case (3) {
            <h3 class="heading" [class.heading--static]="!collapsible()">
              <ng-container [ngTemplateOutlet]="content" />
            </h3>
          }
          @default {
            <h2 class="heading" [class.heading--static]="!collapsible()">
              <ng-container [ngTemplateOutlet]="content" />
            </h2>
          }
        }
      }
      <div class="body" [id]="bodyId" [hidden]="collapsible() && collapsed()">
        <ng-content />
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .panel {
      padding: clamp(var(--space-4), 3vw, var(--space-6));
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      background: var(--glass-bg);
      -webkit-backdrop-filter: blur(var(--glass-blur));
      backdrop-filter: blur(var(--glass-blur));
      box-shadow: var(--shadow-card);
    }

    .panel--strong {
      background: var(--glass-bg-strong);
    }

    .heading {
      margin: 0;
      font-size: 1.1rem;
      line-height: 1.3;
    }

    .heading:has(+ .body:not([hidden])),
    .heading--static {
      margin-bottom: var(--space-3);
    }

    .toggle {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      width: 100%;
      min-height: 2.75rem;
      padding: 0;
      border: 0;
      border-radius: var(--radius-md);
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }

    .chevron {
      flex: none;
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      transform: rotate(-90deg);
      transition: transform 0.15s ease;
    }

    .chevron--open {
      transform: none;
    }
  `,
})
export class GlassPanel {
  readonly heading = input<string>();
  /** Element used for the heading: h1 for the page's main panel, h2 by default, or h3. */
  readonly headingLevel = input<1 | 2 | 3>(2);
  readonly collapsible = input(false);
  readonly collapsed = model(false);
  /** Lighter fill, for a panel that sits on top of other glass. */
  readonly strong = input(false);

  protected readonly bodyId = `glass-panel-body-${nextId++}`;
}

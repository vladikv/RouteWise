import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Toast, ToastService } from './toast';

/**
 * Renders the toasts of `ToastService`. Errors go to a `role="alert"` region, info to a polite
 * `role="status"` one; both regions stay in the DOM so screen readers announce what is added.
 * A toast waits while the pointer is over it or focus is inside it.
 */
@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toasts">
      <div role="alert" aria-live="assertive" class="region">
        @for (toast of errors(); track toast.id) {
          <ng-container *ngTemplateOutlet="item; context: { $implicit: toast }" />
        }
      </div>
      <div role="status" aria-live="polite" class="region">
        @for (toast of infos(); track toast.id) {
          <ng-container *ngTemplateOutlet="item; context: { $implicit: toast }" />
        }
      </div>
    </div>

    <ng-template #item let-toast>
      <div
        class="toast"
        [class.toast--error]="toast.kind === 'error'"
        (mouseenter)="service.pause(toast.id)"
        (mouseleave)="service.resume(toast.id)"
        (focusin)="service.pause(toast.id)"
        (focusout)="service.resume(toast.id)"
      >
        <p class="toast__message">
          @if (toast.kind === 'error') {
            <span class="visually-hidden">Error: </span>
          }
          {{ toast.message }}
        </p>
        @if (toast.action; as action) {
          <button type="button" class="toast__action" (click)="run(toast)">
            {{ action.label }}
          </button>
        }
        <button
          type="button"
          class="toast__close"
          aria-label="Dismiss notification"
          (click)="service.dismiss(toast.id)"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
    </ng-template>
  `,
  styles: `
    .toasts {
      position: fixed;
      right: var(--space-4);
      bottom: var(--space-4);
      left: var(--space-4);
      z-index: 40;
      display: grid;
      justify-items: end;
      gap: var(--space-2);
      pointer-events: none;
    }

    .region {
      display: grid;
      gap: var(--space-2);
      justify-items: end;
      width: 100%;
    }

    .region:empty {
      display: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      width: fit-content;
      max-width: min(26rem, 100%);
      padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
      border: 1px solid var(--glass-border);
      border-left: 4px solid var(--color-highlight-edge);
      border-radius: var(--radius-lg);
      background: var(--glass-bg-menu);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight), var(--shadow-raised);
      color: var(--color-text);
      pointer-events: auto;
      animation: toast-in 0.2s ease;
    }

    .toast--error {
      border-left-color: var(--color-danger);
    }

    .toast__message {
      flex: 1;
      margin: 0;
      overflow-wrap: anywhere;
    }

    .toast__action,
    .toast__close {
      min-height: 2.5rem;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text);
      font: inherit;
      cursor: pointer;
    }

    .toast__action {
      padding: 0 var(--space-3);
      border-color: var(--color-border-strong);
      font-weight: 700;
    }

    .toast__close {
      width: 2.5rem;
      padding: 0;
    }

    .toast__action:hover,
    .toast__close:hover {
      background: var(--color-text-a12);
    }

    @keyframes toast-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .toast {
        animation: none;
      }
    }
  `,
  imports: [NgTemplateOutlet],
})
export class ToastOutlet {
  protected readonly service = inject(ToastService);
  protected readonly errors = computed(() => this.byKind('error'));
  protected readonly infos = computed(() => this.byKind('info'));

  protected run(toast: Toast): void {
    toast.action?.run();
    this.service.dismiss(toast.id);
  }

  private byKind(kind: Toast['kind']): Toast[] {
    return this.service.toasts().filter((toast) => toast.kind === kind);
  }
}

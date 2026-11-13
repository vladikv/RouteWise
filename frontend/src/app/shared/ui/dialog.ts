import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';

let nextId = 0;

/**
 * A modal confirmation on a native `<dialog>` (`showModal()`): the browser traps focus, makes the
 * page behind it inert and closes it on Escape. The parent owns `open`; the dialog asks to close
 * through `cancelled` (Cancel, Escape, a click on the backdrop) and reports the answer through
 * `confirmed`. Focus starts on Cancel (the safe choice) and returns to the element that had it
 * when the dialog opened. While `busy` it cannot be dismissed. The body is projected content.
 */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onBackdropClick($event)' },
  template: `
    <dialog
      #dialog
      class="dialog"
      [attr.aria-labelledby]="titleId"
      (cancel)="onCancel($event)"
      (close)="onClose()"
    >
      @if (open()) {
        <div class="dialog__body">
          <h2 class="dialog__title" [id]="titleId">{{ title() }}</h2>
          <div class="dialog__text">
            <ng-content />
          </div>
          <div class="dialog__actions">
            <button
              #cancelButton
              type="button"
              class="button"
              [disabled]="busy()"
              (click)="cancelled.emit()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="button button--danger"
              [attr.aria-busy]="busy() ? 'true' : null"
              [disabled]="busy()"
              (click)="confirmed.emit()"
            >
              {{ busy() ? busyLabel() : confirmLabel() }}
            </button>
          </div>
        </div>
      }
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(28rem, calc(100vw - 2 * var(--space-4)));
      padding: 0;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      /* Opaque: the page behind must not read through the text. */
      background:
        linear-gradient(var(--glass-bg-strong), var(--glass-bg-strong)), var(--color-surface);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      box-shadow: var(--glass-highlight), var(--shadow-raised);
      color: var(--color-text);
    }

    .dialog::backdrop {
      background: var(--color-bg-a70);
    }

    .dialog__body {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-6);
    }

    .dialog__title {
      margin: 0;
      font-size: 1.25rem;
    }

    .dialog__text {
      display: grid;
      gap: var(--space-3);
      color: var(--color-text-muted);
      overflow-wrap: anywhere;
    }

    .dialog__text :where(p) {
      margin: 0;
    }

    .dialog__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: var(--space-2);
    }

    @media (prefers-reduced-motion: no-preference) {
      .dialog[open] {
        animation: dialog-in 0.15s ease;
      }
    }

    @keyframes dialog-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class Dialog {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly confirmLabel = input('Delete');
  readonly busyLabel = input('Deleting…');
  /** An answer is on its way: both buttons wait and the dialog cannot be dismissed. */
  readonly busy = input(false);
  /** Where focus goes on close when the element that opened the dialog is gone (e.g. it was deleted). */
  readonly fallbackFocus = input<HTMLElement | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  protected readonly titleId = `dialog-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');
  private opener: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) {
          this.opener = document.activeElement as HTMLElement | null;
          element.showModal();
          this.cancelButton()?.nativeElement.focus();
        }
      } else {
        if (element.open) {
          element.close();
        }
        this.returnFocus();
      }
    });
  }

  /** Escape: the browser closes the dialog unless an answer is pending. */
  protected onCancel(event: Event): void {
    if (this.busy()) {
      event.preventDefault();
    }
  }

  /**
   * The browser closed it (Escape): tell the parent, which then sets `open` to false. While busy
   * a close is not allowed (the answer is pending), so the dialog opens again to stay in sync.
   */
  protected onClose(): void {
    if (!this.open()) {
      return;
    }
    if (this.busy()) {
      this.dialog().nativeElement.showModal();
    } else {
      this.cancelled.emit();
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.busy()) {
      this.cancelled.emit();
    }
  }

  /** Focus is nowhere (the page or the removed opener had it); something else may already have taken it. */
  private noFocus(): boolean {
    return !document.activeElement || document.activeElement === document.body;
  }

  private returnFocus(): void {
    if (this.opener?.isConnected) {
      this.opener.focus();
    } else if (this.opener && this.noFocus()) {
      this.fallbackFocus()?.focus();
    }
    this.opener = null;
  }
}

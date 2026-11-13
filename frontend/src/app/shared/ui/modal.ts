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
 * A modal panel on a native `<dialog>` (`showModal()`): the browser traps focus and makes the page
 * inert. Escape, a click on the backdrop and the close button ask to close through `closed`; the
 * parent owns `open`. Focus starts on the element marked `data-autofocus` in the projected body
 * (else the close button) and returns to the element that had it when the panel opened.
 * Unlike `Dialog` it asks no question: the body is any projected content.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(mousedown)': 'onPress($event)', '(click)': 'onBackdropClick($event)' },
  template: `
    <dialog
      #dialog
      class="modal"
      [class.modal--top]="position() === 'top'"
      [attr.aria-labelledby]="titleId"
      (cancel)="onCancel($event)"
      (close)="onClose()"
    >
      @if (open()) {
        <div class="modal__head">
          <h2 class="modal__title" [id]="titleId">{{ title() }}</h2>
          <button
            #closeButton
            type="button"
            class="modal__close"
            aria-label="Close"
            (click)="closed.emit()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div #body class="modal__body">
          <ng-content />
        </div>
      }
    </dialog>
  `,
  styles: `
    .modal {
      width: min(34rem, calc(100vw - 2 * var(--space-4)));
      max-height: calc(100dvh - 2 * var(--space-8));
      padding: 0;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      /* Opaque: the page behind must not read through the text. */
      background:
        linear-gradient(var(--glass-bg-strong), var(--glass-bg-strong)), var(--color-surface);
      box-shadow: var(--glass-highlight), var(--shadow-raised);
      color: var(--color-text);
    }

    /* A search palette opens near the top, so its results grow downwards. */
    .modal--top {
      margin-top: 12dvh;
      max-height: calc(88dvh - var(--space-8));
    }

    .modal::backdrop {
      background: var(--color-bg-a70);
    }

    .modal__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-4) 0 var(--space-6);
    }

    .modal__title {
      margin: 0;
      font-size: 1.125rem;
    }

    .modal__close {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      padding: 0;
      border: 1px solid transparent;
      border-radius: var(--radius-pill);
      background: none;
      color: var(--color-text-muted);
      cursor: pointer;
    }

    .modal__close:hover {
      background: var(--glass-bg-strong);
      color: var(--color-text);
    }

    .modal__close svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    .modal__body {
      padding: var(--space-4) var(--space-6) var(--space-6);
    }

    @media (prefers-reduced-motion: no-preference) {
      .modal[open] {
        animation: modal-in 0.15s ease;
      }
    }

    @keyframes modal-in {
      from {
        opacity: 0;
        transform: translateY(8px);
      }
    }
  `,
})
export class Modal {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  /** `center` (default) or `top` (a search palette). */
  readonly position = input<'center' | 'top'>('center');
  readonly closed = output<void>();

  protected readonly titleId = `modal-title-${nextId++}`;
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private opener: HTMLElement | null = null;

  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog().nativeElement;
      if (this.open()) {
        if (!element.open) {
          this.opener = document.activeElement as HTMLElement | null;
          element.showModal();
          const first = this.body()?.nativeElement.querySelector<HTMLElement>('[data-autofocus]');
          (first ?? this.closeButton()?.nativeElement)?.focus();
        }
      } else if (element.open) {
        element.close();
      }
    });
  }

  /** Escape: the parent decides (it owns `open`). */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closed.emit();
  }

  /** The dialog closed (by the parent): focus goes back where it was, or to the page's main area when that element is gone. */
  protected onClose(): void {
    const target = this.opener?.isConnected ? this.opener : document.getElementById('main');
    target?.focus();
    this.opener = null;
  }

  /** Where the last press started: a text selection dragged out of the panel must not close it. */
  private pressedOnBackdrop = false;

  protected onPress(event: MouseEvent): void {
    this.pressedOnBackdrop = event.target === this.dialog().nativeElement;
  }

  /** The content fills the `<dialog>` (no padding), so a click on the element itself is on the backdrop. */
  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && this.pressedOnBackdrop) {
      this.closed.emit();
    }
    this.pressedOnBackdrop = false;
  }
}

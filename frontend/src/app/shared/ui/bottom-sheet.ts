import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

export type SheetState = 'peek' | 'expanded';

/** Drag distance (px) that switches the state; a shorter drag snaps back. */
const DRAG_THRESHOLD = 60;
/** Movement (px) from which a press counts as a drag, not a click. */
const CLICK_SLOP = 4;

let nextId = 0;

/**
 * Phone sheet fixed to the bottom of the screen. In `peek` only the handle shows;
 * `expanded` shows the content. The handle is a real button (click, Enter, Space)
 * and can also be dragged: on release the sheet snaps to the nearer state.
 */
@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #sheet
      class="sheet"
      [class.sheet--dragging]="dragOffset() !== null"
      [style.transform]="transform()"
    >
      <div
        #header
        class="header"
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd($event)"
        (pointercancel)="dragCancel()"
      >
        <button
          type="button"
          class="handle"
          [attr.aria-expanded]="state() === 'expanded'"
          [attr.aria-controls]="bodyId"
          [attr.aria-label]="label()"
          (click)="toggle()"
        >
          <span class="grip" aria-hidden="true"></span>
        </button>
      </div>
      <div
        #body
        class="body"
        [id]="bodyId"
        [attr.inert]="state() === 'expanded' ? null : ''"
        [attr.tabindex]="scrollable() ? 0 : null"
        [attr.role]="scrollable() ? 'region' : null"
        [attr.aria-label]="scrollable() ? label() : null"
      >
        <div #content class="content"><ng-content /></div>
      </div>
    </div>
  `,
  styles: `
    .sheet {
      position: fixed;
      inset: auto 0 0;
      z-index: 20;
      display: flex;
      flex-direction: column;
      height: 85dvh;
      border: 1px solid var(--glass-border);
      border-bottom: 0;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      background: var(--glass-bg-strong);
      -webkit-backdrop-filter: blur(var(--glass-blur));
      backdrop-filter: blur(var(--glass-blur));
      box-shadow: var(--shadow-raised);
      transition: transform 0.25s ease;
    }

    .sheet--dragging {
      transition: none;
    }

    .header {
      flex: none;
      touch-action: none;
    }

    .handle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      min-height: 2.75rem;
      padding: 0;
      border: 0;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      background: none;
      cursor: grab;
    }

    .handle:focus-visible {
      outline-offset: -4px;
    }

    .grip {
      width: 2.5rem;
      height: 0.3rem;
      border-radius: var(--radius-pill);
      background: var(--color-border-strong);
    }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .content {
      padding: 0 var(--space-4) var(--space-6);
    }

    @media (prefers-reduced-motion: reduce) {
      .sheet {
        transition: none;
      }
    }
  `,
})
export class BottomSheet {
  readonly state = model<SheetState>('peek');
  /** Accessible name of the handle button. */
  readonly label = input('Show/Hide trip settings and results');

  protected readonly bodyId = `bottom-sheet-body-${nextId++}`;
  /** Pixels the sheet is pushed down while dragging; null when not dragging. */
  protected readonly dragOffset = signal<number | null>(null);
  protected readonly scrollable = signal(false);

  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  private startY = 0;
  private startOffset = 0;
  private pointerId: number | null = null;
  private moved = false;

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => {
        const body = this.body().nativeElement;
        this.scrollable.set(body.scrollHeight > body.clientHeight);
      });
      observer.observe(this.body().nativeElement);
      observer.observe(this.content().nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected transform(): string {
    const offset = this.dragOffset();
    if (offset !== null) {
      return `translateY(${offset}px)`;
    }
    return this.state() === 'expanded' ? 'translateY(0)' : 'translateY(calc(100% - 2.75rem))';
  }

  protected toggle(): void {
    if (this.moved) {
      return;
    }
    this.state.set(this.state() === 'expanded' ? 'peek' : 'expanded');
  }

  protected dragStart(event: PointerEvent): void {
    if (event.button > 0) {
      return;
    }
    this.pointerId = event.pointerId;
    this.startY = event.clientY;
    this.startOffset = this.state() === 'expanded' ? 0 : this.maxOffset();
    this.moved = false;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  protected dragMove(event: PointerEvent): void {
    if (this.pointerId === null) {
      return;
    }
    const delta = event.clientY - this.startY;
    if (Math.abs(delta) > CLICK_SLOP) {
      this.moved = true;
    }
    if (this.moved) {
      const offset = Math.min(Math.max(this.startOffset + delta, 0), this.maxOffset());
      this.dragOffset.set(offset);
    }
  }

  protected dragEnd(event: PointerEvent): void {
    if (this.pointerId === null) {
      return;
    }
    const delta = event.clientY - this.startY;
    if (delta <= -DRAG_THRESHOLD) {
      this.state.set('expanded');
    } else if (delta >= DRAG_THRESHOLD) {
      this.state.set('peek');
    }
    this.dragCancel();
    // A click that ends a drag fires right after pointerup; ignore it.
    setTimeout(() => (this.moved = false));
  }

  protected dragCancel(): void {
    this.pointerId = null;
    this.dragOffset.set(null);
  }

  /** How far the sheet is pushed down in `peek`: everything but the handle. */
  private maxOffset(): number {
    return Math.max(
      this.sheet().nativeElement.offsetHeight - this.header().nativeElement.offsetHeight,
      0,
    );
  }
}

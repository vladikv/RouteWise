import { CurrencyPipe, DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip, TripPriority } from '../../../core/api/models';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { ColumnBox, LONG_PRESS_MS, columnAt, pastThreshold } from './board-drag';
import { PriorityColumn } from './trip-figures';
import { TripCard } from './trip-card';
import { TripMove } from './trip-move';

/** One press on a card, from pointer down until it is released or cancelled. */
interface Press {
  trip: Trip;
  slot: HTMLElement;
  pointerId: number;
  touch: boolean;
  startX: number;
  startY: number;
  /** Where the pointer grabbed the card, relative to its top-left corner. */
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  active: boolean;
  cancelled: boolean;
  ghost: HTMLElement | null;
  timer: ReturnType<typeof setTimeout> | null;
}

const NO_DRAG_START = 'button, app-trip-menu, app-trip-actions, input, select, textarea';

/**
 * Trips as one glass lane per priority, cards stacked, equal width from 1024 px (below that they scroll sideways in a focusable region). The lane header
 * has the priority's colour dot, name, count, total cost and a "+" link that opens New trip with
 * that priority.
 *
 * A card can be dragged to another column (hand-written pointer events, no library): after a few
 * pixels of travel with a mouse or pen, after a short press with a finger (so the page still
 * scrolls). A floating copy follows the pointer and the column under it is highlighted; a drop
 * emits `moved`, Escape or a drop outside the columns cancels. A press that does not travel stays
 * a click, and presses on buttons and menus never start a drag. The "⋯" menu is the way to move
 * a card without dragging.
 */
@Component({
  selector: 'app-trip-board',
  imports: [CurrencyPipe, RouterLink, TripCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p id="board-hint" class="visually-hidden">
      Drag a card to another column, or use its actions menu, to change the trip's priority.
    </p>
    <div
      class="board"
      [class.board--dragging]="dragId() !== null"
      tabindex="0"
      role="region"
      aria-label="Trips by priority"
      aria-describedby="board-hint"
      (dragstart)="$event.preventDefault()"
      (selectstart)="dragId() !== null && $event.preventDefault()"
    >
      @for (column of columns(); track column.priority) {
        <section
          class="column"
          [class.column--target]="target() === column.priority"
          [attr.data-priority]="column.priority"
          [attr.aria-labelledby]="'column-' + column.priority"
        >
          <header class="column__head">
            <h2 class="column__title" [id]="'column-' + column.priority">
              <span class="lane-dot" [attr.data-lane]="column.priority" aria-hidden="true"></span>
              {{ priorityLabels[column.priority] }}
              <span class="column__count">
                {{ column.count
                }}<span class="visually-hidden">{{ column.count === 1 ? ' trip' : ' trips' }}</span>
              </span>
            </h2>
            <a
              class="column__add"
              routerLink="/trips/new"
              [queryParams]="{ priority: column.priority }"
              [attr.aria-label]="'New ' + priorityLabels[column.priority] + ' trip'"
              [attr.title]="'New ' + priorityLabels[column.priority] + ' trip'"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </a>
            @if (column.currency) {
              <p class="column__total muted">
                {{ column.totalCost | currency: column.currency : 'symbol' : '1.0-0' }} total
              </p>
            }
          </header>
          @if (column.entries.length === 0) {
            <p class="column__empty muted">No trips</p>
          } @else {
            <ul class="column__list">
              @for (entry of column.entries; track entry.trip.id) {
                <li
                  class="slot"
                  [class.slot--source]="dragId() === entry.trip.id"
                  (pointerdown)="pressed($event, entry.trip)"
                >
                  <app-trip-card
                    [trip]="entry.trip"
                    [figures]="entry.figures"
                    [deleting]="deletingId() === entry.trip.id"
                    [moving]="movingIds().has(entry.trip.id)"
                    (deleted)="deleted.emit(entry.trip)"
                    (moved)="moved.emit({ trip: entry.trip, priority: $event, focus: true })"
                  />
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
  styles: `
    /* Lanes side by side; they scroll sideways inside this focusable region when they do not fit. */
    .board {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(16rem, 82%);
      gap: var(--space-3);
      align-items: stretch;
      padding-bottom: var(--space-2);
      overflow-x: auto;
      scroll-snap-type: x proximity;
    }

    .board:focus-visible {
      outline-offset: -2px;
    }

    /* A lane: a dark glass tray (fill, border and highlight only; no blur layer inside the shell). */
    .column {
      min-width: 0;
      padding: var(--space-3);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-xl);
      background: var(--glass-bg-shell);
      box-shadow: var(--glass-highlight);
      scroll-snap-align: start;
    }

    /* The lane a dropped card would land in: lighter fill and an edge in the highlight tint. */
    .column--target {
      border-color: var(--color-highlight-edge);
      background: var(--glass-bg-strong);
      box-shadow:
        var(--glass-highlight),
        0 0 24px var(--color-primary-a20);
    }

    .board--dragging,
    .board--dragging ::ng-deep * {
      cursor: grabbing !important;
      user-select: none;
    }

    .slot {
      -webkit-touch-callout: none;
    }

    @media (hover: none) {
      .slot {
        user-select: none;
      }
    }

    .slot--source {
      border-radius: var(--radius-lg);
      outline: 2px dashed var(--color-border-strong);
      outline-offset: -2px;
    }

    .slot--source > app-trip-card {
      opacity: 0.35;
    }

    .column__head {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 0 var(--space-2);
      min-height: 3.25rem;
      margin-bottom: var(--space-3);
    }

    .column__title {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      margin: 0;
      font-size: 1.125rem;
    }

    .column__count {
      padding: 0 var(--space-2);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      box-shadow: var(--glass-highlight);
      font-size: 0.875rem;
    }

    .column__add {
      display: inline-flex;
      grid-row: 1 / span 2;
      grid-column: 2;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-pill);
      background: var(--glass-bg-strong);
      box-shadow: var(--glass-highlight);
      color: var(--color-text);
    }

    .column__add:hover {
      border-color: var(--color-border-strong);
      background: var(--color-text-a14);
    }

    .column__add svg {
      width: 1.25rem;
      height: 1.25rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    .column__total {
      margin: 0;
      font-size: 0.875rem;
    }

    .column__empty {
      margin: 0;
      padding: var(--space-6) var(--space-3);
      border: 1px dashed var(--glass-border);
      border-radius: var(--radius-lg);
      font-size: 0.875rem;
      text-align: center;
    }

    .column__list {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    /* Lanes fit side by side: no scroll container, so a card menu on a lane's last card is never clipped. */
    @media (min-width: 64rem) {
      .board {
        grid-auto-columns: minmax(0, 1fr);
        overflow-x: visible;
      }
    }
  `,
})
export class TripBoard {
  readonly columns = input.required<PriorityColumn[]>();
  readonly deletingId = input<number | null>(null);
  readonly movingIds = input<ReadonlySet<number>>(new Set());
  readonly deleted = output<Trip>();
  readonly moved = output<TripMove>();

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly dragId = signal<number | null>(null);
  private readonly dragPriority = signal<TripPriority | null>(null);
  private readonly overColumn = signal<TripPriority | null>(null);
  /** The column a drop would move the card to: the one under the pointer, unless it is its own. */
  protected readonly target = computed(() => {
    const over = this.overColumn();
    return over !== null && over !== this.dragPriority() ? over : null;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private press: Press | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.finish();
      this.document.removeEventListener('click', this.swallowClick, true);
    });
  }

  protected pressed(event: PointerEvent, trip: Trip): void {
    const target = event.target as Element;
    const touch = event.pointerType === 'touch';
    if (
      this.press ||
      !event.isPrimary ||
      (!touch && event.button !== 0) ||
      target.closest(NO_DRAG_START)
    ) {
      return;
    }
    const slot = event.currentTarget as HTMLElement;
    const box = slot.getBoundingClientRect();
    this.press = {
      trip,
      slot,
      pointerId: event.pointerId,
      touch,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - box.left,
      offsetY: event.clientY - box.top,
      x: event.clientX,
      y: event.clientY,
      active: false,
      cancelled: false,
      ghost: null,
      timer: touch ? setTimeout(() => this.begin(), LONG_PRESS_MS) : null,
    };
    this.document.addEventListener('pointermove', this.onMove);
    this.document.addEventListener('pointerup', this.onUp);
    this.document.addEventListener('pointercancel', this.onCancel);
    this.document.addEventListener('keydown', this.onKey);
    if (touch) {
      this.document.addEventListener('contextmenu', this.blockDefault);
    }
  }

  private readonly onMove = (event: PointerEvent): void => {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    press.x = event.clientX;
    press.y = event.clientY;
    if (!press.active) {
      if (pastThreshold(press.x - press.startX, press.y - press.startY)) {
        // A finger that moves before the long press is scrolling: leave it alone.
        if (press.touch) {
          this.finish();
        } else {
          this.begin();
        }
      }
      return;
    }
    event.preventDefault();
    this.follow(press);
  };

  private readonly onUp = (event: PointerEvent): void => {
    const press = this.press;
    if (!press || event.pointerId !== press.pointerId) {
      return;
    }
    const drop = press.active && !press.cancelled ? this.target() : null;
    const trip = press.trip;
    this.finish();
    if (drop) {
      this.moved.emit({ trip, priority: drop });
    }
  };

  private readonly onCancel = (event: PointerEvent): void => {
    if (event.pointerId === this.press?.pointerId) {
      this.finish();
    }
  };

  /** Escape drops the drag but keeps the press, so the release that follows is not a click. */
  private readonly onKey = (event: KeyboardEvent): void => {
    const press = this.press;
    if (event.key === 'Escape' && press?.active && !press.cancelled) {
      press.cancelled = true;
      press.ghost?.remove();
      press.ghost = null;
      this.overColumn.set(null);
    }
  };

  private readonly blockDefault = (event: Event): void => {
    if (event.cancelable) {
      event.preventDefault();
    }
  };

  private readonly swallowClick = (event: Event): void => {
    event.stopPropagation();
    event.preventDefault();
  };

  private begin(): void {
    const press = this.press;
    if (!press || press.active) {
      return;
    }
    press.timer = null;
    press.active = true;
    try {
      press.slot.setPointerCapture(press.pointerId);
    } catch {
      // The pointer is already gone; the document listeners still end the drag.
    }
    // The release after a drag must not open the trip behind the card.
    this.document.addEventListener('click', this.swallowClick, true);
    if (press.touch) {
      this.document.addEventListener('touchmove', this.blockDefault, { passive: false });
    }
    press.ghost = this.createGhost(press);
    this.dragId.set(press.trip.id);
    this.dragPriority.set(press.trip.priority);
    this.follow(press);
  }

  private follow(press: Press): void {
    if (press.ghost) {
      const x = press.x - press.offsetX;
      const y = press.y - press.offsetY;
      press.ghost.style.transform = `translate(${x}px, ${y}px) scale(1.03)`;
    }
    this.overColumn.set(columnAt(this.columnBoxes(), press.x, press.y));
  }

  private columnBoxes(): ColumnBox[] {
    const columns = this.host.nativeElement.querySelectorAll<HTMLElement>('[data-priority]');
    return Array.from(columns).map((column) => {
      const { left, right, top, bottom } = column.getBoundingClientRect();
      return { priority: column.dataset['priority'] as TripPriority, left, right, top, bottom };
    });
  }

  /** A copy of the card that floats above the page; the original stays as a dashed placeholder. */
  private createGhost(press: Press): HTMLElement {
    const box = press.slot.getBoundingClientRect();
    const ghost = press.slot.cloneNode(true) as HTMLElement;
    ghost.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
    ghost.setAttribute('aria-hidden', 'true');
    ghost.setAttribute('inert', '');
    Object.assign(ghost.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: `${box.width}px`,
      margin: '0',
      zIndex: '60',
      pointerEvents: 'none',
      opacity: '0.97',
      // The card itself is translucent glass: a solid backing keeps it legible over the columns.
      background: 'var(--color-surface)',
      borderRadius: 'var(--radius-lg)',
      listStyle: 'none',
      filter: 'drop-shadow(0 12px 24px rgb(0 0 0 / 0.35))',
    });
    this.document.body.appendChild(ghost);
    return ghost;
  }

  /** Ends the press: removes the listeners and the ghost, and clears the highlight. */
  private finish(): void {
    const press = this.press;
    this.document.removeEventListener('pointermove', this.onMove);
    this.document.removeEventListener('pointerup', this.onUp);
    this.document.removeEventListener('pointercancel', this.onCancel);
    this.document.removeEventListener('keydown', this.onKey);
    this.document.removeEventListener('contextmenu', this.blockDefault);
    this.document.removeEventListener('touchmove', this.blockDefault);
    if (press?.active) {
      // After the click that follows the release, which is swallowed.
      setTimeout(() => this.document.removeEventListener('click', this.swallowClick, true));
    }
    if (press?.timer) {
      clearTimeout(press.timer);
    }
    press?.ghost?.remove();
    if (press?.slot.hasPointerCapture?.(press.pointerId)) {
      press.slot.releasePointerCapture(press.pointerId);
    }
    this.press = null;
    this.dragId.set(null);
    this.dragPriority.set(null);
    this.overColumn.set(null);
  }
}

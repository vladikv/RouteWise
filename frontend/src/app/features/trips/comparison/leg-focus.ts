import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  Injectable,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { IconButton } from '../../../shared/ui/icon-button';

/**
 * Which leg of a trip the map shows in focus, shared by the leg rows of one page (provide it on the
 * page). A hovered or focused row wins over a pinned one; leaving it returns to the pinned leg, or to
 * the whole route.
 */
@Injectable()
export class LegFocus {
  private readonly hovered = signal<number | null>(null);
  /** The leg chosen with a "Show on map" button; it stays until chosen again. */
  readonly pinned = signal<number | null>(null);
  readonly focused = computed(() => this.hovered() ?? this.pinned());

  hover(leg: number): void {
    this.hovered.set(leg);
  }

  leave(leg: number): void {
    if (this.hovered() === leg) {
      this.hovered.set(null);
    }
  }

  togglePin(leg: number): void {
    this.pinned.update((current) => (current === leg ? null : leg));
  }
}

/**
 * Put on a leg row: pointing at it or moving focus into it shows that leg on the map, and the row
 * gets `leg-hover--active` while its leg is the one in focus. Does nothing without a `LegFocus`.
 */
@Directive({
  selector: '[appLegHover]',
  host: {
    '(pointerenter)': 'enter()',
    '(pointerleave)': 'leave()',
    '(focusin)': 'enter()',
    '(focusout)': 'leave()',
    '[class.leg-hover--active]': 'active()',
  },
})
export class LegHover {
  /** Index of the leg in the route. */
  readonly appLegHover = input.required<number>();
  private readonly focus = inject(LegFocus, { optional: true });

  protected readonly active = computed(() => this.focus?.focused() === this.appLegHover());

  protected enter(): void {
    this.focus?.hover(this.appLegHover());
  }

  protected leave(): void {
    this.focus?.leave(this.appLegHover());
  }
}

/**
 * The keyboard and touch way to the same highlight: a toggle that pins the leg on the map
 * (`aria-pressed`). Not rendered without a `LegFocus` (no map to show it on).
 */
@Component({
  selector: 'app-leg-map-toggle',
  imports: [IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (focus) {
      <app-icon-button
        [label]="'Show leg ' + (leg() + 1) + ' on the map'"
        [pressed]="focus.pinned() === leg()"
        (click)="focus.togglePin(leg())"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z" />
          <circle cx="12" cy="10" r="2.2" />
        </svg>
      </app-icon-button>
    }
  `,
  styles: `
    :host {
      display: inline-block;
    }

    svg {
      width: 1.125rem;
      height: 1.125rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class LegMapToggle {
  /** Index of the leg in the route. */
  readonly leg = input.required<number>();
  protected readonly focus = inject(LegFocus, { optional: true });
}

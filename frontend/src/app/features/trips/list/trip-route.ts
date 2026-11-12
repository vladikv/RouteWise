import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TransportModeCode } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';

/** Above this many legs the mode icons would crowd the line, so only the dots are drawn. */
const MAX_ICON_LEGS = 5;

/**
 * A short horizontal line with a dot per stop and the mode icon of each leg between the dots.
 * Purely decorative: the stop names are always shown as text next to it. Without `legModes`
 * (figures still loading or unavailable) only the dots and the line are drawn.
 */
@Component({
  selector: 'app-trip-route',
  imports: [ModeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (stop of stopIndexes(); track stop) {
      <span class="dot"></span>
      @if (stop < stopIndexes().length - 1) {
        <span class="leg">
          <span class="line"></span>
          @if (modeAt(stop); as mode) {
            <app-mode-icon [mode]="mode" />
            <span class="line"></span>
          }
        </span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      min-width: 0;
    }

    .dot {
      flex: none;
      width: 0.5rem;
      height: 0.5rem;
      border-radius: var(--radius-pill);
      background: var(--color-primary-ink);
    }

    .leg {
      display: flex;
      flex: 1 1 0;
      align-items: center;
      gap: var(--space-1);
      min-width: 0;
      padding: 0 var(--space-1);
      color: var(--color-text-muted);
    }

    .line {
      flex: 1 1 0;
      min-width: 0.25rem;
      height: 2px;
      border-radius: var(--radius-pill);
      background: var(--color-text-a50);
    }

    app-mode-icon {
      width: 1.125rem;
      height: 1.125rem;
    }
  `,
})
export class TripRoute {
  /** Number of stops (2–10). */
  readonly stops = input.required<number>();
  /** The mode of each leg, in order; null while unknown. */
  readonly legModes = input<TransportModeCode[] | null>(null);

  protected readonly stopIndexes = computed(() =>
    Array.from({ length: this.stops() }, (_, index) => index),
  );
  private readonly icons = computed(() => {
    const modes = this.legModes();
    return modes && modes.length <= MAX_ICON_LEGS ? modes : null;
  });

  protected modeAt(leg: number): TransportModeCode | null {
    return this.icons()?.[leg] ?? null;
  }
}

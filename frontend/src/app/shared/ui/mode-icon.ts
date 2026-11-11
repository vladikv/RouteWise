import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TransportModeCode } from '../../core/api/models';

/**
 * Small line icon for a transport mode. Decorative: it is hidden from assistive
 * technology and must always sit next to the mode's name.
 */
@Component({
  selector: 'app-mode-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      @switch (mode()) {
        @case ('TRAIN') {
          <rect x="6" y="3" width="12" height="14" rx="3" />
          <path d="M6 11h12M9.5 14.5h.01M14.5 14.5h.01M8 21l2-4M16 21l-2-4" />
        }
        @case ('BUS') {
          <rect x="4" y="4" width="16" height="13" rx="2.5" />
          <path d="M4 11h16M8 17v2.5M16 17v2.5M8 14h.01M16 14h.01" />
        }
        @case ('CAR') {
          <path d="M5 16V12l2-5h10l2 5v4M3.5 16h17M7 16v2.5M17 16v2.5M5 12h14" />
        }
        @case ('BIKE') {
          <circle cx="6" cy="16" r="3.5" />
          <circle cx="18" cy="16" r="3.5" />
          <path d="M6 16l4-8h5l3 8M10 8H8M12 16l-2-8" />
        }
        @case ('PLANE') {
          <path d="M3 13l18-7-5 14-3.5-6L3 13zM12.5 14l3-3" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.25rem;
      height: 1.25rem;
      flex: none;
      vertical-align: text-bottom;
    }

    svg {
      width: 100%;
      height: 100%;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class ModeIcon {
  readonly mode = input.required<TransportModeCode>();
}

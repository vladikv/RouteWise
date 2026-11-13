import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TransportMode } from '../../core/api/models';
import { ModeIcon } from '../../shared/ui/mode-icon';
import { MODE_LABELS } from '../../shared/util/labels';

/** One transport mode with the parameters every comparison uses, as API values. */
@Component({
  selector: 'app-mode-card',
  imports: [CurrencyPipe, DecimalPipe, ModeIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let m = mode();
    <article class="card-body" [attr.aria-labelledby]="'mode-' + m.code">
      <h3 [id]="'mode-' + m.code">
        <span class="badge-icon"><app-mode-icon [mode]="m.code" /></span>
        {{ labels[m.code] }}
      </h3>
      <dl>
        <div>
          <dt>Avg. speed</dt>
          <dd>{{ m.avgSpeedKmh | number }} km/h</dd>
        </div>
        <div>
          <dt>Cost per km</dt>
          <dd>{{ m.costPerKm | currency: 'EUR' : 'symbol' : '1.2-2' }}</dd>
        </div>
        <div>
          <dt>CO₂ per km</dt>
          <dd>{{ m.co2GramsPerKm | number }} g</dd>
        </div>
        <div>
          <dt>Max. distance</dt>
          <dd>{{ m.maxDistanceKm | number }} km</dd>
        </div>
      </dl>
    </article>
  `,
  styles: `
    :host {
      display: block;
    }

    .card-body {
      height: 100%;
      padding: var(--space-4);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-lg);
      background: var(--glass-bg);
      box-shadow: var(--glass-highlight), var(--shadow-card);
    }

    h3 {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      margin: 0 0 var(--space-4);
      font-size: 1.25rem;
    }

    .badge-icon {
      display: inline-grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      border: 1px solid var(--glass-border);
      border-radius: 50%;
      background: var(--glass-bg-strong);
    }

    dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }

    dl > div {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 0 var(--space-3);
      padding-bottom: var(--space-2);
      border-bottom: 1px solid var(--color-border);
    }

    dl > div:last-child {
      padding-bottom: 0;
      border-bottom: 0;
    }

    dt {
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    dd {
      margin: 0;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      margin-left: auto;
      white-space: nowrap;
    }
  `,
})
export class ModeCard {
  readonly mode = input.required<TransportMode>();
  protected readonly labels = MODE_LABELS;
}

import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { PRIORITY_LABELS } from '../../../shared/util/labels';
import { TripEntry, figuresOf, modeSummary } from './trip-figures';
import { TripMenu } from './trip-menu';

/**
 * Trips as a compact table, one row each. On narrow screens the date, route, mode
 * and CO₂ columns fold into a second line under the title.
 */
@Component({
  selector: 'app-trip-table',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, ModeIcon, TripMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-table.html',
  styleUrl: './trip-table.scss',
})
export class TripTable {
  readonly entries = input.required<TripEntry[]>();
  readonly deletingId = input<number | null>(null);
  readonly deleted = output<Trip>();

  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly figuresOf = figuresOf;
  protected readonly modeSummary = modeSummary;
}

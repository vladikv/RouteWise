import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TransportModeCode, TripPriority } from '../../../core/api/models';
import { FilterChip } from '../../../shared/ui/filter-chip';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { SegmentedToggle, ToggleOption } from '../../../shared/ui/segmented-toggle';
import { MODE_LABELS, PRIORITY_LABELS } from '../../../shared/util/labels';
import { BOARD_PRIORITIES } from './trip-figures';

export type TripView = 'board' | 'list';

const MODES: TransportModeCode[] = ['TRAIN', 'BUS', 'CAR', 'BIKE', 'PLANE'];

function toggled<T>(selected: readonly T[], value: T, on: boolean): T[] {
  const rest = selected.filter((item) => item !== value);
  return on ? [...rest, value] : rest;
}

/** Search, priority and mode filters, the board / list switch and the New trip button. */
@Component({
  selector: 'app-trip-toolbar',
  imports: [RouterLink, FilterChip, ModeIcon, SegmentedToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-toolbar.html',
  styleUrl: './trip-toolbar.scss',
})
export class TripToolbar {
  readonly search = model('');
  readonly priorities = model<TripPriority[]>([]);
  readonly modes = model<TransportModeCode[]>([]);
  readonly view = model.required<TripView>();
  readonly priorityCounts = input.required<Record<TripPriority, number>>();

  protected readonly priorityOptions = BOARD_PRIORITIES;
  protected readonly modeOptions = MODES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly modeLabels = MODE_LABELS;
  protected readonly viewOptions: ToggleOption<TripView>[] = [
    { value: 'board', label: 'Board' },
    { value: 'list', label: 'List' },
  ];

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected setPriority(priority: TripPriority, on: boolean): void {
    this.priorities.update((selected) => toggled(selected, priority, on));
  }

  protected setMode(mode: TransportModeCode, on: boolean): void {
    this.modes.update((selected) => toggled(selected, mode, on));
  }
}

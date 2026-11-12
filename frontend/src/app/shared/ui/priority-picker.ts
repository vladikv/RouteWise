import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TripPriority } from '../../core/api/models';
import { PRIORITIES, PRIORITY_DESCRIPTIONS, PRIORITY_LABELS } from '../util/labels';

/** The four priorities as a radio group of cards, each with an icon and its meaning. */
@Component({
  selector: 'app-priority-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './priority-picker.html',
  styleUrl: './priority-picker.scss',
})
export class PriorityPicker {
  readonly value = input.required<TripPriority>();
  /** Radio group name; must be unique on the page. */
  readonly name = input.required<string>();
  readonly valueChange = output<TripPriority>();

  protected readonly priorities = PRIORITIES;
  protected readonly labels = PRIORITY_LABELS;
  protected readonly descriptions = PRIORITY_DESCRIPTIONS;
}

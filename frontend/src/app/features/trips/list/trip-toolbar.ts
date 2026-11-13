import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TransportModeCode, TripPriority } from '../../../core/api/models';
import { BottomSheet, SheetState } from '../../../shared/ui/bottom-sheet';
import { FilterGroup, FilterIcon, FilterOption, FilterUnit } from '../../../shared/ui/filter-group';
import { ModeIcon } from '../../../shared/ui/mode-icon';
import { SegmentedToggle, ToggleOption } from '../../../shared/ui/segmented-toggle';
import { MODE_LABELS, PRIORITY_LABELS } from '../../../shared/util/labels';
import { LayoutBreakpoint } from '../../../shared/util/layout-breakpoint';
import { BOARD_PRIORITIES } from './trip-figures';
import { FILTER_MODES, activeChipCount, resultSummary } from './trip-filters';

export type TripView = 'board' | 'list';

/**
 * Search, Board / List switch and New trip on the first row; the Priority and Mode filter groups
 * on the second, and the result count with "Clear filters" below. Below 768 px the groups move
 * into a bottom sheet opened by a "Filters" button.
 */
@Component({
  selector: 'app-trip-toolbar',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    BottomSheet,
    FilterGroup,
    FilterIcon,
    ModeIcon,
    SegmentedToggle,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-toolbar.html',
  styleUrl: './trip-toolbar.scss',
  host: { '(document:keydown.escape)': 'closeSheet()' },
})
export class TripToolbar {
  readonly search = model('');
  readonly priorities = model<TripPriority[]>([]);
  readonly modes = model<TransportModeCode[]>([]);
  readonly view = model.required<TripView>();
  /** Counts come from the full list, not the filtered one. */
  readonly priorityCounts = input.required<Record<TripPriority, number>>();
  readonly modeCounts = input.required<Record<TransportModeCode, number>>();
  readonly total = input.required<number>();
  readonly shown = input.required<number>();

  protected readonly sheetOpen = signal(false);
  protected readonly unit: FilterUnit = { one: 'trip', other: 'trips' };
  protected readonly viewOptions: ToggleOption<TripView>[] = [
    { value: 'board', label: 'Board' },
    { value: 'list', label: 'List' },
  ];

  private readonly layout = inject(LayoutBreakpoint).layout;
  protected readonly narrow = computed(() => this.layout() === 'narrow');
  protected readonly summary = computed(() => resultSummary(this.shown(), this.total()));
  protected readonly chipCount = computed(() =>
    activeChipCount({ priorities: this.priorities(), modes: this.modes() }),
  );
  protected readonly filtering = computed(
    () => this.chipCount() > 0 || this.search().trim() !== '',
  );
  protected readonly priorityOptions = computed<FilterOption[]>(() =>
    BOARD_PRIORITIES.map((priority) => ({
      value: priority,
      label: PRIORITY_LABELS[priority],
      count: this.priorityCounts()[priority],
    })),
  );
  protected readonly modeOptions = computed<FilterOption[]>(() =>
    FILTER_MODES.map((mode) => ({
      value: mode,
      label: MODE_LABELS[mode],
      count: this.modeCounts()[mode],
    })),
  );

  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly filtersButton = viewChild<ElementRef<HTMLButtonElement>>('filtersButton');

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** The group deals in plain strings; only this toolbar's own option values come back. */
  protected setPriorities(values: string[]): void {
    this.priorities.set(values as TripPriority[]);
  }

  protected setModes(values: string[]): void {
    this.modes.set(values as TransportModeCode[]);
  }

  protected modeOf(option: FilterOption): TransportModeCode {
    return option.value as TransportModeCode;
  }

  protected clearFilters(): void {
    this.search.set('');
    this.priorities.set([]);
    this.modes.set([]);
  }

  protected openSheet(): void {
    this.sheetOpen.set(true);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('.sheet-title')?.focus(),
      { injector: this.injector },
    );
  }

  protected closeSheet(): void {
    if (!this.sheetOpen()) {
      return;
    }
    this.sheetOpen.set(false);
    this.filtersButton()?.nativeElement.focus();
  }

  /** The sheet's handle toggles to `peek`; for the filters that means closed. */
  protected onSheetState(state: SheetState): void {
    if (state === 'peek') {
      this.closeSheet();
    }
  }
}

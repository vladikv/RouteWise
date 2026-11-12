import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FieldError } from '../../core/api/api-error';
import {
  City,
  MAX_STOPS,
  MIN_STOPS,
  Trip,
  TripDraft,
  TripPriority,
  TripRequest,
} from '../../core/api/models';
import { RouteMap } from '../../shared/map/route-map';
import { CityPicker } from '../../shared/ui/city-picker';
import { todayIso } from '../../shared/util/date';
import { PRIORITIES, PRIORITY_LABELS } from '../../shared/util/labels';

type FieldName = 'title' | 'departureDate' | 'travelers' | 'priority' | 'notes';

/** Starting values for a new trip; every field is optional. */
export interface TripPreset {
  title?: string;
  /** City ids in travel order; null for a stop still to choose. */
  stops?: (number | null)[];
  departureDate?: string;
  travelers?: number;
  priority?: TripPriority;
}

const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  blank: 'This field is required.',
  maxlength: 'This text is too long.',
  min: 'At least 1 traveler.',
  max: 'At most 9 travelers.',
  integer: 'Enter a whole number.',
  past: 'The departure date must be today or later.',
};

/**
 * Trip form for create and edit. Presentational: it validates and emits a
 * {@link TripRequest}; the page saves it and passes back server-side field errors.
 * The route is an ordered list of 2–10 stops, edited with city pickers or the map.
 */
@Component({
  selector: 'app-trip-form',
  imports: [ReactiveFormsModule, RouterLink, RouteMap, CityPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './trip-form.html',
  styleUrl: './trip-form.scss',
})
export class TripForm {
  readonly cities = input.required<City[]>();
  /** The trip to edit; null creates a new one. */
  readonly trip = input<Trip | null>(null);
  /** A draft from the advisor to prefill a new trip; unknown values stay empty. */
  readonly draft = input<TripDraft | null>(null);
  /** Values chosen elsewhere (the route explorer) to start a new trip with. */
  readonly preset = input<TripPreset | null>(null);
  readonly submitting = input(false);
  /** Field errors returned by the API for the last submit. */
  readonly serverErrors = input<FieldError[]>([]);
  readonly cancelLink = input.required<string>();
  readonly submitted = output<TripRequest>();

  protected readonly priorities = PRIORITIES;
  protected readonly priorityLabels = PRIORITY_LABELS;
  protected readonly today = todayIso();
  protected readonly minStops = MIN_STOPS;
  protected readonly maxStops = MAX_STOPS;

  protected readonly submitAttempted = signal(false);

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    title: ['', [Validators.required, Validators.maxLength(100), notBlank]],
    stops: this.formBuilder.array([this.stopControl(null), this.stopControl(null)], noRepeatedStop),
    departureDate: ['', [Validators.required, (control) => this.notInPast(control)]],
    travelers: [1, [Validators.required, Validators.min(1), Validators.max(9), wholeNumber]],
    priority: ['BALANCED' as TripPriority, Validators.required],
    notes: ['', Validators.maxLength(1000)],
  });

  protected get stops(): FormArray<FormControl<number | null>> {
    return this.form.controls.stops;
  }

  /** The form as a signal, so the stop list and the map follow every change. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  /** One entry per stop row; null where no city is chosen yet. */
  protected readonly stopValues = computed(() => this.formValue().stops ?? []);
  /** The chosen cities in order, for the map. */
  protected readonly mapStops = computed(() =>
    this.stopValues().filter((id): id is number => id !== null && id !== undefined),
  );

  /** E.g. "Berlin to Vienna", "Berlin to Vienna via Prague" or "Round trip from Berlin". */
  private readonly suggestedTitle = computed(() => {
    const ids = this.stopValues();
    if (ids.length < MIN_STOPS || ids.some((id) => id === null || id === undefined)) {
      return null;
    }
    const names = ids.map((id) => this.cities().find((city) => city.id === id)?.name);
    if (names.some((name) => name === undefined)) {
      return null;
    }
    const [first, last] = [names[0], names[names.length - 1]];
    if (first === last) {
      return `Round trip from ${first}`;
    }
    const via = names.slice(1, -1);
    return `${first} to ${last}${via.length > 0 ? ` via ${via.join(', ')}` : ''}`;
  });
  private lastSuggestedTitle: string | null = null;

  constructor() {
    // The title follows the stops while it is empty or still the previous
    // suggestion; a title the user wrote is never replaced.
    effect(() => {
      const suggested = this.suggestedTitle();
      if (!suggested) {
        return;
      }
      const title = this.form.controls.title;
      if (title.value.trim() === '' || title.value === this.lastSuggestedTitle) {
        title.setValue(suggested);
      }
      this.lastSuggestedTitle = suggested;
    });
    effect(() => {
      const preset = this.preset();
      if (preset) {
        const { stops, ...rest } = preset;
        if (stops) {
          this.setStops(stops);
        }
        this.form.patchValue(rest);
      }
    });
    effect(() => {
      const trip = this.trip();
      if (trip) {
        this.setStops(trip.stops.map((stop) => stop.cityId));
        this.form.reset({
          title: trip.title,
          stops: trip.stops.map((stop) => stop.cityId),
          departureDate: trip.departureDate,
          travelers: trip.travelers,
          priority: trip.priority,
          notes: trip.notes ?? '',
        });
      }
    });
    effect(() => {
      const draft = this.draft();
      if (draft) {
        const stops = draft.stops.map((city) => city?.id ?? null);
        this.setStops(stops);
        this.form.reset({
          title: draft.title,
          stops,
          departureDate: draft.departureDate ?? '',
          travelers: draft.travelers,
          priority: draft.priority,
          notes: draft.notes ?? '',
        });
        this.submitAttempted.set(false);
      }
    });
    effect(() => {
      for (const error of this.serverErrors()) {
        const control = this.controlForField(error.field);
        control?.setErrors({ ...control.errors, server: error.message });
        control?.markAsTouched();
      }
    });
  }

  protected stopLabel(index: number, count: number): string {
    if (index === 0) {
      return 'Start';
    }
    return index === count - 1 ? `Stop ${index + 1} (end)` : `Stop ${index + 1}`;
  }

  protected setStop(index: number, cityId: number | null): void {
    const control = this.stops.at(index);
    control.setValue(cityId);
    control.markAsTouched();
    control.markAsDirty();
  }

  protected addStop(): void {
    if (this.stops.length < MAX_STOPS) {
      this.stops.push(this.stopControl(null));
    }
  }

  protected removeStop(index: number): void {
    if (this.stops.length > MIN_STOPS) {
      this.stops.removeAt(index);
      this.stops.markAsDirty();
    }
  }

  /** Swaps a stop with its neighbour (-1 up, +1 down). */
  protected moveStop(index: number, delta: -1 | 1): void {
    const target = index + delta;
    if (target < 0 || target >= this.stops.length) {
      return;
    }
    const values = this.stops.getRawValue();
    [values[index], values[target]] = [values[target], values[index]];
    this.stops.setValue(values);
    this.stops.markAsDirty();
  }

  /** A city picked on the map fills the first empty stop, or is added as a new last stop. */
  protected addCityFromMap(cityId: number): void {
    const empty = this.stops.controls.findIndex((control) => control.value === null);
    if (empty >= 0) {
      this.setStop(empty, cityId);
    } else if (this.stops.length < MAX_STOPS) {
      this.stops.push(this.stopControl(cityId));
      this.stops.markAsDirty();
    }
  }

  protected submit(): void {
    this.submitAttempted.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const notes = value.notes.trim();
    this.submitted.emit({
      title: value.title.trim(),
      stops: value.stops.map((cityId) => ({ cityId: cityId as number })),
      departureDate: value.departureDate,
      travelers: value.travelers,
      priority: value.priority,
      notes: notes === '' ? null : notes,
    });
  }

  /** The message to show under a field, once the user has touched it. */
  protected errorFor(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched || !control.errors) {
      return null;
    }
    const [key, value] = Object.entries(control.errors)[0];
    return key === 'server' ? capitalize(String(value)) : (MESSAGES[key] ?? 'Invalid value.');
  }

  /** The message under one stop, once it was touched or a submit was tried. */
  protected stopError(index: number): string | null {
    const control = this.stops.at(index);
    if (!control || (!control.touched && !this.submitAttempted())) {
      return null;
    }
    if (control.errors?.['server']) {
      return capitalize(String(control.errors['server']));
    }
    if (control.errors?.['required']) {
      return 'Choose a city for this stop.';
    }
    const repeated = (this.stops.errors?.['repeatedStop'] as number[] | undefined) ?? [];
    return repeated.includes(index) ? 'Choose a different city than the stop before.' : null;
  }

  /** An error about the stop list as a whole, e.g. from the API. */
  protected stopsError(): string | null {
    const server = this.stops.errors?.['server'];
    return server ? capitalize(String(server)) : null;
  }

  /** Rebuilds the stop rows for the given cities (at least two rows). */
  private setStops(cityIds: (number | null)[]): void {
    const padded = [...cityIds];
    while (padded.length < MIN_STOPS) {
      padded.push(null);
    }
    this.stops.clear({ emitEvent: false });
    padded.forEach((id) => this.stops.push(this.stopControl(id), { emitEvent: false }));
    this.stops.updateValueAndValidity();
  }

  private stopControl(cityId: number | null): FormControl<number | null> {
    return new FormControl<number | null>(cityId, Validators.required);
  }

  /** "stops[1].cityId" from the API is the second stop; other names are form fields. */
  private controlForField(field: string): AbstractControl | null {
    const stop = /^stops\[(\d+)\]\.cityId$/.exec(field);
    if (stop) {
      return this.stops.at(Number(stop[1])) ?? null;
    }
    return this.form.get(field);
  }

  /** A past date is only allowed when editing a trip that already has it (same rule as the API). */
  private notInPast(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value;
    if (!value || value >= todayIso() || value === this.trip()?.departureDate) {
      return null;
    }
    return { past: true };
  }
}

function notBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.length > 0 && control.value.trim() === '' ? { blank: true } : null;
}

function wholeNumber(control: AbstractControl<number | null>): ValidationErrors | null {
  return control.value === null || Number.isInteger(control.value) ? null : { integer: true };
}

/** Same rule as the API: a stop may not be the same city as the stop before it. */
function noRepeatedStop(array: AbstractControl): ValidationErrors | null {
  const ids = (array.value ?? []) as (number | null)[];
  const repeated = ids
    .map((id, index) => (index > 0 && id !== null && id === ids[index - 1] ? index : -1))
    .filter((index) => index >= 0);
  return repeated.length > 0 ? { repeatedStop: repeated } : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');
}

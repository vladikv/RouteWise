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
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FieldError } from '../../core/api/api-error';
import { City, Trip, TripDraft, TripPriority, TripRequest } from '../../core/api/models';
import { RouteMap, RouteSelection } from '../../shared/map/route-map';
import { todayIso } from '../../shared/util/date';
import { PRIORITIES, PRIORITY_LABELS } from '../../shared/util/labels';

type FieldName =
  | 'title'
  | 'originCityId'
  | 'destinationCityId'
  | 'departureDate'
  | 'travelers'
  | 'priority'
  | 'notes';

/** Starting values for a new trip; every field is optional. */
export type TripPreset = Partial<
  Pick<
    TripRequest,
    'title' | 'originCityId' | 'destinationCityId' | 'departureDate' | 'travelers' | 'priority'
  >
>;

const MESSAGES: Record<string, string> = {
  required: 'This field is required.',
  blank: 'This field is required.',
  maxlength: 'This text is too long.',
  min: 'At least 1 traveler.',
  max: 'At most 9 travelers.',
  integer: 'Enter a whole number.',
  past: 'The departure date must be today or later.',
  sameCity: 'Origin and destination must be different cities.',
};

/**
 * Trip form for create and edit. Presentational: it validates and emits a
 * {@link TripRequest}; the page saves it and passes back server-side field errors.
 */
@Component({
  selector: 'app-trip-form',
  imports: [ReactiveFormsModule, RouterLink, RouteMap],
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

  protected readonly submitAttempted = signal(false);

  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group(
    {
      title: ['', [Validators.required, Validators.maxLength(100), notBlank]],
      originCityId: [null as number | null, Validators.required],
      destinationCityId: [null as number | null, Validators.required],
      departureDate: ['', [Validators.required, (control) => this.notInPast(control)]],
      travelers: [1, [Validators.required, Validators.min(1), Validators.max(9), wholeNumber]],
      priority: ['BALANCED' as TripPriority, Validators.required],
      notes: ['', Validators.maxLength(1000)],
    },
    { validators: differentCities },
  );

  /** The chosen cities as signals, so the map follows the dropdowns. */
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly originId = computed(() => this.formValue().originCityId ?? null);
  protected readonly destinationId = computed(() => this.formValue().destinationCityId ?? null);

  /** E.g. "Berlin to Vienna" once both cities are chosen. */
  private readonly suggestedTitle = computed(() => {
    const origin = this.cities().find((city) => city.id === this.originId());
    const destination = this.cities().find((city) => city.id === this.destinationId());
    return origin && destination ? `${origin.name} to ${destination.name}` : null;
  });
  private lastSuggestedTitle: string | null = null;

  constructor() {
    // The title follows the cities while it is empty or still the previous
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
        this.form.patchValue(preset);
      }
    });
    effect(() => {
      const trip = this.trip();
      if (trip) {
        this.form.reset({
          title: trip.title,
          originCityId: trip.origin.id,
          destinationCityId: trip.destination.id,
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
        this.form.reset({
          title: draft.title,
          originCityId: draft.origin?.id ?? null,
          destinationCityId: draft.destination?.id ?? null,
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
        const control = this.form.get(error.field);
        control?.setErrors({ ...control.errors, server: error.message });
        control?.markAsTouched();
      }
    });
  }

  /** Applies a selection made on the map to the From/To dropdowns. */
  protected selectRoute(selection: RouteSelection): void {
    this.form.patchValue({
      originCityId: selection.originId,
      destinationCityId: selection.destinationId,
    });
    this.form.controls.originCityId.markAsDirty();
    this.form.controls.destinationCityId.markAsDirty();
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
      originCityId: value.originCityId as number,
      destinationCityId: value.destinationCityId as number,
      departureDate: value.departureDate,
      travelers: value.travelers,
      priority: value.priority,
      notes: notes === '' ? null : notes,
    });
  }

  /** The message to show under a field, once the user has touched it. */
  protected errorFor(field: FieldName): string | null {
    const control = this.form.controls[field];
    if (!control.touched) {
      return null;
    }
    if (control.errors) {
      const [key, value] = Object.entries(control.errors)[0];
      return key === 'server' ? capitalize(String(value)) : (MESSAGES[key] ?? 'Invalid value.');
    }
    if (field === 'destinationCityId' && this.form.hasError('sameCity')) {
      return MESSAGES['sameCity'];
    }
    return null;
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

function differentCities(group: AbstractControl): ValidationErrors | null {
  const origin = group.get('originCityId')?.value as number | null;
  const destination = group.get('destinationCityId')?.value as number | null;
  return origin !== null && origin === destination ? { sameCity: true } : null;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');
}

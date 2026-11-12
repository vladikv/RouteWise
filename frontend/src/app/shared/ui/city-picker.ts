import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { City } from '../../core/api/models';

let nextId = 0;

/** Lower case without accents, so "zur" finds Zürich and "krak" finds Kraków. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Searchable city field: an ARIA 1.2 combobox with a list box. Type to filter,
 * arrows to move, Enter to choose, Escape to close. The city chosen for the
 * other end of the route is shown but cannot be chosen again.
 */
@Component({
  selector: 'app-city-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label class="picker__label" [for]="inputId()">{{ label() }}</label>
    <div class="picker" [class.picker--open]="open()">
      <span class="picker__pin" aria-hidden="true">{{ pin() }}</span>
      <input
        #field
        [id]="inputId()"
        type="text"
        role="combobox"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        [attr.aria-describedby]="describedBy()"
        autocomplete="off"
        spellcheck="false"
        aria-autocomplete="list"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="activeOptionId()"
        [placeholder]="placeholder()"
        [value]="displayText()"
        (input)="onInput(field.value)"
        (focus)="onFocus()"
        (blur)="close()"
        (keydown)="onKey($event)"
      />
      @if (selected()) {
        <button
          type="button"
          class="picker__clear"
          [attr.aria-label]="'Clear ' + label()"
          (mousedown)="$event.preventDefault()"
          (click)="choose(null)"
        >
          ×
        </button>
      }
      @if (open()) {
        <ul class="picker__list" role="listbox" [id]="listId" [attr.aria-label]="label()">
          @for (city of options(); track city.id; let i = $index) {
            <!-- Options are not focusable on purpose: the input keeps focus and moves
                 aria-activedescendant (ARIA combobox pattern), so keys are handled there. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              role="option"
              [id]="optionId(i)"
              [class.picker__option--active]="i === activeIndex()"
              [attr.aria-selected]="city.id === value()"
              [attr.aria-disabled]="city.id === excludeId()"
              (mousedown)="$event.preventDefault()"
              (click)="chooseOption(city)"
              (mouseenter)="activeIndex.set(i)"
            >
              <span class="picker__name">{{ city.name }}</span>
              <span class="picker__meta">
                {{ city.id === excludeId() ? 'already chosen' : city.country }}
              </span>
            </li>
          } @empty {
            <li class="picker__empty" role="option" aria-disabled="true" aria-selected="false">
              No matching city
            </li>
          }
        </ul>
      }
    </div>
  `,
  styleUrl: './city-picker.scss',
})
export class CityPicker {
  readonly label = input.required<string>();
  readonly cities = input.required<City[]>();
  readonly value = input<number | null>(null);
  /** The other end of the route; listed but not selectable. */
  readonly excludeId = input<number | null>(null);
  readonly placeholder = input('Search a city');
  /** Letter shown in the field, matching the map pins ("A" / "B"). */
  readonly pin = input('');
  /** Id of the text field, e.g. for a form that refers to it; generated if not given. */
  readonly id = input<string | null>(null);
  /** Marks the field as invalid (red border, aria-invalid). */
  readonly invalid = input(false);
  /** Ids of elements that describe the field, such as an error message. */
  readonly describedBy = input<string | null>(null);
  readonly valueChange = output<number | null>();

  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');

  private readonly generatedId = `city-picker-${nextId}`;
  protected readonly inputId = computed(() => this.id() ?? this.generatedId);
  protected readonly listId = `city-picker-list-${nextId++}`;
  protected readonly open = signal(false);
  /** What the user typed; null while the field just shows the chosen city. */
  protected readonly query = signal<string | null>(null);
  protected readonly activeIndex = signal(0);

  protected readonly selected = computed(() =>
    this.cities().find((city) => city.id === this.value()),
  );
  protected readonly displayText = computed(() => this.query() ?? this.selected()?.name ?? '');

  protected readonly options = computed(() => {
    const query = normalize(this.query() ?? '').trim();
    const matches = this.cities().filter(
      (city) => !query || normalize(`${city.name} ${city.country}`).includes(query),
    );
    // Names that start with the query first, then the rest alphabetically.
    return matches.sort(
      (a, b) =>
        Number(!normalize(a.name).startsWith(query)) -
          Number(!normalize(b.name).startsWith(query)) || a.name.localeCompare(b.name),
    );
  });

  protected readonly activeOptionId = computed(() =>
    this.open() && this.options().length > 0 ? this.optionId(this.activeIndex()) : null,
  );

  protected optionId(index: number): string {
    return `${this.listId}-${index}`;
  }

  protected onFocus(): void {
    this.field().nativeElement.select();
  }

  protected onInput(text: string): void {
    this.query.set(text);
    this.activeIndex.set(0);
    this.open.set(true);
  }

  protected onKey(event: KeyboardEvent): void {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!this.open()) {
          this.openList();
        } else if (count > 0) {
          this.activeIndex.update((i) => (i + 1) % count);
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (!this.open()) {
          this.openList();
        } else if (count > 0) {
          this.activeIndex.update((i) => (i - 1 + count) % count);
        }
        break;
      case 'Enter':
        if (this.open()) {
          event.preventDefault();
          const city = this.options()[this.activeIndex()];
          if (city) {
            this.chooseOption(city);
          }
        }
        break;
      case 'Escape':
        if (this.open() || this.query() !== null) {
          event.preventDefault();
          this.close();
        }
        break;
    }
  }

  protected chooseOption(city: City): void {
    if (city.id !== this.excludeId()) {
      this.choose(city.id);
    }
  }

  protected choose(id: number | null): void {
    this.valueChange.emit(id);
    this.query.set(null);
    this.open.set(false);
    if (id === null) {
      this.field().nativeElement.focus();
    }
  }

  /** Closes the list and shows the chosen city again, discarding unfinished typing. */
  protected close(): void {
    this.open.set(false);
    this.query.set(null);
  }

  private openList(): void {
    const selectedIndex = this.options().findIndex((city) => city.id === this.value());
    this.activeIndex.set(Math.max(selectedIndex, 0));
    this.open.set(true);
  }
}

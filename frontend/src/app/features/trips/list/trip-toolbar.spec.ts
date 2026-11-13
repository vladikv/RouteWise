import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SearchFocus } from '../../../shared/util/search-focus';
import { TripToolbar } from './trip-toolbar';

/** Fakes `matchMedia` for a viewport width (the `min-width` queries of `LayoutBreakpoint`). */
function stubViewport(width: number): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: width >= Number(/min-width:\s*(\d+)px/.exec(query)?.[1]),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('TripToolbar', () => {
  let fixture: ComponentFixture<TripToolbar>;
  let toolbar: HTMLElement;

  async function create(width: number): Promise<void> {
    stubViewport(width);
    await TestBed.configureTestingModule({
      imports: [TripToolbar],
      providers: [provideRouter([{ path: 'trips', children: [] }])],
    }).compileComponents();
    fixture = TestBed.createComponent(TripToolbar);
    toolbar = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('view', 'list');
    fixture.componentRef.setInput('priorityCounts', {
      FASTEST: 2,
      CHEAPEST: 0,
      GREENEST: 1,
      BALANCED: 1,
    });
    fixture.componentRef.setInput('modeCounts', { TRAIN: 3, BUS: 1, CAR: 0, BIKE: 0, PLANE: 0 });
    fixture.componentRef.setInput('total', 4);
    fixture.componentRef.setInput('shown', 4);
    await settle();
  }

  afterEach(() => vi.unstubAllGlobals());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function set(name: string, value: unknown): Promise<void> {
    fixture.componentRef.setInput(name, value);
    await settle();
  }

  function group(label: string): HTMLElement {
    const found = Array.from(toolbar.querySelectorAll<HTMLElement>('[role="group"]')).find(
      (element) => element.textContent?.trim().startsWith(label),
    );
    if (!found) {
      throw new Error(`No group "${label}"`);
    }
    return found;
  }

  function chips(root: ParentNode): string[] {
    return Array.from(root.querySelectorAll('.chip')).map(
      (chip) => chip.getAttribute('aria-label') ?? '',
    );
  }

  function buttonByText(text: string): HTMLButtonElement {
    const found = Array.from(toolbar.querySelectorAll('button')).find((button) =>
      button.textContent?.includes(text),
    );
    if (!found) {
      throw new Error(`No button "${text}"`);
    }
    return found;
  }

  const status = () => toolbar.querySelector('[role="status"]')!.textContent?.trim();

  describe('on a wide screen', () => {
    beforeEach(() => create(1280));

    it('takes focus in the search field when the search shortcut asks for it', async () => {
      const searchFocus = TestBed.inject(SearchFocus);
      await TestBed.inject(Router).navigateByUrl('/trips');

      searchFocus.open();

      await vi.waitFor(async () => {
        await fixture.whenStable();
        expect(document.activeElement).toBe(toolbar.querySelector('input[type="search"]'));
      });
      expect(searchFocus.pending()).toBe(false);
    });

    it('shows two labelled groups with the counts from the full list', () => {
      expect(chips(group('Priority'))).toEqual([
        'Fastest, 2 trips',
        'Cheapest, 0 trips',
        'Greenest, 1 trip',
        'Balanced, 1 trip',
      ]);
      expect(chips(group('Mode'))).toEqual([
        'Train, 3 trips',
        'Bus, 1 trip',
        'Car, 0 trips',
        'Bike, 0 trips',
        'Plane, 0 trips',
      ]);
      expect(group('Mode').querySelectorAll('app-mode-icon')).toHaveLength(5);
      expect(group('Priority').querySelector('.count')?.textContent).toBe('2');
      expect(toolbar.querySelector('.filters-button')).toBeNull();
    });

    it('shows the result count in a polite status region', async () => {
      expect(toolbar.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
      expect(status()).toBe('4 of 4 trips');

      await set('shown', 3);
      expect(status()).toBe('3 of 4 trips');
    });

    it('offers Clear filters only while a search or a chip is active', async () => {
      expect(toolbar.textContent).not.toContain('Clear filters');

      group('Mode').querySelector<HTMLButtonElement>('.chip')!.click();
      await settle();
      expect(buttonByText('Clear filters')).toBeDefined();
      expect(group('Mode').querySelector('.chip')?.getAttribute('aria-pressed')).toBe('true');
    });

    it('clears the search and every chip', async () => {
      const input = toolbar.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = 'paris';
      input.dispatchEvent(new Event('input'));
      group('Priority').querySelector<HTMLButtonElement>('.chip')!.click();
      group('Mode').querySelector<HTMLButtonElement>('.chip')!.click();
      await settle();
      expect(fixture.componentInstance.search()).toBe('paris');
      expect(fixture.componentInstance.priorities()).toEqual(['FASTEST']);
      expect(fixture.componentInstance.modes()).toEqual(['TRAIN']);

      buttonByText('Clear filters').click();
      await settle();

      expect(fixture.componentInstance.search()).toBe('');
      expect(fixture.componentInstance.priorities()).toEqual([]);
      expect(fixture.componentInstance.modes()).toEqual([]);
      expect(input.value).toBe('');
      expect(toolbar.textContent).not.toContain('Clear filters');
    });

    it('shows Clear filters for a search alone', async () => {
      await set('search', 'rome');

      expect(buttonByText('Clear filters')).toBeDefined();
    });
  });

  describe('on a phone', () => {
    beforeEach(() => create(375));

    it('replaces the groups with a Filters button', () => {
      expect(toolbar.querySelector('app-filter-group')).toBeNull();
      expect(buttonByText('Filters').getAttribute('aria-haspopup')).toBe('dialog');
      expect(toolbar.querySelector('.filters-button__count')).toBeNull();
    });

    it('badges the Filters button with the number of selected chips', async () => {
      await set('priorities', ['FASTEST']);
      await set('modes', ['BUS', 'CAR']);

      expect(buttonByText('Filters').querySelector('.filters-button__count')?.textContent).toBe(
        '3',
      );
      expect(buttonByText('Filters').textContent).toContain('(3 active)');
    });

    it('opens the sheet with both groups, moves focus in and closes with the Show button', async () => {
      await set('shown', 2);
      const opener = buttonByText('Filters');
      opener.focus();
      opener.click();
      await settle();

      expect(toolbar.querySelector('app-bottom-sheet')).not.toBeNull();
      expect(document.activeElement?.textContent).toBe('Filters');
      expect(document.activeElement?.tagName).toBe('H2');
      expect(chips(group('Priority'))).toHaveLength(4);
      expect(chips(group('Mode'))).toHaveLength(5);

      buttonByText('Show 2 trips').click();
      await settle();

      expect(toolbar.querySelector('app-bottom-sheet')).toBeNull();
      expect(document.activeElement).toBe(buttonByText('Filters'));
    });

    it('filters from inside the sheet and clears from there', async () => {
      buttonByText('Filters').click();
      await settle();

      group('Mode').querySelector<HTMLButtonElement>('.chip')!.click();
      await settle();
      expect(fixture.componentInstance.modes()).toEqual(['TRAIN']);

      const clear = Array.from(
        toolbar.querySelector('app-bottom-sheet')!.querySelectorAll('button'),
      ).find((button) => button.textContent?.includes('Clear filters'))!;
      clear.click();
      await settle();
      expect(fixture.componentInstance.modes()).toEqual([]);
    });

    it('closes the sheet with Escape and returns focus to the Filters button', async () => {
      buttonByText('Filters').click();
      await settle();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await settle();

      expect(toolbar.querySelector('app-bottom-sheet')).toBeNull();
      expect(document.activeElement).toBe(buttonByText('Filters'));
    });

    it('closes the sheet when the scrim is tapped', async () => {
      buttonByText('Filters').click();
      await settle();

      toolbar.querySelector<HTMLElement>('.scrim')!.click();
      await settle();

      expect(toolbar.querySelector('app-bottom-sheet')).toBeNull();
    });
  });
});

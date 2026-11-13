import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { COMPARISON, MULTI_COMPARISON } from '../comparison/comparison.testing';
import { TRIP } from '../trip-form.testing';
import { SOLO_TRIP, pageOf } from '../trip-list.testing';
import { tripEntries } from './trip-figures';
import { RowDetail } from './trip-row-details';
import { TripMove } from './trip-move';
import { TripTable } from './trip-table';

const THIRD: Trip = { ...SOLO_TRIP, id: 9, title: 'Third trip' };

@Component({
  imports: [TripTable],
  template: `
    <app-trip-table
      [entries]="entries"
      [details]="details()"
      [(expandedId)]="expandedId"
      (deleteRequested)="deleteRequests.push($event.id)"
      (detailRetry)="retries.push($event.id)"
      (moved)="moves.push($event)"
    />
  `,
})
class Host {
  readonly entries = tripEntries(pageOf([TRIP, SOLO_TRIP, THIRD]));
  readonly details = signal<ReadonlyMap<number, RowDetail>>(new Map());
  readonly expandedId = signal<number | null>(null);
  readonly deleteRequests: number[] = [];
  readonly retries: number[] = [];
  readonly moves: TripMove[] = [];
}

describe('TripTable', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'trips/:id', children: [] }])],
    });
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    document.body.append(root); // focus only works on attached elements
    await settle();
  });

  afterEach(() => root.remove());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const rows = () => Array.from(root.querySelectorAll<HTMLElement>('tbody tr.row'));
  const toggle = (index: number) => rows()[index].querySelector<HTMLButtonElement>('.toggle')!;
  const detailRow = () => root.querySelector('tr.detail');

  function press(target: Element, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
  }

  describe('keyboard', () => {
    const stops = () => rows().map((row) => row.querySelector('.toggle')!.getAttribute('tabindex'));

    it('is one tab stop: the first row toggle, with the other rows and their controls out of the Tab order', () => {
      expect(stops()).toEqual(['0', '-1', '-1']);
      expect(rows()[0].hasAttribute('tabindex')).toBe(false);
      expect(rows()[0].querySelector('.trip__name a')?.hasAttribute('tabindex')).toBe(false);
      for (const row of rows().slice(1)) {
        for (const control of Array.from(row.querySelectorAll('a[href], button, select'))) {
          expect(control.getAttribute('tabindex')).toBe('-1');
        }
      }
    });

    it('moves between the row toggles with ArrowDown and ArrowUp and stops at the ends', async () => {
      toggle(0).focus();

      expect(press(toggle(0), 'ArrowDown').defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(toggle(1));
      press(toggle(1), 'ArrowDown');
      press(toggle(2), 'ArrowDown');
      expect(document.activeElement).toBe(toggle(2));
      press(toggle(2), 'ArrowUp');
      expect(document.activeElement).toBe(toggle(1));
      press(toggle(1), 'ArrowUp');
      press(toggle(0), 'ArrowUp');
      expect(document.activeElement).toBe(toggle(0));
      await settle();
    });

    it('jumps to the first and last row with Home and End and makes that toggle the tab stop', async () => {
      toggle(1).focus();
      await settle();

      press(toggle(1), 'End');
      await settle();
      expect(document.activeElement).toBe(toggle(2));
      expect(stops()).toEqual(['-1', '-1', '0']);
      expect(rows()[2].querySelector('.trip__name a')?.hasAttribute('tabindex')).toBe(false);
      expect(rows()[0].querySelector('.trip__name a')?.getAttribute('tabindex')).toBe('-1');

      press(toggle(2), 'Home');
      await settle();
      expect(document.activeElement).toBe(toggle(0));
      expect(stops()).toEqual(['0', '-1', '-1']);
    });

    it('also moves from the title link', () => {
      const link = rows()[0].querySelector<HTMLElement>('.trip__name a')!;
      link.focus();
      press(link, 'ArrowDown');
      expect(document.activeElement).toBe(toggle(1));
    });

    it('leaves the arrow keys alone inside a select', () => {
      const select = rows()[0].querySelector('select')!;
      select.focus();

      expect(press(select, 'ArrowDown').defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(select);
    });

    it('expands with the toggle button (a click, as Enter and Space give) and collapses again, with aria-expanded', async () => {
      toggle(1).click();
      await settle();

      expect(fixture.componentInstance.expandedId()).toBe(8);
      expect(toggle(1).getAttribute('aria-expanded')).toBe('true');
      expect(toggle(1).getAttribute('aria-controls')).toBe('trip-detail-8');
      expect(detailRow()?.id).toBe('trip-detail-8');

      toggle(1).click();
      await settle();
      expect(fixture.componentInstance.expandedId()).toBeNull();
      expect(toggle(1).getAttribute('aria-expanded')).toBe('false');
      expect(detailRow()).toBeNull();
    });

    it('does not handle Enter on the title link itself', async () => {
      const link = rows()[0].querySelector<HTMLElement>('.trip__name a')!;
      expect(press(link, 'Enter').defaultPrevented).toBe(false);
      await settle();
      expect(fixture.componentInstance.expandedId()).toBeNull();
    });

    it('collapses with Escape and keeps focus on the toggle, also from inside the details', async () => {
      toggle(0).focus();
      toggle(0).click();
      await settle();

      press(toggle(0), 'Escape');
      await settle();
      expect(fixture.componentInstance.expandedId()).toBeNull();
      expect(document.activeElement).toBe(toggle(0));

      toggle(0).click();
      await settle();
      const inside = detailRow()!.querySelector<HTMLElement>('a')!;
      inside.focus();
      press(inside, 'Escape');
      await settle();
      expect(fixture.componentInstance.expandedId()).toBeNull();
      expect(document.activeElement).toBe(toggle(0));
    });

    it('lets Escape close an open actions menu first instead of collapsing the row', async () => {
      toggle(0).click();
      await settle();
      const trigger = rows()[0].querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!;
      trigger.click();
      await settle();

      press(rows()[0].querySelector('.menu-panel a')!, 'Escape');
      await settle();

      expect(fixture.componentInstance.expandedId()).toBe(7);
    });

    it('makes a row the tab stop when focus enters one of its controls', async () => {
      rows()[2].querySelector<HTMLElement>('.trip__name a')!.focus();
      await settle();

      expect(stops()).toEqual(['-1', '-1', '0']);
    });
  });

  describe('expanding', () => {
    it('expands on a click on the row, but not on a click on a link, button or select inside it', async () => {
      rows()[0].querySelector<HTMLElement>('td.trip__date')!.click();
      await settle();
      expect(fixture.componentInstance.expandedId()).toBe(7);

      rows()[1]
        .querySelector<HTMLElement>('.trip__name a')!
        .addEventListener('click', (e) => {
          e.preventDefault();
        });
      rows()[1].querySelector<HTMLElement>('.trip__name a')!.click();
      rows()[1].querySelector('select')!.click();
      rows()[1].querySelector<HTMLElement>('button[aria-label^="Delete"]')!.click();
      await settle();
      expect(fixture.componentInstance.expandedId()).toBe(7);
    });

    it('does not expand on a click inside the priority select or an open menu panel', async () => {
      rows()[0].querySelector<HTMLElement>('app-trip-priority-select .picker')!.click();
      rows()[1].querySelector<HTMLButtonElement>('button[aria-label^="Actions"]')!.click();
      await settle();
      rows()[1].querySelector<HTMLElement>('.menu-panel')!.click();
      await settle();

      expect(fixture.componentInstance.expandedId()).toBeNull();
    });

    it('marks an expanded row, whose quick actions the styles hide (the details have their own buttons)', async () => {
      toggle(0).click();
      await settle();

      expect(rows()[0].classList.contains('row--expanded')).toBe(true);
      expect(rows()[0].querySelector('app-trip-actions')).not.toBeNull();
    });

    it('expands with the disclosure button, one row at a time', async () => {
      toggle(0).click();
      await settle();
      toggle(1).click();
      await settle();

      expect(fixture.componentInstance.expandedId()).toBe(8);
      expect(root.querySelectorAll('tr.detail')).toHaveLength(1);
      expect(toggle(0).getAttribute('aria-expanded')).toBe('false');
    });

    it('shows the passed comparison in the detail row with Open on map, Edit and Delete', async () => {
      fixture.componentInstance.details.set(
        new Map<number, RowDetail>([[7, { status: 'ready', comparison: COMPARISON }]]),
      );
      toggle(0).click();
      await settle();

      const detail = detailRow()!;
      expect(detail.textContent).toContain('Berlin');
      expect(detail.textContent).toContain('Vienna');
      expect(detail.textContent).toContain('Train');
      expect(detail.textContent).toContain('6 h 13 min');
      expect(detail.textContent).toContain('€151');
      expect(detail.textContent).toContain('44 kg');
      expect(detail.textContent).toContain('Rain');
      expect(detail.textContent).toContain('Vienna: Rain, 4 to 9 °C');
      expect(detail.textContent).not.toMatch(/\s,/);
      const links = Array.from(detail.querySelectorAll('a')).map((link) => [
        link.textContent?.trim(),
        link.getAttribute('href'),
      ]);
      expect(links).toEqual([
        ['Open on map', '/trips/7'],
        ['Edit', '/trips/7/edit'],
      ]);

      Array.from(detail.querySelectorAll('button'))
        .find((button) => button.textContent?.includes('Delete'))!
        .click();
      expect(fixture.componentInstance.deleteRequests).toEqual([7]);
    });

    it('lists every leg of a multi-stop trip with its recommended mode, and says when there is no forecast', async () => {
      fixture.componentInstance.details.set(
        new Map<number, RowDetail>([[7, { status: 'ready', comparison: MULTI_COMPARISON }]]),
      );
      toggle(0).click();
      await settle();

      const legs = Array.from(detailRow()!.querySelectorAll('.leg'));
      expect(legs).toHaveLength(2);
      expect(legs[0].textContent).toContain('Berlin');
      expect(legs[0].textContent).toContain('Prague');
      expect(legs[0].textContent).toContain('Train');
      expect(legs[0].textContent).toContain('4 h');
      expect(legs[1].textContent).toContain('Bus');
      expect(detailRow()!.textContent).toContain('No forecast for this date yet.');
    });

    it('shows loading, then an error with a retry that asks the page again', async () => {
      toggle(0).click();
      await settle();
      expect(detailRow()?.querySelector('[role="status"]')?.textContent).toContain('Loading');

      fixture.componentInstance.details.set(
        new Map<number, RowDetail>([[7, { status: 'error', error: new Error('boom') }]]),
      );
      await settle();
      expect(detailRow()?.querySelector('[role="alert"]')).not.toBeNull();

      detailRow()!.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
      expect(fixture.componentInstance.retries).toEqual([7]);
    });
  });

  describe('priority', () => {
    it('has a labelled select per row that reports the chosen priority and keeps the shown one until the page applies it', async () => {
      const select = rows()[0].querySelector<HTMLSelectElement>('select')!;
      expect(select.getAttribute('aria-label')).toBe('Priority of Berlin to Vienna');
      expect(select.value).toBe('GREENEST');
      expect(Array.from(select.options).map((option) => option.textContent?.trim())).toEqual([
        'Fastest',
        'Cheapest',
        'Greenest',
        'Balanced',
      ]);

      select.value = 'CHEAPEST';
      select.dispatchEvent(new Event('change'));
      await settle();

      expect(fixture.componentInstance.moves).toEqual([
        { trip: TRIP, priority: 'CHEAPEST', focus: false },
      ]);
      expect(select.value).toBe('GREENEST');
    });
  });
});

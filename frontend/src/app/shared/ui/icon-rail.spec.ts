import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { IconRail, RailItem } from './icon-rail';

const ITEMS: RailItem[] = [
  { label: 'Search trips', icon: 'M0 0' },
  { label: 'New trip', icon: 'M1 1', link: '/trips/new' },
  { label: 'Trips', icon: 'M2 2', link: '/trips' },
];

describe('IconRail', () => {
  let fixture: ComponentFixture<IconRail>;
  let rail: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IconRail],
      providers: [
        provideRouter([
          { path: 'trips', children: [] },
          { path: 'trips/new', children: [] },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(IconRail);
    rail = fixture.nativeElement as HTMLElement;
    fixture.componentRef.setInput('items', ITEMS);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const control = (label: string) => rail.querySelector(`[aria-label="${label}"]`) as HTMLElement;

  it('is a labelled navigation with a named control per item', () => {
    expect(rail.querySelector('nav')?.getAttribute('aria-label')).toBe('Quick access');
    for (const item of ITEMS) {
      expect(control(item.label).getAttribute('title')).toBe(item.label);
      expect(control(item.label).textContent?.trim()).toBe('');
    }
    expect(rail.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(ITEMS.length);
  });

  it('makes linked items links and the others buttons', () => {
    expect(control('Search trips').tagName).toBe('BUTTON');
    expect(control('New trip').getAttribute('href')).toBe('/trips/new');
    expect(control('Trips').getAttribute('href')).toBe('/trips');
  });

  it('emits the item of a button when it is pressed', () => {
    const activated: RailItem[] = [];
    fixture.componentInstance.activate.subscribe((item) => activated.push(item));

    control('Search trips').click();

    expect(activated).toEqual([ITEMS[0]]);
  });

  it('marks only the current page with aria-current', async () => {
    await TestBed.inject(Router).navigateByUrl('/trips');
    await fixture.whenStable();
    expect(control('Trips').getAttribute('aria-current')).toBe('page');
    expect(control('New trip').hasAttribute('aria-current')).toBe(false);
    expect(control('Search trips').hasAttribute('aria-current')).toBe(false);

    await TestBed.inject(Router).navigateByUrl('/trips/new?from=1');
    await fixture.whenStable();
    expect(control('New trip').getAttribute('aria-current')).toBe('page');
    expect(control('Trips').hasAttribute('aria-current')).toBe(false);
  });
});

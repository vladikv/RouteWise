import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { COMPARISON, CONNECTING_COMPARISON } from '../comparison/comparison.testing';
import { TRIP } from '../trip-form.testing';
import { RowDetail, TripRowDetails } from './trip-row-details';

describe('TripRowDetails', () => {
  function render(detail: RowDetail): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(TripRowDetails);
    fixture.componentRef.setInput('trip', TRIP);
    fixture.componentRef.setInput('detail', detail);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const mode = (element: HTMLElement) =>
    element.querySelector('.facts dd')?.textContent?.replace(/\s+/g, ' ').trim();

  it('names the hub of a connecting recommended flight', () => {
    const element = render({ status: 'ready', comparison: CONNECTING_COMPARISON });

    expect(mode(element)).toBe('Plane via Hong Kong');
  });

  it('shows the plain mode name for a direct option', () => {
    const element = render({ status: 'ready', comparison: COMPARISON });

    expect(mode(element)).toBe('Train');
  });
});

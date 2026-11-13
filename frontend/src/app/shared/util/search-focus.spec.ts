import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SearchFocus } from './search-focus';

describe('SearchFocus', () => {
  function configure(guard?: () => boolean): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'trips', children: [], ...(guard ? { canActivate: [guard] } : {}) },
        ]),
      ],
    });
  }

  it('goes to the Trips page and leaves a request for its search field', async () => {
    configure();
    const searchFocus = TestBed.inject(SearchFocus);
    expect(searchFocus.pending()).toBe(false);

    searchFocus.open();

    await vi.waitFor(() => expect(searchFocus.pending()).toBe(true));
    expect(TestBed.inject(Router).url).toBe('/trips');
  });

  it('clears the request when it is consumed', async () => {
    configure();
    const searchFocus = TestBed.inject(SearchFocus);
    searchFocus.open();
    await vi.waitFor(() => expect(searchFocus.pending()).toBe(true));

    searchFocus.consume();

    expect(searchFocus.pending()).toBe(false);
  });

  it('leaves nothing pending when the navigation is refused', async () => {
    configure(() => false);
    const searchFocus = TestBed.inject(SearchFocus);
    const router = TestBed.inject(Router);

    searchFocus.open();
    await vi.waitFor(() => expect(router.getCurrentNavigation()).toBeNull());
    await Promise.resolve();

    expect(searchFocus.pending()).toBe(false);
  });
});

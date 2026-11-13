import { TestBed } from '@angular/core/testing';
import { MY_TRIPS_LAYER_STORAGE_KEY, MyTripsLayer } from './my-trips-layer';

describe('MyTripsLayer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is on by default', () => {
    expect(TestBed.inject(MyTripsLayer).visible()).toBe(true);
  });

  it('saves the choice and reads it back', () => {
    TestBed.inject(MyTripsLayer).set(false);

    expect(localStorage.getItem(MY_TRIPS_LAYER_STORAGE_KEY)).toBe('false');
    TestBed.resetTestingModule();
    expect(TestBed.inject(MyTripsLayer).visible()).toBe(false);
  });

  it('treats an invalid stored value as on', () => {
    localStorage.setItem(MY_TRIPS_LAYER_STORAGE_KEY, 'maybe');

    expect(TestBed.inject(MyTripsLayer).visible()).toBe(true);
  });

  it('is on when reading fails, and a failing write still changes this visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const layer = TestBed.inject(MyTripsLayer);

    expect(layer.visible()).toBe(true);
    layer.set(false);
    expect(layer.visible()).toBe(false);
  });
});

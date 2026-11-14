import { TestBed } from '@angular/core/testing';
import { IDLE_ROTATION_STORAGE_KEY, IdleRotationPreference } from './idle-rotation-preference';

describe('IdleRotationPreference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('is rotating by default and saves a pause', () => {
    const preference = TestBed.inject(IdleRotationPreference);
    expect(preference.paused()).toBe(false);

    preference.set(true);

    expect(localStorage.getItem(IDLE_ROTATION_STORAGE_KEY)).toBe('true');
    TestBed.resetTestingModule();
    expect(TestBed.inject(IdleRotationPreference).paused()).toBe(true);
  });

  it('is rotating for an invalid stored value or failing storage', () => {
    localStorage.setItem(IDLE_ROTATION_STORAGE_KEY, 'maybe');
    expect(TestBed.inject(IdleRotationPreference).paused()).toBe(false);

    TestBed.resetTestingModule();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const preference = TestBed.inject(IdleRotationPreference);
    expect(preference.paused()).toBe(false);
    preference.set(true);
    expect(preference.paused()).toBe(true);
  });
});

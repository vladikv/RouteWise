import { TestBed } from '@angular/core/testing';
import {
  AUTO_ROTATE_STORAGE_KEY,
  AutoRotatePreference,
  LEGACY_PAUSED_STORAGE_KEY,
} from './auto-rotate-preference';

describe('AutoRotatePreference', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('has no explicit choice by default', () => {
    expect(TestBed.inject(AutoRotatePreference).choice()).toBeNull();
  });

  it('saves an explicit choice in both directions and reads it back', () => {
    TestBed.inject(AutoRotatePreference).set(false);
    expect(localStorage.getItem(AUTO_ROTATE_STORAGE_KEY)).toBe('off');
    TestBed.resetTestingModule();
    expect(TestBed.inject(AutoRotatePreference).choice()).toBe(false);

    TestBed.inject(AutoRotatePreference).set(true);
    expect(localStorage.getItem(AUTO_ROTATE_STORAGE_KEY)).toBe('on');
    TestBed.resetTestingModule();
    expect(TestBed.inject(AutoRotatePreference).choice()).toBe(true);
  });

  it('treats an invalid stored value as no choice', () => {
    localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, 'maybe');

    expect(TestBed.inject(AutoRotatePreference).choice()).toBeNull();
  });

  it('reads an old "paused" flag as an explicit off, and the new key wins over it', () => {
    localStorage.setItem(LEGACY_PAUSED_STORAGE_KEY, 'true');
    expect(TestBed.inject(AutoRotatePreference).choice()).toBe(false);

    TestBed.resetTestingModule();
    localStorage.setItem(AUTO_ROTATE_STORAGE_KEY, 'on');
    expect(TestBed.inject(AutoRotatePreference).choice()).toBe(true);

    TestBed.resetTestingModule();
    localStorage.clear();
    localStorage.setItem(LEGACY_PAUSED_STORAGE_KEY, 'false');
    expect(TestBed.inject(AutoRotatePreference).choice()).toBeNull();
  });

  it('has no choice when reading fails, and a failing write still changes this visit', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    const preference = TestBed.inject(AutoRotatePreference);

    expect(preference.choice()).toBeNull();
    preference.set(true);
    expect(preference.choice()).toBe(true);
  });
});

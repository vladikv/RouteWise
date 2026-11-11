import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    TestBed.configureTestingModule({});
  });

  it('follows the system (light in tests) and sets no attribute until the user chooses', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('toggles, applies and remembers the choice', () => {
    const service = TestBed.inject(ThemeService);

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    TestBed.tick();

    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a stored choice and ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');

    TestBed.resetTestingModule();
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });
});

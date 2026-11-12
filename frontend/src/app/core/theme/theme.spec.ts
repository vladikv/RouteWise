import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme';

describe('ThemeService', () => {
  const original = window.matchMedia;
  let systemDark: boolean;
  let listeners: ((event: { matches: boolean }) => void)[];

  function setSystem(dark: boolean): void {
    systemDark = dark;
    listeners.forEach((listener) => listener({ matches: dark }));
  }

  function service(): ThemeService {
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    systemDark = false;
    listeners = [];
    window.matchMedia = vi.fn().mockImplementation(() => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
        listeners.push(listener),
    }));
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    window.matchMedia = original;
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('defaults to the system theme and applies it', () => {
    systemDark = true;

    expect(service().preference()).toBe('system');
    expect(service().resolved()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('restores a saved choice', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    systemDark = true;

    expect(service().preference()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('saves a choice and applies it', () => {
    service().set('dark');

    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('follows the system while the preference is system', () => {
    const theme = service();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    setSystem(true);
    expect(theme.resolved()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    setSystem(false);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('ignores system changes once a theme is chosen', () => {
    const theme = service();
    theme.set('light');

    setSystem(true);

    expect(theme.resolved()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('falls back to system for an invalid stored value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');

    expect(service().preference()).toBe('system');
  });

  it('survives storage that throws on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const theme = service();
    expect(theme.preference()).toBe('system');

    expect(() => theme.set('dark')).not.toThrow();
    expect(theme.preference()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('works without matchMedia', () => {
    window.matchMedia = undefined as never;

    expect(service().resolved()).toBe('light');
  });
});

import { TestBed } from '@angular/core/testing';
import { mockViewport } from '../../shared/util/viewport.testing';
import { HOME_LAYOUT_STORAGE_KEY, HomeLayout } from './home-layout';

describe('HomeLayout', () => {
  let viewport: ReturnType<typeof mockViewport> | undefined;
  const setViewport = (width: number) => (viewport = mockViewport(width));

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    viewport?.restore();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to Split', () => {
    setViewport(1920);
    const layout = TestBed.inject(HomeLayout);
    expect(layout.preference()).toBe('split');
    expect(layout.effective()).toBe('split');
  });

  it('restores a saved choice and saves a new one', () => {
    setViewport(1920);
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, 'map');
    const layout = TestBed.inject(HomeLayout);
    expect(layout.effective()).toBe('map');

    layout.set('split');
    expect(layout.effective()).toBe('split');
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('split');
  });

  it('ignores an invalid saved value', () => {
    setViewport(1920);
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, 'grid');
    expect(TestBed.inject(HomeLayout).preference()).toBe('split');
  });

  it('falls back to Split and keeps working when storage throws', () => {
    setViewport(1920);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const layout = TestBed.inject(HomeLayout);
    expect(layout.preference()).toBe('split');

    layout.set('map');
    expect(layout.preference()).toBe('map');
    expect(layout.effective()).toBe('map');
  });

  it('shows Split below 1440 px without overwriting the saved choice', () => {
    setViewport(1280);
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, 'map');
    const layout = TestBed.inject(HomeLayout);
    expect(layout.mapAvailable()).toBe(false);
    expect(layout.preference()).toBe('map');
    expect(layout.effective()).toBe('split');
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('map');
  });

  it('follows viewport changes live and returns to Map when there is room again', () => {
    const viewport = setViewport(1920);
    localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, 'map');
    const layout = TestBed.inject(HomeLayout);
    expect(layout.effective()).toBe('map');

    viewport.resize(1200);
    expect(layout.effective()).toBe('split');
    expect(layout.mapAvailable()).toBe(false);

    viewport.resize(1600);
    expect(layout.effective()).toBe('map');
  });

  it('tells whether Split has room for two columns', () => {
    const viewport = setViewport(1280);
    const layout = TestBed.inject(HomeLayout);
    expect(layout.sideBySide()).toBe(true);

    viewport.resize(900);
    expect(layout.sideBySide()).toBe(false);
  });

  it('is Split without matchMedia and stops listening when destroyed', () => {
    expect(TestBed.inject(HomeLayout).effective()).toBe('split');
    TestBed.resetTestingModule();

    const viewport = setViewport(1920);
    TestBed.inject(HomeLayout);
    expect(viewport.listenerCount()).toBe(2);
    TestBed.resetTestingModule();
    expect(viewport.listenerCount()).toBe(0);
  });
});

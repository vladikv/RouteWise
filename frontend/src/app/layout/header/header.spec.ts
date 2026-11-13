import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { AuthApi } from '../../core/api/auth-api';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { HOME_LAYOUT_STORAGE_KEY, HomeLayout } from '../../features/explore/home-layout';
import { TripStats } from '../../core/api/models';
import { mockViewport } from '../../shared/util/viewport.testing';
import { SearchFocus } from '../../shared/util/search-focus';
import { Header } from './header';

const STATS_URL = 'http://api.test/api/trips/stats';
const STATS: TripStats = {
  tripsPlanned: 4,
  co2SavedVsCarKg: 123.4,
  co2TripsCounted: 3,
  tripsLeftOut: 1,
  averageCost: 80,
  currency: 'EUR',
  nextTrip: null,
};

describe('Header', () => {
  let fixture: ComponentFixture<Header>;
  let header: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'trips', children: [] },
          { path: 'modes', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    header = fixture.nativeElement as HTMLElement;
  });

  function logInAsAlice(): void {
    vi.spyOn(TestBed.inject(AuthApi), 'login').mockReturnValue(of(ALICE));
    TestBed.inject(Session).login({ email: ALICE.email, password: 'x' }).subscribe();
  }

  function buttonNamed(name: string): HTMLButtonElement | undefined {
    return Array.from(header.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === name,
    );
  }

  function button(label: string): HTMLButtonElement {
    return header.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
  }

  /** Renders and lets effects and microtasks run, without waiting for stats requests left open. */
  async function render(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  }

  function linkHrefs(root: ParentNode): (string | null)[] {
    return Array.from(root.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));
  }

  it('offers the main links and a login link when logged out', async () => {
    await render();

    const nav = header.querySelector('nav[aria-label="Main"]')!;
    expect(linkHrefs(nav)).toEqual(['/', '/trips', '/modes']);
    const link = Array.from(header.querySelectorAll('a')).find(
      (anchor) => anchor.textContent?.trim() === 'Log in',
    );
    expect(link?.getAttribute('href')).toBe('/login');
    expect(button('Account menu')).toBeNull();
  });

  it('shows an avatar with initials when logged in', async () => {
    logInAsAlice();
    await render();

    const avatar = button('Account menu');
    expect(avatar.textContent?.trim()).toBe('A');
    expect(avatar.getAttribute('aria-expanded')).toBe('false');
    expect(header.textContent).not.toContain('Log in');
  });

  it('opens the account menu, closes it with Escape and returns focus', async () => {
    logInAsAlice();
    await render();
    const avatar = button('Account menu');

    avatar.click();
    await render();
    expect(avatar.getAttribute('aria-expanded')).toBe('true');
    const menu = header.querySelector('#account-menu')!;
    expect(avatar.getAttribute('aria-controls')).toBe('account-menu');
    expect(menu.textContent).toContain('Alice');
    expect(buttonNamed('Log out')).toBeDefined();

    const other = document.createElement('button');
    document.body.append(other);
    other.focus();
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();

    expect(header.querySelector('#account-menu')).toBeNull();
    expect(avatar.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(avatar);
    other.remove();
  });

  describe('account popover', () => {
    const panel = () => header.querySelector('#account-menu app-account-panel') as HTMLElement;

    it('does not ask for stats until the popover opens', async () => {
      logInAsAlice();
      await render();

      TestBed.inject(HttpTestingController).expectNone(STATS_URL);
    });

    it('shows avatar initials, name, email and the stats once they load, and moves focus in', async () => {
      logInAsAlice();
      await render();
      document.body.append(header);

      button('Account menu').click();
      await render();
      expect(panel().textContent).toContain('Loading your stats');
      TestBed.inject(HttpTestingController).expectOne(STATS_URL).flush(STATS);
      await fixture.whenStable();

      expect(panel().textContent).toContain('Alice');
      expect(panel().textContent).toContain('alice@example.com');
      expect(panel().querySelector('.who__avatar')?.textContent?.trim()).toBe('A');
      expect(panel().querySelector('dl')?.textContent).toContain('Trips planned');
      expect(panel().querySelector('dl')?.textContent).toContain('4');
      expect(panel().querySelector('dl')?.textContent).toContain('123 kg');
      expect(panel().querySelector('a[href="/trips"]')?.textContent).toContain('My trips');
      expect(document.activeElement).toBe(panel().querySelector('a[href="/trips"]'));
      header.remove();
    });

    it('asks again on every opening', async () => {
      logInAsAlice();
      await render();
      const http = TestBed.inject(HttpTestingController);

      button('Account menu').click();
      await render();
      http.expectOne(STATS_URL).flush(STATS);
      await fixture.whenStable();
      header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await render();

      button('Account menu').click();
      await render();

      http.expectOne(STATS_URL).flush({ ...STATS, tripsPlanned: 5 });
      await fixture.whenStable();
      expect(panel().querySelector('dl')?.textContent).toContain('5');
    });

    it('keeps the links and Log out when the stats fail', async () => {
      logInAsAlice();
      await render();

      button('Account menu').click();
      await render();
      TestBed.inject(HttpTestingController).expectOne(STATS_URL).error(new ProgressEvent('error'));
      await fixture.whenStable();

      expect(panel().textContent).toContain('Your stats are not available right now.');
      expect(panel().querySelector('dl')).toBeNull();
      expect(panel().querySelector('a[href="/trips"]')).not.toBeNull();
      expect(buttonNamed('Log out')).toBeDefined();
    });

    it('shows the same account section in the phone menu and loads its stats on open', async () => {
      logInAsAlice();
      await render();

      button('Menu').click();
      await render();
      TestBed.inject(HttpTestingController).expectOne(STATS_URL).flush(STATS);
      await fixture.whenStable();

      const section = header.querySelector('#nav-menu app-account-panel')!;
      expect(section.textContent).toContain('alice@example.com');
      expect(section.querySelector('dl')?.textContent).toContain('4');
      expect(section.querySelector('a[href="/trips"]')).not.toBeNull();
    });
  });

  it('closes the account menu on a click outside', async () => {
    logInAsAlice();
    await render();
    button('Account menu').click();
    await render();

    document.body.click();
    await render();

    expect(header.querySelector('#account-menu')).toBeNull();
  });

  it('logs out through the session', async () => {
    logInAsAlice();
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await render();

    button('Account menu').click();
    await render();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(STATS_URL).flush(STATS);
    buttonNamed('Log out')?.click();
    http.expectOne({ method: 'POST', url: 'http://api.test/api/auth/logout' }).flush(null);
    await fixture.whenStable();

    expect(TestBed.inject(Session).loggedIn()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/');
    expect(header.textContent).toContain('Log in');
    expect(header.querySelector('#account-menu')).toBeNull();
  });

  it('toggles the mobile menu with the links inside', async () => {
    await render();
    const toggle = button('Menu');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('nav-menu');
    expect(header.querySelector('#nav-menu')).toBeNull();

    toggle.click();
    await render();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const panel = header.querySelector('#nav-menu')!;
    expect(linkHrefs(panel)).toEqual(['/', '/trips', '/modes', '/login']);

    toggle.click();
    await render();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(header.querySelector('#nav-menu')).toBeNull();
  });

  it('closes the mobile menu with Escape and when a link is followed', async () => {
    await render();
    const toggle = button('Menu');

    toggle.click();
    await render();
    header.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await render();
    expect(header.querySelector('#nav-menu')).toBeNull();
    expect(document.activeElement).toBe(toggle);

    toggle.click();
    await render();
    header.querySelector<HTMLAnchorElement>('#nav-menu a[href="/trips"]')!.click();
    await render();
    expect(header.querySelector('#nav-menu')).toBeNull();
  });

  it('puts the account actions in the mobile menu when logged in', async () => {
    logInAsAlice();
    await render();

    button('Menu').click();
    await render();

    const panel = header.querySelector('#nav-menu')!;
    expect(panel.textContent).toContain('Alice');
    expect(Array.from(panel.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Log out',
    ]);
  });

  it('puts the logo group, the navigation and the actions in three columns', async () => {
    await render();

    const columns = Array.from(header.querySelector('.header__inner')!.children);
    expect(columns.map((column) => column.className.split(' ')[0])).toEqual([
      'header__start',
      'header__nav',
      'header__actions',
    ]);
    expect(columns[0].querySelector('a.brand')).not.toBeNull();
    expect(columns[1].querySelector('nav[aria-label="Main"]')).not.toBeNull();
    expect(columns[2].querySelector('.avatar, .login')).not.toBeNull();
  });

  it('has round search and new-trip buttons and no theme menu', async () => {
    await render();

    expect(button('Search trips')).not.toBeNull();
    expect(header.querySelector('a[aria-label="New trip"]')?.getAttribute('href')).toBe(
      '/trips/new',
    );
    expect(header.querySelector('[aria-label^="Theme"]')).toBeNull();
  });

  it('asks the trips page to focus its search field', async () => {
    const open = vi.spyOn(TestBed.inject(SearchFocus), 'open').mockImplementation(() => undefined);
    await render();

    button('Search trips').click();

    expect(open).toHaveBeenCalledOnce();
  });
});

describe('Header layout toggle', () => {
  let viewport: ReturnType<typeof mockViewport>;
  let fixture: ComponentFixture<Header>;
  let header: HTMLElement;

  async function render(width: number, saved?: 'map' | 'split'): Promise<void> {
    localStorage.clear();
    if (saved) {
      localStorage.setItem(HOME_LAYOUT_STORAGE_KEY, saved);
    }
    viewport = mockViewport(width);
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([
          { path: '', children: [] },
          { path: 'trips', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    header = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
    await fixture.whenStable();
  }

  afterEach(() => {
    viewport.restore();
    localStorage.clear();
  });

  const radio = (label: string): HTMLButtonElement | undefined =>
    Array.from(
      header.querySelectorAll<HTMLButtonElement>('[role="radiogroup"] [role="radio"]'),
    ).find((item) => item.textContent?.includes(label));

  it('puts the Map / Split toggle next to the logo on Home from 1440 px', async () => {
    await render(1920, 'map');

    const start = header.querySelector('.header__start')!;
    expect(start.querySelector('[role="radiogroup"][aria-label="Home layout"]')).not.toBeNull();
    expect(radio('Map')?.getAttribute('aria-checked')).toBe('true');
    expect(radio('Split')?.getAttribute('aria-checked')).toBe('false');
    expect(radio('Map')?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('saves the choice through HomeLayout without touching the route', async () => {
    await render(1920, 'map');
    const navigated = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');

    radio('Split')!.click();
    await fixture.whenStable();

    expect(TestBed.inject(HomeLayout).preference()).toBe('split');
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('split');
    expect(radio('Split')?.getAttribute('aria-checked')).toBe('true');
    expect(navigated).not.toHaveBeenCalled();
  });

  it('is not offered below 1440 px, and the saved choice stays', async () => {
    await render(1280, 'map');

    expect(header.querySelector('[role="radiogroup"]')).toBeNull();
    expect(localStorage.getItem(HOME_LAYOUT_STORAGE_KEY)).toBe('map');

    viewport.resize(1600);
    await fixture.whenStable();
    expect(header.querySelector('[role="radiogroup"]')).not.toBeNull();
  });

  it('is only offered on Home', async () => {
    await render(1920);
    expect(header.querySelector('[role="radiogroup"]')).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/trips');
    await fixture.whenStable();
    expect(header.querySelector('[role="radiogroup"]')).toBeNull();

    await TestBed.inject(Router).navigateByUrl('/?from=1&to=2');
    await fixture.whenStable();
    expect(header.querySelector('[role="radiogroup"]')).not.toBeNull();
  });
});

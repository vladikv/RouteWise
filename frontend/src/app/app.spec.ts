import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { SearchFocus } from './shared/util/search-focus';
import { mockViewport } from './shared/util/viewport.testing';

describe('App', () => {
  let viewport: ReturnType<typeof mockViewport> | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => viewport?.restore());

  async function render(width: number): Promise<ComponentFixture<App>> {
    viewport = mockViewport(width);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture;
  }

  it('renders the shell: skip link, header with brand, main landmark and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const shell = fixture.nativeElement as HTMLElement;

    expect(shell.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
    expect(shell.querySelector('app-shell header .brand')?.textContent).toContain('RouteWise');
    expect(shell.querySelector('app-shell main#main')).not.toBeNull();
    expect(shell.querySelector('app-shell footer')?.textContent).toContain('Open-Meteo');
    expect(shell.querySelector('.glow-layer')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the icon rail from 1024 px with search, new trip, trips and modes', async () => {
    const shell = (await render(1024)).nativeElement as HTMLElement;

    const rail = shell.querySelector('app-icon-rail nav[aria-label="Quick access"]')!;
    expect(rail).not.toBeNull();
    expect(
      Array.from(rail.querySelectorAll('a, button')).map((item) => [
        item.getAttribute('aria-label'),
        item.getAttribute('href'),
      ]),
    ).toEqual([
      ['Search trips', null],
      ['New trip', '/trips/new'],
      ['Trips', '/trips'],
      ['Modes', '/modes'],
    ]);
  });

  it('hides the icon rail below 1024 px and brings it back when the window grows', async () => {
    const fixture = await render(1023);
    const shell = fixture.nativeElement as HTMLElement;
    expect(shell.querySelector('app-icon-rail')).toBeNull();

    viewport?.resize(1280);
    await fixture.whenStable();
    expect(shell.querySelector('app-icon-rail')).not.toBeNull();
  });

  it('opens the trips search from the rail', async () => {
    const open = vi.spyOn(TestBed.inject(SearchFocus), 'open').mockImplementation(() => undefined);
    const shell = (await render(1280)).nativeElement as HTMLElement;

    shell
      .querySelector<HTMLButtonElement>('app-icon-rail button[aria-label="Search trips"]')!
      .click();

    expect(open).toHaveBeenCalledOnce();
  });

  it('scrolls the page area back to the top for a new page but not for a query change', async () => {
    const fixture = await render(1280);
    const page = (fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/modes');
    await fixture.whenStable();

    page.scrollTop = 120;
    await router.navigateByUrl('/modes?x=1');
    await fixture.whenStable();
    expect(page.scrollTop).toBe(120);

    await router.navigateByUrl('/login');
    await fixture.whenStable();
    expect(page.scrollTop).toBe(0);
  }, 15_000);

  it('focuses the scrolling page area on first render so the keyboard scrolls it', async () => {
    const fixture = await render(1280);
    const page = (fixture.nativeElement as HTMLElement).querySelector('.page');

    expect(page?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(page);
  });

  it('moves focus to the page area on a new page but leaves a focused page element alone', async () => {
    const fixture = await render(1280);
    const shell = fixture.nativeElement as HTMLElement;
    const page = shell.querySelector('.page') as HTMLElement;
    const router = TestBed.inject(Router);
    shell.querySelector<HTMLElement>('app-icon-rail a')!.focus();

    await router.navigateByUrl('/modes');
    await fixture.whenStable();
    expect(document.activeElement).toBe(page);

    const inside = shell.querySelector<HTMLElement>('main')!;
    inside.focus();
    await router.navigateByUrl('/login');
    await fixture.whenStable();
    expect(document.activeElement).toBe(inside);
  }, 15_000);

  it('skips to the content without navigating', async () => {
    const fixture = await render(1280);
    const shell = fixture.nativeElement as HTMLElement;
    const router = TestBed.inject(Router);
    const before = router.url;

    shell.querySelector<HTMLAnchorElement>('.skip-link')!.click();

    expect(router.url).toBe(before);
    expect(document.activeElement).toBe(shell.querySelector('main#main'));
  });

  it('shows the not-found page for unknown routes', async () => {
    const harness = await RouterTestingHarness.create('/no-such-page');

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Page not found');
  }, 15_000); // loads a lazy route chunk, which can be slow when all specs run in parallel
});

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { installDialogSupport } from './shared/ui/dialog.testing';
import { mockViewport } from './shared/util/viewport.testing';

describe('App', () => {
  let viewport: ReturnType<typeof mockViewport> | undefined;

  beforeEach(async () => {
    installDialogSupport();
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

  it('shows the icon rail from 1024 px with global tools, not the pages of the top nav', async () => {
    const shell = (await render(1024)).nativeElement as HTMLElement;

    const rail = shell.querySelector('app-icon-rail nav[aria-label="Quick access"]')!;
    expect(rail).not.toBeNull();
    expect(
      Array.from(rail.querySelectorAll('a, button')).map((item) => [
        item.getAttribute('aria-label'),
        item.getAttribute('href'),
      ]),
    ).toEqual([
      ['Search', null],
      ['New trip', '/trips/new'],
      ['Upcoming trips', null],
      ['Keyboard shortcuts', null],
    ]);
    const search = rail.querySelector('button[aria-label="Search"]')!;
    expect(search.getAttribute('title')).toBe('Search (Ctrl+K)');
    expect(search.getAttribute('aria-keyshortcuts')).toBe('Control+K Meta+K');
    expect(
      rail.querySelector('button[aria-label="Upcoming trips"]')?.getAttribute('aria-expanded'),
    ).toBe('false');
  });

  it('hides the icon rail below 1024 px and brings it back when the window grows', async () => {
    const fixture = await render(1023);
    const shell = fixture.nativeElement as HTMLElement;
    expect(shell.querySelector('app-icon-rail')).toBeNull();

    viewport?.resize(1280);
    await fixture.whenStable();
    expect(shell.querySelector('app-icon-rail')).not.toBeNull();
  });

  it('opens the search palette from the rail and closes it with Escape', async () => {
    const fixture = await render(1280);
    const shell = fixture.nativeElement as HTMLElement;
    const search = shell.querySelector<HTMLButtonElement>(
      'app-icon-rail button[aria-label="Search"]',
    )!;
    search.focus();
    search.click();
    await fixture.whenStable();

    const palette = shell.querySelector('app-command-palette dialog') as HTMLDialogElement;
    expect(palette.open).toBe(true);
    expect(document.activeElement).toBe(palette.querySelector('input[role="combobox"]'));

    palette.dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(palette.open).toBe(false);
    expect(document.activeElement).toBe(search);
  });

  it('opens the search palette with Ctrl+K or Cmd+K on every width, also without the rail', async () => {
    const fixture = await render(375);
    const shell = fixture.nativeElement as HTMLElement;
    const palette = () => shell.querySelector('app-command-palette dialog') as HTMLDialogElement;

    const ctrlK = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(ctrlK);
    await fixture.whenStable();
    expect(ctrlK.defaultPrevented).toBe(true);
    expect(palette().open).toBe(true);

    palette().dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', metaKey: true }));
    await fixture.whenStable();
    expect(palette().open).toBe(true);

    const plainK = new KeyboardEvent('keydown', { key: 'k', cancelable: true });
    document.dispatchEvent(plainK);
    expect(plainK.defaultPrevented).toBe(false);
  });

  it('lists the keyboard shortcuts in a dialog from the rail', async () => {
    const fixture = await render(1280);
    const shell = fixture.nativeElement as HTMLElement;

    shell
      .querySelector<HTMLButtonElement>('app-icon-rail button[aria-label="Keyboard shortcuts"]')!
      .click();
    await fixture.whenStable();

    const dialog = shell.querySelector('app-shortcuts-dialog dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toBe('Keyboard shortcuts');
    expect(dialog.textContent).toContain('Search cities and trips');
    expect(document.activeElement).toBe(dialog.querySelector('button[aria-label="Close"]'));

    dialog.querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
  });

  it('opens the shortcuts with ? outside text fields only, and Escape returns focus', async () => {
    const fixture = await render(1280);
    const shell = fixture.nativeElement as HTMLElement;
    const dialog = () => shell.querySelector('app-shortcuts-dialog dialog') as HTMLDialogElement;
    const rail = shell.querySelector<HTMLButtonElement>(
      'app-icon-rail button[aria-label="Keyboard shortcuts"]',
    )!;

    const input = document.createElement('input');
    shell.appendChild(input);
    input.focus();
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(dialog()).toBeNull(); // not loaded before its first open
    input.remove();

    rail.focus();
    const key = new KeyboardEvent('keydown', { key: '?', bubbles: true, cancelable: true });
    rail.dispatchEvent(key);
    await fixture.whenStable();
    expect(key.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(true);

    dialog().dispatchEvent(new Event('cancel', { cancelable: true }));
    await fixture.whenStable();
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(rail);
  });

  describe('overlays over each other', () => {
    const palette = (shell: HTMLElement) =>
      shell.querySelector('app-command-palette dialog') as HTMLDialogElement;
    const ctrlK = () =>
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
      );

    it('leaves an open dialog alone: Ctrl+K and ? are ignored over it and focus returns to the rail', async () => {
      const fixture = await render(1280);
      const shell = fixture.nativeElement as HTMLElement;
      const rail = shell.querySelector<HTMLButtonElement>(
        'app-icon-rail button[aria-label="Keyboard shortcuts"]',
      )!;
      rail.focus();
      rail.click();
      await fixture.whenStable();
      const shortcuts = shell.querySelector('app-shortcuts-dialog dialog') as HTMLDialogElement;

      ctrlK();
      await fixture.whenStable();
      expect(palette(shell)).toBeNull();
      expect(shortcuts.open).toBe(true);

      shortcuts.dispatchEvent(new Event('cancel', { cancelable: true }));
      await fixture.whenStable();
      expect(shortcuts.open).toBe(false);
      expect(document.activeElement).toBe(rail);
    });

    it('keeps the popover open under the palette, and Escape returns focus to its link', async () => {
      const fixture = await render(1280);
      const shell = fixture.nativeElement as HTMLElement;
      const trigger = shell.querySelector<HTMLButtonElement>(
        'app-icon-rail button[aria-label="Upcoming trips"]',
      )!;
      trigger.focus();
      trigger.click();
      await fixture.whenStable();
      const link = shell.querySelector<HTMLAnchorElement>('app-upcoming-trips a')!;
      expect(document.activeElement).toBe(link);

      ctrlK();
      await fixture.whenStable();
      expect(palette(shell).open).toBe(true);

      // What the browser does on Escape inside the palette: keydown first, then cancel.
      const input = palette(shell).querySelector('input')!;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      palette(shell).dispatchEvent(new Event('cancel', { cancelable: true }));
      await fixture.whenStable();

      expect(palette(shell).open).toBe(false);
      expect(shell.querySelector('app-upcoming-trips')).not.toBeNull();
      expect(document.activeElement).toBe(link);
    });

    it('opens the palette by the physical K key too, for other keyboard layouts', async () => {
      const fixture = await render(1280);
      const shell = fixture.nativeElement as HTMLElement;

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'л', code: 'KeyK', ctrlKey: true, cancelable: true }),
      );
      await fixture.whenStable();

      expect(palette(shell).open).toBe(true);
    });
  });

  it('scrolls the page area back to the top for a new page but not for a query change', async () => {
    const fixture = await render(1280);
    const page = (fixture.nativeElement as HTMLElement).querySelector('.page') as HTMLElement;
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/register');
    await fixture.whenStable();

    page.scrollTop = 120;
    await router.navigateByUrl('/register?x=1');
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

    await router.navigateByUrl('/register');
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

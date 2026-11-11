import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('renders the shell: skip link, header with brand, main landmark and footer', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const shell = fixture.nativeElement as HTMLElement;

    expect(shell.querySelector('.skip-link')?.getAttribute('href')).toBe('#main');
    expect(shell.querySelector('header .brand')?.textContent).toContain('RouteWise');
    expect(shell.querySelector('main#main')).not.toBeNull();
    expect(shell.querySelector('footer')?.textContent).toContain('Open-Meteo');
  });

  it('toggles the theme from the header button', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.theme-toggle',
    );

    expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    toggle?.click();
    await fixture.whenStable();

    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('shows the not-found page for unknown routes', async () => {
    const harness = await RouterTestingHarness.create('/no-such-page');

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Page not found');
  });
});

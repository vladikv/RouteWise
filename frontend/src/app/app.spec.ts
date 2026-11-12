import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
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

  it('shows the not-found page for unknown routes', async () => {
    const harness = await RouterTestingHarness.create('/no-such-page');

    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('Page not found');
  }, 15_000); // loads a lazy route chunk, which can be slow when all specs run in parallel
});

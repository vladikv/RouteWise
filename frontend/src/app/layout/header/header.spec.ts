import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api/api-config';
import { AuthApi } from '../../core/api/auth-api';
import { ALICE } from '../../core/auth/auth.testing';
import { Session } from '../../core/auth/session';
import { Header } from './header';

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

  async function render(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function linkHrefs(root: ParentNode): (string | null)[] {
    return Array.from(root.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'));
  }

  it('offers the main links and a login link when logged out', async () => {
    await render();

    const nav = header.querySelector('nav[aria-label="Main"]')!;
    expect(linkHrefs(nav)).toEqual(['/', '/trips']);
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
    buttonNamed('Log out')?.click();
    TestBed.inject(HttpTestingController)
      .expectOne({ method: 'POST', url: 'http://api.test/api/auth/logout' })
      .flush(null);
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
    expect(linkHrefs(panel)).toEqual(['/', '/trips', '/login']);

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
});

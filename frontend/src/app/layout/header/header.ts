import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { Session } from '../../core/auth/session';
import { IconButton } from '../../shared/ui/icon-button';
import { PillNav, PillNavItem } from '../../shared/ui/pill-nav';

type OpenMenu = 'account' | 'nav' | null;

/** App header: brand, main navigation and the account (log in / avatar menu); a menu below 768 px. */
@Component({
  selector: 'app-header',
  imports: [RouterLink, IconButton, PillNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
  host: {
    '(keydown.escape)': 'closeWithFocus()',
    '(document:click)': 'closeOnOutsideClick($event)',
  },
})
export class Header {
  protected readonly session = inject(Session);
  protected readonly navItems: PillNavItem[] = [
    { label: 'Home', link: '/', exact: true },
    { label: 'Trips', link: '/trips' },
  ];
  protected readonly open = signal<OpenMenu>(null);
  protected readonly initials = computed(() => {
    const words = (this.session.user()?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  });

  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly avatarButton = viewChild<ElementRef<HTMLButtonElement>>('avatarButton');
  private readonly menuButton = viewChild('menuButton', { read: ElementRef<HTMLElement> });

  protected toggle(menu: Exclude<OpenMenu, null>): void {
    this.open.update((current) => (current === menu ? null : menu));
  }

  /** Escape closes the open menu and puts focus back on the button that opened it. */
  protected closeWithFocus(): void {
    const menu = this.open();
    if (!menu) {
      return;
    }
    this.open.set(null);
    const trigger =
      menu === 'account'
        ? this.avatarButton()?.nativeElement
        : this.menuButton()?.nativeElement.querySelector('button');
    trigger?.focus();
  }

  protected closeOnOutsideClick(event: Event): void {
    const menu = this.open();
    const area = menu && this.host.nativeElement.querySelector(`[data-menu="${menu}"]`);
    if (area && !area.contains(event.target as Node)) {
      this.open.set(null);
    }
  }

  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.open.set(null));
  }

  protected logout(): void {
    this.open.set(null);
    this.session.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Session } from '../../core/auth/session';
import { THEME_PREFERENCES, ThemePreference, ThemeService } from '../../core/theme/theme';
import { Menu, MenuContent } from '../../shared/ui/menu';
import { PillNav, PillNavItem } from '../../shared/ui/pill-nav';

const THEME_LABELS: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

/**
 * App header: brand, main navigation (centred) and the actions: theme menu, account (log in /
 * avatar menu) and, below 768 px, the navigation menu.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, Menu, MenuContent, PillNav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly session = inject(Session);
  protected readonly navItems: PillNavItem[] = [
    { label: 'Home', link: '/', exact: true },
    { label: 'Trips', link: '/trips' },
  ];
  protected readonly theme = inject(ThemeService);
  protected readonly themeOptions = THEME_PREFERENCES.map((value) => ({
    value,
    label: THEME_LABELS[value],
  }));
  protected readonly themeLabel = computed(() => `Theme: ${THEME_LABELS[this.theme.preference()]}`);
  protected readonly initials = computed(() => {
    const words = (this.session.user()?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  });

  private readonly router = inject(Router);

  protected logout(): void {
    this.session.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}

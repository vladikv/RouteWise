import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs';
import { Session } from '../../core/auth/session';
import { HomeLayout, HomeLayoutChoice } from '../../features/explore/home-layout';
import { Menu, MenuContent } from '../../shared/ui/menu';
import { PillNav, PillNavItem } from '../../shared/ui/pill-nav';
import { SegmentedToggle, ToggleOption } from '../../shared/ui/segmented-toggle';
import { SearchFocus } from '../../shared/util/search-focus';

const LAYOUT_OPTIONS: ToggleOption<HomeLayoutChoice>[] = [
  {
    value: 'map',
    label: 'Map',
    icon: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  },
  { value: 'split', label: 'Split', icon: 'M3 5h18v14H3zM14 5v14' },
];

const pathOf = (url: string): string => url.split(/[?#]/)[0];

/**
 * Top bar of the shell: logo (and, on Home from 1440 px, the Map / Split layout toggle), the
 * centred main navigation, and the actions: search and new-trip round buttons, account (log in /
 * avatar menu) and, below 768 px, the navigation menu.
 */
@Component({
  selector: 'app-header',
  imports: [RouterLink, Menu, MenuContent, PillNav, SegmentedToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  protected readonly session = inject(Session);
  protected readonly homeLayout = inject(HomeLayout);
  protected readonly navItems: PillNavItem[] = [
    { label: 'Home', link: '/', exact: true },
    { label: 'Trips', link: '/trips' },
    { label: 'Modes', link: '/modes' },
  ];
  protected readonly layoutOptions = LAYOUT_OPTIONS;
  protected readonly initials = computed(() => {
    const words = (this.session.user()?.displayName ?? '').trim().split(/\s+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('');
  });

  private readonly router = inject(Router);
  private readonly searchFocus = inject(SearchFocus);
  private readonly path = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map(() => pathOf(this.router.url)),
    ),
    { initialValue: pathOf(this.router.url) },
  );
  /** The layout choice belongs to Home and is only offered where the Map layout fits. */
  protected readonly layoutToggleShown = computed(
    () => this.path() === '/' && this.homeLayout.mapAvailable(),
  );

  protected searchTrips(): void {
    this.searchFocus.open();
  }

  protected logout(): void {
    this.session.logout().subscribe(() => void this.router.navigateByUrl('/'));
  }
}

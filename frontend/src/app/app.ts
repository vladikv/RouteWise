import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { CommandPalette } from './layout/command-palette/command-palette';
import { PaletteState } from './layout/command-palette/palette-state';
import { Header } from './layout/header/header';
import { UpcomingTrips } from './layout/upcoming-trips/upcoming-trips';
import { ShortcutsDialog } from './layout/shortcuts/shortcuts-dialog';
import { AppShell } from './shared/ui/app-shell';
import { IconRail, RailItem } from './shared/ui/icon-rail';
import { ToastOutlet } from './shared/ui/toast-outlet';
import { LayoutBreakpoint } from './shared/util/layout-breakpoint';

const SEARCH_ITEM: RailItem = {
  label: 'Search',
  icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.5 4.5',
  shortcut: { label: 'Ctrl+K', aria: 'Control+K Meta+K' },
};
const NEW_TRIP_ITEM: RailItem = { label: 'New trip', icon: 'M12 5v14M5 12h14', link: '/trips/new' };
const UPCOMING_ICON = 'M12 7v5l3 2M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z';
const SHORTCUTS_ITEM: RailItem = {
  label: 'Keyboard shortcuts',
  icon: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
};

/** True when the key was typed into a text field, select or editable element. */
function isTextTarget(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest('input, textarea, select, [contenteditable]') !== null)
  );
}

const pathOf = (url: string): string => url.split(/[?#]/)[0];

/**
 * App shell: smoky backdrop, skip link, the glass shell with its header, the icon rail (from
 * 1024 px: Search, New trip, Upcoming trips, Keyboard shortcuts) and the scrolling page area (routed
 * page and footer). Ctrl/Cmd + K opens the search palette on every page and at every width. The page area scrolls, not
 * the window, and returns to the top when the route (not just its query) changes.
 */
@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    Header,
    AppShell,
    IconRail,
    ToastOutlet,
    CommandPalette,
    UpcomingTrips,
    ShortcutsDialog,
  ],
  host: { '(document:keydown)': 'onGlobalKey($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glow-layer" aria-hidden="true">
      <span></span><span></span><span></span><span></span>
    </div>
    <a class="skip-link" href="#main" (click)="skipToContent($event)">Skip to content</a>
    <app-shell>
      <app-header shellHeader />
      @if (breakpoint.desktop()) {
        <app-icon-rail shellRail [items]="railItems()" (activate)="onRailItem($event)" />
      }
      <ng-template #upcomingTrips><app-upcoming-trips /></ng-template>
      <div class="page" #page tabindex="-1">
        <main #main id="main" tabindex="-1">
          <router-outlet />
        </main>
        <footer class="footer">
          <p>RouteWise compares travel time, cost and CO₂. Weather data by Open-Meteo.</p>
        </footer>
      </div>
    </app-shell>
    <app-toast-outlet />
    <app-command-palette [open]="palette.isOpen()" (closed)="palette.close()" />
    <app-shortcuts-dialog [open]="shortcutsOpen()" (closed)="shortcutsOpen.set(false)" />
  `,
  styles: `
    :host {
      display: block;
    }

    .page {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow-y: auto;
      scrollbar-color: var(--color-border-strong) transparent;
      scrollbar-width: thin;
    }

    main {
      flex: 1;
      width: 100%;
      max-width: var(--content-width);
      margin: 0 auto;
      padding: var(--space-8) var(--space-4);
    }

    main:focus,
    .page:focus {
      outline: none;
    }

    .skip-link {
      position: absolute;
      left: var(--space-4);
      top: -4rem;
      z-index: 10;
      padding: var(--space-2) var(--space-4);
      border-radius: var(--radius-sm);
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: 600;
    }

    .skip-link:focus {
      top: var(--space-2);
    }

    .footer {
      min-height: var(--footer-height);
      padding: var(--space-4);
      border-top: 1px solid var(--color-border);
      color: var(--color-text-muted);
      font-size: 0.875rem;
      text-align: center;
    }

    .footer p {
      margin: 0;
    }
  `,
})
export class App {
  protected readonly breakpoint = inject(LayoutBreakpoint);
  protected readonly palette = inject(PaletteState);
  protected readonly shortcutsOpen = signal(false);

  private readonly upcomingTrips = viewChild.required<TemplateRef<unknown>>('upcomingTrips');
  /** Global tools only: the pages themselves are in the header's navigation. */
  protected readonly railItems = computed<RailItem[]>(() => [
    SEARCH_ITEM,
    NEW_TRIP_ITEM,
    { label: 'Upcoming trips', icon: UPCOMING_ICON, popover: this.upcomingTrips() },
    SHORTCUTS_ITEM,
  ]);

  private readonly page = viewChild.required<ElementRef<HTMLElement>>('page');
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    const router = inject(Router);
    let previous = pathOf(router.url);
    router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => {
        const current = pathOf(router.url);
        if (current !== previous) {
          previous = current;
          this.page().nativeElement.scrollTop = 0;
          this.focusPage(false);
        }
      });
    afterNextRender(() => this.focusPage(true));
  }

  protected onRailItem(item: RailItem): void {
    if (item === SEARCH_ITEM) {
      this.palette.open();
    } else if (item === SHORTCUTS_ITEM) {
      this.shortcutsOpen.set(true);
    }
  }

  /** Ctrl+K (Cmd+K on a Mac; by key or physical K, for other layouts) opens the search palette from anywhere, also inside a text field, but not over an open dialog; `?` opens the shortcuts outside text fields. */
  protected onGlobalKey(event: KeyboardEvent): void {
    const isK = event.key.toLowerCase() === 'k' || event.code === 'KeyK';
    if ((event.ctrlKey || event.metaKey) && !event.altKey && isK) {
      event.preventDefault();
      if (!this.dialogOpen()) {
        this.palette.open();
      }
    } else if (event.key === '?' && !event.ctrlKey && !event.metaKey && !isTextTarget(event)) {
      event.preventDefault();
      if (!this.dialogOpen()) {
        this.shortcutsOpen.set(true);
      }
    }
  }

  /** A dialog is open: another overlay would take it as its opener and lose focus when both close. */
  private dialogOpen(): boolean {
    return document.querySelector('dialog[open]') !== null;
  }

  /** The base href would turn "#main" into a navigation to "/#main", so focus the target ourselves. */
  protected skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  /**
   * Gives the scrolling page area focus so Space, PageDown and the arrows scroll it. Focus already
   * inside it, or in an open menu, stays; `idleOnly` (first render) also leaves any focused element alone.
   */
  private focusPage(idleOnly: boolean): void {
    const page = this.page().nativeElement;
    const active = document.activeElement;
    const busy = idleOnly && active !== null && active !== document.body;
    if (page.contains(active) || busy || active?.closest('app-menu')) {
      return;
    }
    page.focus({ preventScroll: true });
  }
}

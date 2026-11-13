import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Header } from './layout/header/header';
import { AppShell } from './shared/ui/app-shell';
import { IconRail, RailItem } from './shared/ui/icon-rail';
import { ToastOutlet } from './shared/ui/toast-outlet';
import { LayoutBreakpoint } from './shared/util/layout-breakpoint';
import { SearchFocus } from './shared/util/search-focus';

const RAIL_ITEMS: RailItem[] = [
  { label: 'Search trips', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 16l4.5 4.5' },
  { label: 'New trip', icon: 'M12 5v14M5 12h14', link: '/trips/new' },
  {
    label: 'Trips',
    icon: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
    link: '/trips',
  },
  { label: 'Modes', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', link: '/modes' },
];

const pathOf = (url: string): string => url.split(/[?#]/)[0];

/**
 * App shell: smoky backdrop, skip link, the glass shell with its header, the icon rail (from
 * 1024 px) and the scrolling page area (routed page and footer). The page area scrolls, not
 * the window, and returns to the top when the route (not just its query) changes.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, AppShell, IconRail, ToastOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="glow-layer" aria-hidden="true">
      <span></span><span></span><span></span><span></span>
    </div>
    <a class="skip-link" href="#main" (click)="skipToContent($event)">Skip to content</a>
    <app-shell>
      <app-header shellHeader />
      @if (breakpoint.desktop()) {
        <app-icon-rail shellRail [items]="railItems" (activate)="searchFocus.open()" />
      }
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
  protected readonly searchFocus = inject(SearchFocus);
  protected readonly railItems = RAIL_ITEMS;

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

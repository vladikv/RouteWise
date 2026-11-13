import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The app's one big rounded glass shell with a small margin around it. Project the top bar with
 * `shellHeader`, the optional left rail with `shellRail` and the page area as the default content.
 * The glass is a sibling layer (`::before`), not the shell itself, so panels, menus and the rail
 * inside still blur the page backdrop and the globe never sits inside a backdrop root.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <ng-content select="[shellHeader]" />
      <div class="body">
        <ng-content select="[shellRail]" />
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100dvh;
      padding: var(--shell-margin);
    }

    .shell {
      position: relative;
      isolation: isolate;
      display: flex;
      flex-direction: column;
      height: 100%;
      border: 1px solid var(--glass-border);
      border-radius: var(--shell-radius);
      box-shadow: var(--glass-highlight), var(--shadow-shell);
      overflow: hidden;
    }

    .shell::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: -1;
      border-radius: inherit;
      background: var(--glass-bg-shell);
      -webkit-backdrop-filter: var(--glass-filter);
      backdrop-filter: var(--glass-filter);
      pointer-events: none;
    }

    .body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
  `,
})
export class AppShell {}

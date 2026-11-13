import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Modal } from '../../shared/ui/modal';

interface Shortcut {
  keys: string[];
  action: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

/** Every keyboard shortcut of the app; keep it in step with the components that handle them. */
export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Everywhere',
    shortcuts: [
      { keys: ['Ctrl', 'K'], action: 'Search cities and trips (⌘ K on a Mac)' },
      { keys: ['?'], action: 'Show this list (outside text fields)' },
      { keys: ['Esc'], action: 'Close a dialog, menu or popover' },
    ],
  },
  {
    title: 'Globe',
    shortcuts: [
      { keys: ['←', '→', '↑', '↓'], action: 'Turn the globe, or move between cities' },
      { keys: ['+', '−'], action: 'Zoom in and out' },
      { keys: ['0'], action: 'Reset the view' },
      { keys: ['Enter'], action: 'Choose the focused city' },
    ],
  },
  {
    title: 'Search and pickers',
    shortcuts: [
      { keys: ['↑', '↓'], action: 'Move through the results' },
      { keys: ['Enter'], action: 'Choose the highlighted result' },
    ],
  },
  {
    title: 'Trips list',
    shortcuts: [
      { keys: ['↑', '↓', 'Home', 'End'], action: 'Move between trips' },
      { keys: ['Enter', 'Space'], action: 'Expand or collapse a trip' },
      { keys: ['Esc'], action: 'Collapse the expanded trip' },
    ],
  },
];

/** The rail's Keyboard shortcuts dialog: a reference list, nothing to answer. */
@Component({
  selector: 'app-shortcuts-dialog',
  imports: [Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="open()" title="Keyboard shortcuts" (closed)="closed.emit()">
      @for (group of groups; track group.title) {
        <section class="group">
          <h3>{{ group.title }}</h3>
          <dl>
            @for (shortcut of group.shortcuts; track shortcut.action) {
              <div class="row">
                <dt>
                  @for (key of shortcut.keys; track key) {
                    <kbd>{{ key }}</kbd>
                  }
                </dt>
                <dd>{{ shortcut.action }}</dd>
              </div>
            }
          </dl>
        </section>
      }
    </app-modal>
  `,
  styles: `
    .group + .group {
      margin-top: var(--space-4);
    }

    h3 {
      margin: 0 0 var(--space-2);
      font-size: 0.9375rem;
    }

    dl {
      display: grid;
      gap: var(--space-2);
      margin: 0;
    }

    .row {
      display: grid;
      grid-template-columns: 9rem minmax(0, 1fr);
      align-items: baseline;
      gap: var(--space-3);
    }

    dt {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }

    dd {
      margin: 0;
      color: var(--color-text-muted);
    }

    kbd {
      min-width: 1.75rem;
      padding: 0.1rem 0.4rem;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-sm);
      background: var(--glass-bg-strong);
      font: inherit;
      font-size: 0.8125rem;
      font-weight: 700;
      text-align: center;
    }
  `,
})
export class ShortcutsDialog {
  readonly open = input.required<boolean>();
  readonly closed = output<void>();
  protected readonly groups = SHORTCUT_GROUPS;
}

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Trip } from '../../../core/api/models';
import { ConfirmAction } from '../../../shared/ui/confirm-action';
import { IconButton } from '../../../shared/ui/icon-button';

let nextId = 0;

/**
 * The "⋯" menu of a trip: open, edit and delete (with its inline confirmation).
 * Disclosure pattern: Escape closes it and returns focus, a click outside closes it.
 */
@Component({
  selector: 'app-trip-menu',
  imports: [RouterLink, ConfirmAction, IconButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(keydown.escape)': 'closeWithFocus()',
    '(document:click)': 'closeOnOutsideClick($event)',
  },
  template: `
    <app-icon-button
      [label]="'Actions for ' + trip().title"
      [controls]="menuId"
      [expanded]="open()"
      (click)="open.set(!open())"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3" />
      </svg>
    </app-icon-button>
    @if (open()) {
      <div class="dropdown" [id]="menuId">
        <a [routerLink]="['/trips', trip().id]" [attr.aria-label]="'Open ' + trip().title">Open</a>
        <a [routerLink]="['/trips', trip().id, 'edit']" [attr.aria-label]="'Edit ' + trip().title">
          Edit
        </a>
        <app-confirm-action
          [ariaLabel]="'Delete ' + trip().title"
          question="Delete this trip?"
          [busy]="busy()"
          (confirmed)="deleted.emit()"
        />
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
    }

    .dropdown {
      position: absolute;
      top: 0;
      right: calc(100% + var(--space-2));
      z-index: 10;
      display: grid;
      gap: var(--space-1);
      width: max-content;
      max-width: 14rem;
      padding: var(--space-2);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      background: var(--color-surface-muted);
      box-shadow: var(--shadow-raised);
    }

    .dropdown a {
      display: block;
      padding: var(--space-2) var(--space-3);
      border-radius: var(--radius-sm);
      color: var(--color-text);
      font-weight: 600;
      text-decoration: none;
    }

    .dropdown a:hover {
      background: var(--color-primary-a12);
    }

    .dropdown ::ng-deep .button {
      width: 100%;
    }
  `,
})
export class TripMenu {
  readonly trip = input.required<Trip>();
  readonly busy = input(false);
  readonly deleted = output<void>();

  protected readonly open = signal(false);
  protected readonly menuId = `trip-menu-${nextId++}`;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected closeWithFocus(): void {
    if (!this.open()) {
      return;
    }
    this.open.set(false);
    this.host.nativeElement.querySelector('button')?.focus();
  }

  protected closeOnOutsideClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.open.set(false);
    }
  }
}

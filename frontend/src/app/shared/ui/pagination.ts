import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * Page controls for a server-paged list: the range shown and the total ("21–40 of 45 trips"),
 * Previous / Next and "Page 2 of 3". Pages are zero-based, like the API's. At either end the
 * button is `aria-disabled` rather than `disabled`, so keyboard focus is not lost when the last
 * step is taken. Renders nothing when there is only one page.
 */
@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav class="pagination" aria-label="Pagination">
        <p class="pagination__count" role="status">{{ range() }}</p>
        <div class="pagination__controls">
          <button
            type="button"
            class="button"
            [attr.aria-disabled]="page() === 0 ? 'true' : null"
            (click)="go(page() - 1)"
          >
            Previous
          </button>
          <span class="pagination__page">Page {{ page() + 1 }} of {{ totalPages() }}</span>
          <button
            type="button"
            class="button"
            [attr.aria-disabled]="page() >= totalPages() - 1 ? 'true' : null"
            (click)="go(page() + 1)"
          >
            Next
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    .pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-top: var(--space-4);
    }

    .pagination__count {
      margin: 0;
      color: var(--color-text-muted);
    }

    .pagination__controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-3);
    }

    .pagination__page {
      font-weight: 600;
    }

    [aria-disabled='true'] {
      cursor: not-allowed;
      opacity: 0.6;
    }
  `,
})
export class Pagination {
  /** Zero-based current page. */
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly totalItems = input.required<number>();
  readonly pageSize = input.required<number>();
  /** Items on the current page (the last page may be short). */
  readonly itemCount = input.required<number>();
  /** What the items are, for the count: "trips". */
  readonly noun = input('items');
  readonly pageChange = output<number>();

  protected readonly range = computed(() => {
    const first = this.page() * this.pageSize() + 1;
    const last = first + this.itemCount() - 1;
    return `${first}–${last} of ${this.totalItems()} ${this.noun()}`;
  });

  protected go(page: number): void {
    if (page >= 0 && page < this.totalPages()) {
      this.pageChange.emit(page);
    }
  }
}

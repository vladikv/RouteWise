import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;
  let root: HTMLElement;
  let requested: number[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(Pagination);
    requested = [];
    fixture.componentInstance.pageChange.subscribe((page) => requested.push(page));
    root = fixture.nativeElement as HTMLElement;
    document.body.append(root);
    set({ page: 1, totalPages: 3, totalItems: 45, itemCount: 20 });
    await fixture.whenStable();
  });

  afterEach(() => root.remove());

  function set(values: {
    page: number;
    totalPages: number;
    totalItems: number;
    itemCount: number;
  }) {
    fixture.componentRef.setInput('page', values.page);
    fixture.componentRef.setInput('totalPages', values.totalPages);
    fixture.componentRef.setInput('totalItems', values.totalItems);
    fixture.componentRef.setInput('itemCount', values.itemCount);
    fixture.componentRef.setInput('pageSize', 20);
    fixture.componentRef.setInput('noun', 'trips');
  }

  const button = (name: string) =>
    Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;

  it('shows the range with the total, the page of pages and a labelled navigation', () => {
    expect(root.querySelector('nav')?.getAttribute('aria-label')).toBe('Pagination');
    expect(root.querySelector('[role="status"]')?.textContent).toBe('21–40 of 45 trips');
    expect(root.textContent).toContain('Page 2 of 3');
  });

  it('asks for the previous and the next page, zero-based', () => {
    button('Previous').click();
    button('Next').click();

    expect(requested).toEqual([0, 2]);
  });

  it('shows a short last page', async () => {
    set({ page: 2, totalPages: 3, totalItems: 45, itemCount: 5 });
    await fixture.whenStable();

    expect(root.querySelector('[role="status"]')?.textContent).toBe('41–45 of 45 trips');
  });

  it('keeps the end buttons focusable but inert, announced as disabled', async () => {
    set({ page: 0, totalPages: 3, totalItems: 45, itemCount: 20 });
    await fixture.whenStable();

    expect(button('Previous').getAttribute('aria-disabled')).toBe('true');
    expect(button('Previous').disabled).toBe(false);
    button('Previous').click();
    expect(requested).toEqual([]);

    set({ page: 2, totalPages: 3, totalItems: 45, itemCount: 5 });
    await fixture.whenStable();
    expect(button('Next').getAttribute('aria-disabled')).toBe('true');
    button('Next').click();
    expect(requested).toEqual([]);
  });

  it('renders nothing for a single page', async () => {
    set({ page: 0, totalPages: 1, totalItems: 3, itemCount: 3 });
    await fixture.whenStable();

    expect(root.querySelector('nav')).toBeNull();
  });
});

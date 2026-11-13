import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TOAST_DURATION_MS, ToastService } from './toast';
import { ToastOutlet } from './toast-outlet';

describe('ToastOutlet', () => {
  let fixture: ComponentFixture<ToastOutlet>;
  let root: HTMLElement;
  let service: ToastService;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [ToastOutlet] }).compileComponents();
    service = TestBed.inject(ToastService);
    fixture = TestBed.createComponent(ToastOutlet);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const toasts = () => Array.from(root.querySelectorAll('.toast'));

  it('keeps an empty alert region and status region in the page', () => {
    expect(root.querySelector('[role="alert"][aria-live="assertive"]')).not.toBeNull();
    expect(root.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(toasts()).toHaveLength(0);
  });

  it('puts errors in the alert region and info in the status region', async () => {
    service.show({ message: 'Could not save', kind: 'error' });
    service.show({ message: 'Trip moved', kind: 'info' });
    await settle();

    expect(root.querySelector('[role="alert"]')?.textContent).toContain('Could not save');
    expect(root.querySelector('[role="alert"]')?.textContent).not.toContain('Trip moved');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Trip moved');
  });

  it('dismisses itself after five seconds', async () => {
    service.show({ message: 'Trip moved', kind: 'info' });
    await settle();

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    await settle();
    expect(toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    await settle();
    expect(toasts()).toHaveLength(0);
  });

  it('waits while hovered and continues with the time left', async () => {
    service.show({ message: 'Trip moved', kind: 'info' });
    await settle();

    vi.advanceTimersByTime(3000);
    toasts()[0].dispatchEvent(new MouseEvent('mouseenter'));
    vi.advanceTimersByTime(60_000);
    await settle();
    expect(toasts()).toHaveLength(1);

    toasts()[0].dispatchEvent(new MouseEvent('mouseleave'));
    vi.advanceTimersByTime(1999);
    await settle();
    expect(toasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    await settle();
    expect(toasts()).toHaveLength(0);
  });

  it('waits while focus is inside the toast', async () => {
    service.show({ message: 'Trip moved', kind: 'info' });
    await settle();

    toasts()[0].dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    await settle();
    expect(toasts()).toHaveLength(1);

    toasts()[0].dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    await settle();
    expect(toasts()).toHaveLength(0);
  });

  it('closes with the dismiss button', async () => {
    service.show({ message: 'Trip moved', kind: 'info' });
    await settle();

    root.querySelector<HTMLButtonElement>('button[aria-label="Dismiss notification"]')!.click();
    await settle();

    expect(toasts()).toHaveLength(0);
  });

  it('runs the action and then closes the toast', async () => {
    const run = vi.fn();
    service.show({ message: 'Could not move', kind: 'error', action: { label: 'Retry', run } });
    await settle();

    const action = Array.from(root.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Retry',
    )!;
    action.click();
    await settle();

    expect(run).toHaveBeenCalledOnce();
    expect(toasts()).toHaveLength(0);
  });
});

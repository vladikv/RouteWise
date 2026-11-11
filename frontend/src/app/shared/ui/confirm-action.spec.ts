import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmAction } from './confirm-action';

describe('ConfirmAction', () => {
  let fixture: ComponentFixture<ConfirmAction>;
  let element: HTMLElement;
  let confirmations: number;

  beforeEach(async () => {
    fixture = TestBed.createComponent(ConfirmAction);
    fixture.componentRef.setInput('question', 'Delete this trip?');
    fixture.componentRef.setInput('ariaLabel', 'Delete Berlin to Vienna');
    confirmations = 0;
    fixture.componentInstance.confirmed.subscribe(() => confirmations++);
    element = fixture.nativeElement as HTMLElement;
    document.body.appendChild(element); // focus only works on attached elements
    await fixture.whenStable();
  });

  afterEach(() => element.remove());

  function buttons(): HTMLButtonElement[] {
    return Array.from(element.querySelectorAll('button'));
  }

  it('asks before emitting and moves focus to the confirm button', async () => {
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0].getAttribute('aria-label')).toBe('Delete Berlin to Vienna');

    buttons()[0].click();
    await fixture.whenStable();

    expect(confirmations).toBe(0);
    expect(element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Delete this trip?',
    );
    expect(document.activeElement).toBe(buttons()[0]);
    expect(buttons()[0].textContent).toContain('Yes, delete');

    buttons()[0].click();
    expect(confirmations).toBe(1);
  });

  it('returns to the initial state on cancel', async () => {
    buttons()[0].click();
    await fixture.whenStable();
    buttons()[1].click();
    await fixture.whenStable();

    expect(buttons()).toHaveLength(1);
    expect(confirmations).toBe(0);
  });

  it('disables both buttons and shows progress while busy', async () => {
    buttons()[0].click();
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(buttons().every((button) => button.disabled)).toBe(true);
    expect(buttons()[0].textContent).toContain('Deleting…');
  });
});

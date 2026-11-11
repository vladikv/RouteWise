import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/api/api-error';
import { ErrorMessage } from './error-message';

describe('ErrorMessage', () => {
  function render(error: unknown, retryable = true) {
    const fixture = TestBed.createComponent(ErrorMessage);
    fixture.componentRef.setInput('error', error);
    fixture.componentRef.setInput('retryable', retryable);
    fixture.detectChanges();
    return fixture;
  }

  it('shows title and detail of an ApiError and emits retry', () => {
    const fixture = render(new ApiError(404, 'Not Found', 'Trip with id 9 not found'));
    const element = fixture.nativeElement as HTMLElement;
    let retried = false;
    fixture.componentInstance.retry.subscribe(() => (retried = true));

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Not Found');
    expect(element.textContent).toContain('Trip with id 9 not found');

    element.querySelector('button')?.click();
    expect(retried).toBe(true);
  });

  it('shows a generic message for unknown errors and hides retry when not retryable', () => {
    const element = render(new TypeError('boom'), false).nativeElement as HTMLElement;

    expect(element.textContent).toContain('Something went wrong');
    expect(element.textContent).not.toContain('boom');
    expect(element.querySelector('button')).toBeNull();
  });
});

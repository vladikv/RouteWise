import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/api/api-error';
import { DRAFT } from './comparison/comparison.testing';
import { TripDraftInput } from './trip-draft-input';
import { typeInto } from './trip-form.testing';

describe('TripDraftInput', () => {
  let fixture: ComponentFixture<TripDraftInput>;
  let element: HTMLElement;
  let emitted: string[];

  beforeEach(async () => {
    fixture = TestBed.createComponent(TripDraftInput);
    emitted = [];
    fixture.componentInstance.parse.subscribe((text) => emitted.push(text));
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  function button(): HTMLButtonElement {
    return element.querySelector('button[type="submit"]') as HTMLButtonElement;
  }

  it('is disabled until there is text, then emits the trimmed description', async () => {
    expect(button().disabled).toBe(true);

    typeInto(element, '#trip-description', '   ');
    await fixture.whenStable();
    expect(button().disabled).toBe(true);

    typeInto(element, '#trip-description', '  Berlin to Vienna tomorrow ');
    await fixture.whenStable();
    expect(button().disabled).toBe(false);

    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    expect(emitted).toEqual(['Berlin to Vienna tomorrow']);
  });

  it('shows progress while the advisor reads the text', async () => {
    typeInto(element, '#trip-description', 'Berlin to Vienna');
    fixture.componentRef.setInput('busy', true);
    await fixture.whenStable();

    expect(button().disabled).toBe(true);
    expect(button().textContent).toContain('Reading…');
  });

  it('announces the result with its source and warnings', async () => {
    fixture.componentRef.setInput('draft', DRAFT);
    await fixture.whenStable();

    const status = element.querySelector('[role="status"]');
    expect(status?.textContent).toContain('Form filled in from your description');
    expect(status?.querySelector('.badge')?.textContent).toBe('Rule-based');
    expect(status?.querySelector('li')?.textContent).toBe('Fewer than two stops recognised.');
  });

  it('confirms a draft without warnings and labels AI drafts', async () => {
    fixture.componentRef.setInput('draft', { ...DRAFT, source: 'AI', warnings: [] });
    await fixture.whenStable();

    const status = element.querySelector('[role="status"]');
    expect(status?.querySelector('.badge')?.textContent).toBe('AI advisor');
    expect(status?.textContent).toContain('Check the details below');
    expect(status?.querySelector('ul')).toBeNull();
  });

  it('shows a failure instead of a stale result', async () => {
    fixture.componentRef.setInput('draft', DRAFT);
    fixture.componentRef.setInput(
      'error',
      new ApiError(0, 'API unreachable', 'Cannot reach the API.'),
    );
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('API unreachable');
    expect(element.querySelector('[role="status"]')).toBeNull();
  });
});

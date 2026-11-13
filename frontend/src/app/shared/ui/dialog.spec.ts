import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Dialog } from './dialog';
import { installDialogSupport, pressEscapeIn } from './dialog.testing';

@Component({
  imports: [Dialog],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    <h1 id="fallback" tabindex="-1" #fallback>Page</h1>
    <app-dialog
      title="Delete trip?"
      [open]="open()"
      [busy]="busy()"
      [fallbackFocus]="fallback"
      (confirmed)="confirmed = confirmed + 1"
      (cancelled)="open.set(false); cancelled = cancelled + 1"
    >
      <p>Berlin to Vienna will be removed.</p>
    </app-dialog>
  `,
})
class Host {
  readonly open = signal(false);
  readonly busy = signal(false);
  confirmed = 0;
  cancelled = 0;
}

describe('Dialog', () => {
  let fixture: ComponentFixture<Host>;
  let root: HTMLElement;

  beforeEach(async () => {
    installDialogSupport();
    fixture = TestBed.createComponent(Host);
    root = fixture.nativeElement as HTMLElement;
    document.body.append(root); // focus only works on attached elements
    await fixture.whenStable();
  });

  afterEach(() => root.remove());

  const dialog = () => root.querySelector('dialog') as HTMLDialogElement;
  const opener = () => root.querySelector('#opener') as HTMLButtonElement;
  const button = (name: string) =>
    Array.from(dialog().querySelectorAll('button')).find((b) => b.textContent?.includes(name))!;

  async function openDialog(): Promise<void> {
    opener().focus();
    opener().click();
    await fixture.whenStable();
  }

  it('renders nothing while closed', () => {
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(dialog().textContent?.trim()).toBe('');
  });

  it('opens modally with its title and text, labelled by the title, focus on Cancel', async () => {
    await openDialog();

    expect(dialog().hasAttribute('open')).toBe(true);
    const title = dialog().querySelector('h2')!;
    expect(title.textContent).toBe('Delete trip?');
    expect(dialog().getAttribute('aria-labelledby')).toBe(title.id);
    expect(dialog().textContent).toContain('Berlin to Vienna will be removed.');
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('confirms with the danger button and cancels with Cancel', async () => {
    await openDialog();

    expect(button('Delete').classList.contains('button--danger')).toBe(true);
    button('Delete').click();
    expect(fixture.componentInstance.confirmed).toBe(1);
    expect(fixture.componentInstance.cancelled).toBe(0);

    button('Cancel').click();
    await fixture.whenStable();
    expect(fixture.componentInstance.cancelled).toBe(1);
    expect(dialog().hasAttribute('open')).toBe(false);
  });

  it('cancels on Escape and returns focus to the element that opened it', async () => {
    await openDialog();

    pressEscapeIn(dialog());
    await fixture.whenStable();

    expect(fixture.componentInstance.cancelled).toBe(1);
    expect(fixture.componentInstance.confirmed).toBe(0);
    expect(dialog().hasAttribute('open')).toBe(false);
    expect(document.activeElement).toBe(opener());
  });

  it('cancels on a click on the backdrop but not on the dialog body', async () => {
    await openDialog();

    dialog().querySelector<HTMLElement>('.dialog__body')!.click();
    expect(fixture.componentInstance.cancelled).toBe(0);

    dialog().click();
    await fixture.whenStable();
    expect(fixture.componentInstance.cancelled).toBe(1);
  });

  it('cannot be dismissed while busy and shows the busy label', async () => {
    await openDialog();
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();

    expect(button('Deleting…').disabled).toBe(true);
    expect(button('Cancel').disabled).toBe(true);
    pressEscapeIn(dialog());
    dialog().click();
    await fixture.whenStable();

    expect(dialog().hasAttribute('open')).toBe(true);
    expect(fixture.componentInstance.cancelled).toBe(0);
  });

  it('moves focus to the fallback when the element that opened it is gone', async () => {
    await openDialog();
    opener().remove();

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(root.querySelector('#fallback'));
  });

  it('opens again if the browser closes it while an answer is pending', async () => {
    await openDialog();
    fixture.componentInstance.busy.set(true);
    await fixture.whenStable();

    dialog().close();

    expect(dialog().hasAttribute('open')).toBe(true);
    expect(fixture.componentInstance.cancelled).toBe(0);
  });
});

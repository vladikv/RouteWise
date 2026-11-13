import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installDialogSupport } from './dialog.testing';
import { Modal } from './modal';

@Component({
  imports: [Modal],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Open</button>
    <app-modal [open]="open()" title="Shortcuts" (closed)="open.set(false); closes = closes + 1">
      @if (withAutofocus()) {
        <input data-autofocus aria-label="Query" />
      }
      <p>Body</p>
    </app-modal>
  `,
})
class ModalHost {
  readonly open = signal(false);
  readonly withAutofocus = signal(false);
  closes = 0;
}

describe('Modal', () => {
  let fixture: ComponentFixture<ModalHost>;
  let element: HTMLElement;
  const dialog = () => element.querySelector('dialog') as HTMLDialogElement;
  const opener = () => element.querySelector('#opener') as HTMLButtonElement;

  beforeEach(async () => {
    installDialogSupport();
    fixture = TestBed.createComponent(ModalHost);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  async function openFromButton(): Promise<void> {
    opener().focus();
    opener().click();
    await fixture.whenStable();
  }

  it('opens as a modal labelled by its title and focuses the close button', async () => {
    await openFromButton();

    expect(dialog().open).toBe(true);
    const title = dialog().querySelector('h2')!;
    expect(title.textContent).toBe('Shortcuts');
    expect(dialog().getAttribute('aria-labelledby')).toBe(title.id);
    expect(document.activeElement).toBe(dialog().querySelector('button[aria-label="Close"]'));
  });

  it('focuses the element marked data-autofocus instead', async () => {
    fixture.componentInstance.withAutofocus.set(true);
    await openFromButton();

    expect(document.activeElement).toBe(dialog().querySelector('input'));
  });

  it('asks to close on Escape, the close button and a backdrop click, then returns focus', async () => {
    await openFromButton();
    const escape = new Event('cancel', { cancelable: true });
    dialog().dispatchEvent(escape);
    await fixture.whenStable();
    expect(escape.defaultPrevented).toBe(true);
    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener());

    await openFromButton();
    dialog().querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    await fixture.whenStable();

    await openFromButton();
    // A text selection that starts in the panel and ends on the backdrop does not close it.
    dialog()
      .querySelector('p')!
      .dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog().click();
    expect(fixture.componentInstance.closes).toBe(2);
    dialog().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog().click();
    await fixture.whenStable();

    expect(fixture.componentInstance.closes).toBe(3);
    expect(dialog().open).toBe(false);
  });

  it('returns focus to the main area when the element that opened it is gone', async () => {
    const main = document.createElement('main');
    main.id = 'main';
    main.tabIndex = -1;
    document.body.appendChild(main);
    await openFromButton();
    const link = document.createElement('a');
    link.href = '#';
    element.appendChild(link);
    opener().remove();

    fixture.componentInstance.open.set(false);
    await fixture.whenStable();

    expect(document.activeElement).toBe(main);
    main.remove();
  });
});

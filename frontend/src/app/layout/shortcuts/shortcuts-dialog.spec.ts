import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { installDialogSupport, pressEscapeIn } from '../../shared/ui/dialog.testing';
import { SHORTCUT_GROUPS, ShortcutsDialog } from './shortcuts-dialog';

@Component({
  imports: [ShortcutsDialog],
  template: `
    <button type="button" id="opener" (click)="open.set(true)">Shortcuts</button>
    <app-shortcuts-dialog [open]="open()" (closed)="open.set(false)" />
  `,
})
class Host {
  readonly open = signal(false);
}

describe('ShortcutsDialog', () => {
  let fixture: ComponentFixture<Host>;
  let element: HTMLElement;
  const dialog = () => element.querySelector('dialog') as HTMLDialogElement;
  const opener = () => element.querySelector('#opener') as HTMLButtonElement;

  beforeEach(async () => {
    installDialogSupport();
    fixture = TestBed.createComponent(Host);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    opener().focus();
    opener().click();
    await fixture.whenStable();
  });

  it('is a titled dialog that lists every group with its keys and actions', () => {
    expect(dialog().open).toBe(true);
    expect(dialog().querySelector('h2')?.textContent).toBe('Keyboard shortcuts');
    const headings = Array.from(dialog().querySelectorAll('h3')).map((h) => h.textContent);
    expect(headings).toEqual(SHORTCUT_GROUPS.map((group) => group.title));
    expect(headings).toEqual(['Everywhere', 'Globe', 'Search and pickers', 'Trips list']);

    const rows = Array.from(dialog().querySelectorAll('.row'));
    expect(rows).toHaveLength(SHORTCUT_GROUPS.flatMap((group) => group.shortcuts).length);
    const search = rows.find((row) => row.textContent?.includes('Search cities and trips'))!;
    expect(Array.from(search.querySelectorAll('kbd')).map((key) => key.textContent)).toEqual([
      'Ctrl',
      'K',
    ]);
    expect(dialog().textContent).toContain('Show this list');
  });

  it('closes with Escape and gives focus back to the opener', async () => {
    pressEscapeIn(dialog());
    await fixture.whenStable();

    expect(dialog().open).toBe(false);
    expect(document.activeElement).toBe(opener());
  });

  it('closes with the close button', async () => {
    dialog().querySelector<HTMLButtonElement>('button[aria-label="Close"]')!.click();
    await fixture.whenStable();

    expect(dialog().open).toBe(false);
  });
});

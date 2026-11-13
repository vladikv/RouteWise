/**
 * jsdom has no `showModal()`/`close()` on `<dialog>`. Call this in specs that render a `Dialog`;
 * the stand-ins only toggle `open` and fire `close`, which is all the component relies on.
 */
export function installDialogSupport(): void {
  const proto = HTMLDialogElement.prototype;
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto.close = function (this: HTMLDialogElement) {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    }
  };
}

/** What a browser does on Escape: a cancelable `cancel` event, then closing unless it was prevented. */
export function pressEscapeIn(dialog: HTMLDialogElement): void {
  const event = new Event('cancel', { cancelable: true });
  dialog.dispatchEvent(event);
  if (!event.defaultPrevented) {
    dialog.close();
  }
}

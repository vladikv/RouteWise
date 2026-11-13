import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Placeholder for the Modes page; the mode comparison moves here from Home in a later step. */
@Component({
  selector: 'app-modes-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Modes</h1>
    <p class="muted">How train, bus, car, bike and plane compare is coming to this page.</p>
  `,
})
export class ModesPage {}

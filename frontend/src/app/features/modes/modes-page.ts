import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TransportModeApi } from '../../core/api/transport-mode-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { ModeCard } from './mode-card';
import { ModeChart } from './mode-chart';

/** The transport modes and the parameters every comparison uses: a card per mode and a chart. */
@Component({
  selector: 'app-modes-page',
  imports: [ErrorMessage, ModeCard, ModeChart, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modes-page.html',
  styleUrl: './modes-page.scss',
})
export class ModesPage {
  private readonly transportModeApi = inject(TransportModeApi);

  protected readonly modes = rxResource({ stream: () => this.transportModeApi.findAll() });
}

import { CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TransportModeApi } from '../../core/api/transport-mode-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';
import { RouteExplorer } from '../explore/route-explorer';

/** Landing page: the route explorer, and the mode parameters every comparison uses. */
@Component({
  selector: 'app-home-page',
  imports: [
    CurrencyPipe,
    DecimalPipe,
    TitleCasePipe,
    RouterLink,
    ErrorMessage,
    RouteExplorer,
    Spinner,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly transportModeApi = inject(TransportModeApi);

  protected readonly modes = rxResource({ stream: () => this.transportModeApi.findAll() });
}

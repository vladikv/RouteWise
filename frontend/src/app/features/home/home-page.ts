import { CurrencyPipe, DecimalPipe, TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { TransportModeApi } from '../../core/api/transport-mode-api';
import { ErrorMessage } from '../../shared/ui/error-message';
import { Spinner } from '../../shared/ui/spinner';

/** Landing page: what RouteWise does and the mode parameters it compares with. */
@Component({
  selector: 'app-home-page',
  imports: [CurrencyPipe, DecimalPipe, TitleCasePipe, ErrorMessage, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {
  private readonly transportModeApi = inject(TransportModeApi);

  protected readonly modes = rxResource({ stream: () => this.transportModeApi.findAll() });
}

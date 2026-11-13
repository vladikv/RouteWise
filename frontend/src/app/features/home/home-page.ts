import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouteExplorer } from '../explore/route-explorer';

/** Landing page: the route explorer. The mode parameters live on the Modes page. */
@Component({
  selector: 'app-home-page',
  imports: [RouteExplorer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<app-route-explorer class="home-stage" />',
})
export class HomePage {}

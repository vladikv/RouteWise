import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';
import { LoginRequest } from '../api/models';

/** The public demo account offered on the login page, or `null` when there is none. */
export const DEMO_ACCOUNT = new InjectionToken<LoginRequest | null>('DEMO_ACCOUNT', {
  providedIn: 'root',
  factory: () => environment.demoAccount,
});

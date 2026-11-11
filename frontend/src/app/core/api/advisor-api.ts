import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TripDraft } from './models';

@Injectable({ providedIn: 'root' })
export class AdvisorApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/advisor`;

  /** Turns a free-text trip request into a draft for the trip form. Nothing is stored. */
  parse(text: string): Observable<TripDraft> {
    return this.http.post<TripDraft>(`${this.url}/parse`, { text });
  }
}

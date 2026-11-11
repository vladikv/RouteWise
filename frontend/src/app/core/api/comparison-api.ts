import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { Comparison, ComparisonRequest } from './models';

@Injectable({ providedIn: 'root' })
export class ComparisonApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/comparisons`;

  /** Compares modes for a route without saving a trip. */
  preview(request: ComparisonRequest): Observable<Comparison> {
    return this.http.post<Comparison>(this.url, request);
  }
}

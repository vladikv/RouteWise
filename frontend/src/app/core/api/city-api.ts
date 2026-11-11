import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { City } from './models';

@Injectable({ providedIn: 'root' })
export class CityApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/cities`;

  /** All cities by name, or only those whose name contains `query`. */
  findAll(query?: string): Observable<City[]> {
    const trimmed = query?.trim();
    const params = trimmed ? new HttpParams().set('q', trimmed) : undefined;
    return this.http.get<City[]>(this.url, { params });
  }
}

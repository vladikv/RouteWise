import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { Advice, Comparison, Trip, TripPage, TripRequest, TripSearch, TripStats } from './models';

/** Saved trips and their computed comparison and advice. */
@Injectable({ providedIn: 'root' })
export class TripApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/trips`;

  /** Search, filters, sorting and paging run in the API; empty values are not sent. */
  search(query: TripSearch = {}): Observable<TripPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      for (const item of Array.isArray(value) ? value : [value]) {
        if (item !== undefined && item !== null && item !== '') {
          params = params.append(key, String(item));
        }
      }
    }
    return this.http.get<TripPage>(this.url, { params });
  }

  /** Key figures over all of the user's trips. */
  stats(): Observable<TripStats> {
    return this.http.get<TripStats>(`${this.url}/stats`);
  }

  findById(id: number): Observable<Trip> {
    return this.http.get<Trip>(`${this.url}/${id}`);
  }

  create(request: TripRequest): Observable<Trip> {
    return this.http.post<Trip>(this.url, request);
  }

  update(id: number, request: TripRequest): Observable<Trip> {
    return this.http.put<Trip>(`${this.url}/${id}`, request);
  }

  /** Soft delete: the trip can be restored for a short while (409 afterwards). */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
  }

  /** Undoes a delete within the API's restore window. */
  restore(id: number): Observable<Trip> {
    return this.http.post<Trip>(`${this.url}/${id}/restore`, null);
  }

  /** Weather-aware mode comparison with a recommendation. */
  compare(id: number): Observable<Comparison> {
    return this.http.get<Comparison>(`${this.url}/${id}/comparison`);
  }

  /** AI or rule-based explanation of the recommendation. */
  advise(id: number): Observable<Advice> {
    return this.http.get<Advice>(`${this.url}/${id}/advice`);
  }
}

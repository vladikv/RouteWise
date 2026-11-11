import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { Advice, Comparison, Trip, TripRequest } from './models';

/** Saved trips and their computed comparison and advice. */
@Injectable({ providedIn: 'root' })
export class TripApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/trips`;

  findAll(): Observable<Trip[]> {
    return this.http.get<Trip[]>(this.url);
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

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.url}/${id}`);
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

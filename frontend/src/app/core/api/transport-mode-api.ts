import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-config';
import { TransportMode } from './models';

@Injectable({ providedIn: 'root' })
export class TransportModeApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_BASE_URL)}/api/transport-modes`;

  findAll(): Observable<TransportMode[]> {
    return this.http.get<TransportMode[]>(this.url);
  }
}

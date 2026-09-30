import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of, shareReplay } from 'rxjs';

import type { TierListResponse } from '../../../contracts/tier-list.model';

@Injectable({ providedIn: 'root' })
export class HomeTierListService {
  private readonly http = inject(HttpClient);
  private readonly tierList$ = this.http.get<TierListResponse | null>(
    '/api/tier-list?rank=99',
  ).pipe(
    catchError(() => of(null)),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  getLatestAllRanks(): Observable<TierListResponse | null> {
    return this.tierList$;
  }
}

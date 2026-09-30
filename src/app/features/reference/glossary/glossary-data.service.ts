import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, of } from 'rxjs';

import { GlossaryTerm } from './glossary.model';

@Injectable({ providedIn: 'root' })
export class GlossaryDataService {
  private readonly http = inject(HttpClient);

  getTerms(): Observable<GlossaryTerm[]> {
    return this.http.get<GlossaryTerm[]>('/api/glossary').pipe(
      catchError(() => of([])),
    );
  }
}

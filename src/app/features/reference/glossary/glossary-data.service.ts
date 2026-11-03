import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { GlossaryTerm } from './glossary.model';

@Injectable({ providedIn: 'root' })
export class GlossaryDataService {
  private readonly http = inject(HttpClient);

  /** The terms, or an error: a failed request is not an empty glossary, so the page can say which it is. */
  getTerms(): Observable<GlossaryTerm[]> {
    return this.http.get<GlossaryTerm[]>('/api/glossary');
  }
}

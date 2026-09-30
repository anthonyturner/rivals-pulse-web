import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

import {
  SEASON_9_WEEK_1_REPORT,
  type WinRateReportSnapshot,
} from './season-9-week-1.data';
import { SEASON_9_WEEK_2_REPORT } from './season-9-week-2.data';

@Injectable({ providedIn: 'root' })
export class SeasonWinRatesService {
  private readonly reportsBySeason = new Map<number, readonly WinRateReportSnapshot[]>([
    [9, [SEASON_9_WEEK_1_REPORT, SEASON_9_WEEK_2_REPORT]],
  ]);

  getReports(season: number): Observable<readonly WinRateReportSnapshot[]> {
    return of(this.reportsBySeason.get(season) ?? []);
  }
}

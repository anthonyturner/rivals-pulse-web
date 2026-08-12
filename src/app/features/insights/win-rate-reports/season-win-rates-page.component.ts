import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';

import {
  ReportHeroComponent,
  type ReportHeroAction,
  type ReportHeroMedia,
} from '../../../shared/components/report-hero/report-hero.component';
import {
  type CompetitiveRank,
  type WinRateCoreRole,
  type WinRateReportSnapshot,
  type WinRateTrend,
} from './season-9-week-1.data';
import { SeasonWinRatesService } from './season-win-rates.service';

type RoleFilter = WinRateCoreRole | 'All';
type TrendFilter = WinRateTrend | 'All';

const CURRENT_SEASON = 9;

@Component({
  selector: 'app-season-win-rates-page',
  imports: [ReportHeroComponent, RouterLink],
  templateUrl: './season-win-rates-page.component.html',
  styleUrl: './season-win-rates-page.component.css',
})
export class SeasonWinRatesPageComponent {
  private readonly reportService = inject(SeasonWinRatesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly availableSeasons = Array.from(
    { length: CURRENT_SEASON + 1 },
    (_, index) => CURRENT_SEASON - index,
  );
  readonly season = signal(CURRENT_SEASON);
  readonly reports = signal<readonly WinRateReportSnapshot[]>([]);
  readonly selectedWeek = signal(1);
  readonly report = computed(
    () =>
      this.reports().find((report) => report.week === this.selectedWeek()) ??
      this.reports().at(-1) ??
      null,
  );
  readonly availableWeeks = computed(() => this.reports().map((report) => report.week));
  readonly reportHeroActions = computed<readonly ReportHeroAction[]>(() => {
    const report = this.report();

    return report
      ? [
          {
            label: 'Watch the source video',
            href: report.sourceUrl,
            primary: true,
          },
          {
            label: 'Open the hero roster',
            routerLink: '/heroes',
          },
        ]
      : [];
  });
  readonly reportHeroMedia = computed<ReportHeroMedia | null>(() => {
    const report = this.report();

    return report
      ? {
          kind: 'video',
          videoId: report.videoId,
          label: 'Nerfpool',
          title: report.sourceLabel,
          meta: `${report.duration} roster and meta breakdown`,
        }
      : null;
  });
  readonly metaQuadrants = computed(() => this.report()?.metaQuadrants ?? []);
  readonly roleLadder = computed(() => this.report()?.roleLadder ?? []);
  readonly oneTricks = computed(() => this.report()?.oneTricks ?? []);
  readonly roleFilters: readonly RoleFilter[] = ['All', 'Vanguard', 'Strategist', 'Duelist'];
  readonly trendFilters: readonly TrendFilter[] = [
    'All',
    'Climbing',
    'Stable',
    'Falling',
    'Volatile',
  ];

  readonly selectedRole = signal<RoleFilter>('All');
  readonly selectedTrend = signal<TrendFilter>('All');
  readonly searchTerm = signal('');

  readonly filteredInsights = computed(() => {
    const role = this.selectedRole();
    const trend = this.selectedTrend();
    const query = this.searchTerm().trim().toLowerCase();

    return (this.report()?.heroInsights ?? []).filter((insight) => {
      const matchesRole = role === 'All' || insight.role === role;
      const matchesTrend = trend === 'All' || insight.trend === trend;
      const matchesQuery =
        !query ||
        insight.displayName.toLowerCase().includes(query) ||
        insight.archetype.toLowerCase().includes(query) ||
        insight.takeaway.toLowerCase().includes(query);

      return matchesRole && matchesTrend && matchesQuery;
    });
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => this.parseSeason(params.get('season'))),
        tap((season) => this.season.set(season)),
        switchMap((season) => this.reportService.getReports(season)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((reports) => {
        this.reports.set(reports);
        this.selectedWeek.set(reports.at(-1)?.week ?? 1);
      });
  }

  selectSeason(event: Event): void {
    const season = Number((event.target as HTMLSelectElement).value);
    void this.router.navigate(['/win-rates', season]);
  }

  selectWeek(event: Event): void {
    this.selectedWeek.set(Number((event.target as HTMLSelectElement).value));
  }

  selectRole(role: RoleFilter): void {
    this.selectedRole.set(role);
  }

  selectTrend(trend: TrendFilter): void {
    this.selectedTrend.set(trend);
  }

  updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  rankTone(percentage: number | null): string {
    if (percentage === null) {
      return 'unavailable';
    }

    if (percentage >= 55) {
      return 'elite';
    }

    if (percentage >= 50) {
      return 'positive';
    }

    if (percentage >= 45) {
      return 'negative';
    }

    return 'critical';
  }

  rankIconUrl(rank: CompetitiveRank): string {
    return `/images/ranks/${rank.toLowerCase()}.png`;
  }

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/images/heroes/default-hero.png';
  }

  private parseSeason(value: string | null): number {
    const season = Number(value);

    return Number.isInteger(season) && season >= 0 ? season : CURRENT_SEASON;
  }
}

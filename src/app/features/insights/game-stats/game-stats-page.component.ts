import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import type {
  GameComparison,
  GameSnapshotComparison,
  GameStatsResponse,
  MetricComparison,
  RankComparison,
} from '../../../../contracts/game-stats.model';

interface Milestone {
  value: string;
  label: string;
  detail: string;
}

@Component({
  selector: 'app-game-stats-page',
  imports: [CommonModule],
  templateUrl: './game-stats-page.component.html',
  styleUrl: './game-stats-page.component.css',
})
export class GameStatsPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  private readonly fallbackStats: GameStatsResponse = {
    snapshotDate: 'June 19, 2026',
    fetchedAt: 'Static snapshot',
    currentPlayerSource: 'Valve ISteamUserStats GetNumberOfCurrentPlayers',
    currentPlayerSourceUrl: 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/',
    snapshot: {
      snapshotDate: 'June 19, 2026',
      capturedAt: '2026-06-19T00:00:00.000Z',
      persisted: false,
    },
    games: [
      {
        appId: 2767030,
        name: 'Marvel Rivals',
        category: 'Hero shooter',
        currentPlayers: 59562,
        dailyPeak: 118674,
        allTimePeak: 644269,
        steamDailyRank: '#15',
        topSellerRank: '#4',
        twitchViewers: 24451,
        reviewSummary: 'Mostly Positive, 75.74% SteamDB rating, 394k reviews',
        sourceUrl: 'https://steamdb.info/app/2767030/charts/',
      },
      {
        appId: 2357570,
        name: 'Overwatch',
        category: 'Hero shooter',
        currentPlayers: 56818,
        dailyPeak: 81755,
        allTimePeak: 165651,
        steamDailyRank: '#14',
        topSellerRank: '#19',
        twitchViewers: 34794,
        reviewSummary: 'Mostly Negative, 30.94% SteamDB rating, 407k reviews',
        sourceUrl: 'https://steamdb.info/app/2357570/charts/',
      },
      {
        appId: 1172470,
        name: 'Apex Legends',
        category: 'Battle royale shooter',
        currentPlayers: 121009,
        dailyPeak: 194956,
        allTimePeak: 624473,
        steamDailyRank: '#8',
        topSellerRank: '#18',
        twitchViewers: 13672,
        reviewSummary: 'Mixed, 67.41% SteamDB rating, 1.05M reviews',
        sourceUrl: 'https://steamdb.info/app/1172470/charts/',
      },
      {
        appId: 570,
        name: 'Dota 2',
        category: 'MOBA',
        currentPlayers: 382833,
        dailyPeak: 609443,
        allTimePeak: 1295114,
        steamDailyRank: '#2',
        topSellerRank: '#40',
        twitchViewers: 39955,
        reviewSummary: 'Very Positive, 80.38% SteamDB rating, 2.72M reviews',
        sourceUrl: 'https://steamdb.info/app/570/charts/',
      },
      {
        appId: 730,
        name: 'Counter-Strike 2',
        category: 'Tactical shooter',
        currentPlayers: 854652,
        dailyPeak: 1374512,
        allTimePeak: 1862531,
        steamDailyRank: '#1',
        topSellerRank: '#3',
        twitchViewers: 0,
        reviewSummary: 'Very Positive, 85.83% SteamDB rating, 9.67M reviews',
        sourceUrl: 'https://steamdb.info/app/730/charts/',
      },
    ],
  };

  readonly gameStats = signal<GameStatsResponse>(this.fallbackStats);
  readonly snapshotDate = computed(() => this.gameStats().snapshotDate);
  readonly fetchedAt = computed(() => this.formatFetchedAt(this.gameStats().fetchedAt));
  readonly previousSnapshotLabel = computed(() => {
    const previous = this.gameStats().previousSnapshot;

    return previous ? this.formatFetchedAt(previous.capturedAt) : undefined;
  });
  readonly comparisons = computed(() => this.gameStats().games);
  readonly marvelRivals = computed(() =>
    this.comparisons().find((game) => game.name === 'Marvel Rivals') ?? this.fallbackStats.games[0],
  );

  readonly milestones: Milestone[] = [
    {
      value: '10M',
      label: 'Players in 72 hours',
      detail: 'Launch momentum hit mainstream scale almost immediately after release.',
    },
    {
      value: '20M',
      label: 'Players by December 17, 2024',
      detail: 'The player base doubled quickly after the first launch weekend.',
    },
    {
      value: '40M+',
      label: 'Players by February 2025',
      detail: 'NetEase-reported worldwide player milestone across platforms.',
    },
    {
      value: '#4',
      label: 'Steam top sellers snapshot',
      detail: 'SteamDB listed Marvel Rivals at #4 in top sellers in the June 19, 2026 snapshot.',
    },
  ];

  readonly sourceLinks = [
    {
      label: 'Live Steam current players API',
      url: 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=2767030',
    },
    {
      label: 'Marvel Rivals SteamDB',
      url: 'https://steamdb.info/app/2767030/charts/',
    },
    {
      label: 'Steam most played',
      url: 'https://store.steampowered.com/charts/mostplayed',
    },
    {
      label: 'Marvel Rivals background metrics',
      url: 'https://en.wikipedia.org/wiki/Marvel_Rivals',
    },
  ];

  ngOnInit(): void {
    this.http.get<GameStatsResponse>('/api/game-stats').pipe(
      catchError((error) => {
        console.error('Failed to load live game stats', error);

        return of(this.fallbackStats);
      }),
    ).subscribe((stats) => this.gameStats.set(stats));
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US').format(value);
  }

  retentionRatio(game: GameComparison): number {
    return Math.round((game.dailyPeak / game.allTimePeak) * 100);
  }

  marvelComparisonRatio(game: GameComparison): number {
    return Math.round((this.marvelRivals().dailyPeak / game.dailyPeak) * 100);
  }

  formatMetricChange(comparison: MetricComparison): string {
    if (comparison.change === 0) {
      return `Unchanged from ${this.formatNumber(comparison.previous)}`;
    }

    const sign = comparison.change > 0 ? '+' : '-';
    const percentage = comparison.changePercent === undefined
      ? ''
      : ` (${sign}${Math.abs(comparison.changePercent).toFixed(2)}%)`;

    return `${sign}${this.formatNumber(Math.abs(comparison.change))}${percentage} vs previous`;
  }

  formatRankChange(comparison: RankComparison): string {
    const positions = comparison.positionsChanged;

    if (!positions) {
      return `Unchanged from ${comparison.previous}`;
    }

    const direction = positions > 0 ? 'Improved' : 'Slipped';
    const count = Math.abs(positions);

    return `${direction} ${count} ${count === 1 ? 'place' : 'places'} from ${comparison.previous}`;
  }

  trendClass(comparison: MetricComparison | RankComparison): string {
    return `trend-${comparison.trend}`;
  }

  comparisonRead(game: GameComparison): string {
    if (game.comparison) {
      return game.comparison.read;
    }

    return game.name === this.marvelRivals().name
      ? 'Baseline; waiting for another stored snapshot.'
      : `Rivals is ${this.marvelComparisonRatio(game)}% of this 24h peak; waiting for snapshot history.`;
  }

  metricComparison(
    game: GameComparison,
    metric: keyof Pick<GameSnapshotComparison, 'currentPlayers' | 'dailyPeak' | 'allTimePeak'>,
  ): MetricComparison | undefined {
    return game.comparison?.[metric];
  }

  private formatFetchedAt(value: string): string {
    if (value === 'Static snapshot') {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }
}

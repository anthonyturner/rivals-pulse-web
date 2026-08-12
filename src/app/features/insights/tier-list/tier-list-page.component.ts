import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';

import { TierListResponse } from '../../../../contracts/tier-list.model';

@Component({
  selector: 'app-tier-list-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './tier-list-page.component.html',
  styleUrl: './tier-list-page.component.css',
})
export class TierListPageComponent implements OnInit {
  private readonly http = inject(HttpClient);

  readonly tierList = signal<TierListResponse | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly selectedSeasonId = signal<number | undefined>(undefined);
  readonly selectedRankFilter = signal('5+');

  readonly selectedSeason = computed(() => {
    const tierList = this.tierList();

    return tierList?.seasons.find((season) => season.id === tierList.selectedSeasonId);
  });

  ngOnInit(): void {
    this.loadTierList();
  }

  loadTierList(): void {
    this.isLoading.set(true);

    let params = new HttpParams()
      .set('rank', this.selectedRankFilter())
      .set('dataVersion', 'season-9');
    const seasonId = this.selectedSeasonId();

    if (seasonId) {
      params = params.set('season', String(seasonId));
    }

    this.http.get<TierListResponse | null>('/api/tier-list', { params }).pipe(
      catchError((error) => {
        console.error('Failed to load tier list', error);

        return of(undefined);
      }),
    ).subscribe((tierList) => {
      this.tierList.set(tierList ?? undefined);
      this.selectedSeasonId.set(tierList?.selectedSeasonId);
      this.selectedRankFilter.set(tierList?.selectedRankFilter ?? '5+');
      this.isLoading.set(false);
    });
  }

  updateSeason(value: string): void {
    this.selectedSeasonId.set(Number(value));
    this.loadTierList();
  }

  updateRank(value: string): void {
    this.selectedRankFilter.set(value);
    this.loadTierList();
  }

  formatRate(value: number): string {
    return `${value.toFixed(2)}%`;
  }

  formatDate(value: string | undefined): string {
    if (!value) {
      return 'Unknown';
    }

    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
    }).format(new Date(value));
  }

  handleImageError(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/images/heroes/default-hero.png';
  }
}

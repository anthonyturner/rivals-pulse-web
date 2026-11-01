import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { TierHeroView, TierRowView } from '../tier-list/tier-list-view';
import { TierRowsComponent } from './tier-rows.component';

function hero(id: string, name: string): TierHeroView {
  return {
    hero: id,
    name,
    role: 'Duelist',
    imageUrl: `/images/heroes/${id}.png`,
    winRateLabel: '66.7%',
    pickRateLabel: '10.0%',
    appearancesLabel: '12',
  };
}

const TIERS: TierRowView[] = [
  { name: 'S', heroes: [hero('storm', 'Storm')] },
  { name: 'A', heroes: [] },
];

@Component({
  imports: [TierRowsComponent],
  template: `
    <app-tier-rows id="plain" [tiers]="tiers" />
    <app-tier-rows id="linked" [tiers]="tiers" [linkHeroes]="true" [headingLevel]="3" />
  `,
})
class HostComponent {
  protected readonly tiers = TIERS;
}

describe('TierRowsComponent', () => {
  let element: HTMLElement;
  const rows = (id: string): HTMLElement => element.querySelector(`#${id}`) as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('draws one row per tier with its letter and hero count, and says when a tier is empty', () => {
    const labels = Array.from(rows('plain').querySelectorAll('.tier-label')).map((label) =>
      label.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(labels).toEqual(['Tier S, 1 hero', 'Tier A, 0 heroes']);
    expect(rows('plain').querySelector('.empty-tier')?.textContent).toContain('No heroes in this tier yet.');
  });

  it('colours each row by its tier', () => {
    const [first, second] = Array.from(rows('plain').querySelectorAll('.tier-row'));

    expect(first.classList.contains('tier-S')).toBeTrue();
    expect(second.classList.contains('tier-A')).toBeTrue();
  });

  it('leaves the hero tiles unlinked unless asked to link them', () => {
    expect(rows('plain').querySelector('a')).toBeNull();
    expect(rows('linked').querySelector('a')?.getAttribute('href')).toBe('/heroes?hero=storm');
  });

  it('draws each row heading at the level the page asks for', () => {
    expect(rows('plain').querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('2');
    expect(rows('linked').querySelector('[role="heading"]')?.getAttribute('aria-level')).toBe('3');
  });
});

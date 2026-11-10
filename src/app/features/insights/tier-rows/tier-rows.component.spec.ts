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
  { name: 'A', heroes: [hero('hela', 'Hela')] },
];

@Component({
  imports: [TierRowsComponent],
  template: `
    <app-tier-rows id="plain" [tiers]="tiers" />
    <app-tier-rows id="linked" [tiers]="tiers" [linkHeroes]="true" [headingLevel]="3" />
    <app-tier-rows id="art" [tiers]="tiers" [linkHeroes]="true" artLed />
    <app-tier-rows id="roles" [tiers]="tiers" artLed raised showRoles />
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

  it('draws one row per tier with its letter and hero count', () => {
    const labels = Array.from(rows('plain').querySelectorAll('.tier-label')).map((label) =>
      label.textContent?.replace(/\s+/g, ' ').trim(),
    );

    expect(labels).toEqual(['Tier S, 1 hero', 'Tier A, 1 hero']);
  });

  it('colours each row by its tier', () => {
    const [first, second] = Array.from(rows('plain').querySelectorAll('.tier-row'));

    expect(first.classList.contains('tier-S')).toBeTrue();
    expect(second.classList.contains('tier-A')).toBeTrue();
  });

  it('leaves the hero tiles unlinked unless asked to link them', () => {
    expect(rows('plain').querySelector('a')).toBeNull();
    expect(rows('linked').querySelector('a')?.getAttribute('href')).toBe('/heroes/storm');
  });

  it('draws plain hero tiles unless asked for the art-led look, tinted by the hero role', () => {
    expect(rows('plain').querySelector('app-hero-tile')?.classList).not.toContain('art-led');
    const tile = rows('art').querySelector('app-hero-tile');

    expect(tile?.classList).toContain('art-led');
    expect(tile?.getAttribute('data-role')).toBe('duelist');
  });

  it('draws each row heading at the level the page asks for', () => {
    expect(rows('plain').querySelector('h2.tier-label')).toBeTruthy();
    expect(rows('plain').querySelector('h3')).toBeNull();
    expect(rows('linked').querySelector('h3.tier-label')).toBeTruthy();
    expect(rows('linked').querySelector('h2')).toBeNull();
  });

  it('raises the rows only when asked', () => {
    expect(rows('art').querySelector('.tiers')?.classList).not.toContain('raised');
    expect(rows('roles').querySelector('.tiers')?.classList).toContain('raised');
  });

  it('shows the hero role as a chip only when asked', () => {
    expect(rows('art').querySelector('app-hero-role-chip')).toBeNull();
    expect(rows('roles').querySelector('app-hero-role-chip')?.textContent?.trim()).toBe('Duelist');
  });
});

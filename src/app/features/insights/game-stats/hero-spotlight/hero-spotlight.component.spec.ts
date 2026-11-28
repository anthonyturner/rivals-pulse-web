import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CommunityHeroRow } from '../../../community/community-hero-list/community-hero-list.component';
import { HeroSpotlightComponent } from './hero-spotlight.component';

const HULK: CommunityHeroRow = {
  hero: 'hulk',
  name: 'Hulk',
  role: 'Vanguard',
  imageUrl: '/images/heroes/hulk.png',
  figure: '18.2%',
  sample: '412 games',
};

@Component({
  imports: [HeroSpotlightComponent],
  template: `
    <app-hero-spotlight id="role" heading="Most picked" [hero]="hero" figureLabel="pick rate" />
    <app-hero-spotlight id="bare" heading="Highest win rate" [hero]="bare" figureLabel="win rate" />
  `,
})
class HostComponent {
  hero = HULK;
  bare: CommunityHeroRow = { ...HULK, role: null, sample: undefined };
}

describe('HeroSpotlightComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('is one link to the hero page, named by its words and not by the decorative portrait', () => {
    const link = element.querySelector('#role a') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/heroes/hulk');
    expect(link.textContent?.replace(/\s+/g, ' ').trim()).toBe('Most picked Hulk 18.2% pick rate 412 games Vanguard');
    expect(link.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('tints the tile by the hero role', () => {
    expect(element.querySelector('#role a')?.getAttribute('data-role')).toBe('vanguard');
  });

  it('leaves out the role and the sample a hero does not have, and tints nothing by a guess', () => {
    const link = element.querySelector('#bare a') as HTMLAnchorElement;

    expect(link.hasAttribute('data-role')).toBeFalse();
    expect(link.querySelector('app-hero-role-chip')).toBeNull();
    expect(link.querySelector('.sample')).toBeNull();
  });
});

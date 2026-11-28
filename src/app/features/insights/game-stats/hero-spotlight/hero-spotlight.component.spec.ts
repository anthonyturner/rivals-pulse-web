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
    <app-hero-spotlight id="pending" />
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

  it('loads its portrait at once, as the largest thing above the fold', () => {
    expect(element.querySelector('#role img')?.getAttribute('loading')).toBe('eager');
  });

  it('draws an empty tile, hidden from assistive technology and with no link, while there is no hero', () => {
    const pending = element.querySelector('#pending') as HTMLElement;

    expect(pending.querySelector('a')).toBeNull();
    expect(pending.querySelector('.spot--pending')?.getAttribute('aria-hidden')).toBe('true');
    expect(pending.textContent?.trim()).toBe('');
  });

  it('is as tall as a real tile, so the page does not jump when the hero arrives', () => {
    const real = (element.querySelector('#role .spot') as HTMLElement).getBoundingClientRect();
    const empty = (element.querySelector('#pending .spot') as HTMLElement).getBoundingClientRect();

    expect(empty.height).toBeGreaterThan(0);
    expect(Math.abs(empty.height - real.height)).toBeLessThanOrEqual(1);
  });
});

import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroTileComponent } from './hero-tile.component';

@Component({
  imports: [HeroTileComponent],
  template: `
    <app-hero-tile id="plain" name="Storm" imageUrl="/images/heroes/storm.png"><span class="under">3 games</span></app-hero-tile>
    <app-hero-tile id="linked" name="Hela" imageUrl="/images/heroes/hela.png" heroId="hela">
      <span tileFigure class="aside">70.0%</span>
      <span class="under">20 games</span>
    </app-hero-tile>
  `,
})
class HostComponent {}

describe('HeroTileComponent', () => {
  let element: HTMLElement;
  const tile = (id: string): HTMLElement => element.querySelector(`#${id}`) as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('shows the portrait as decoration and the name as plain text without a hero id', () => {
    expect(tile('plain').querySelector('img')?.getAttribute('alt')).toBe('');
    expect(tile('plain').querySelector('.hero-name')?.textContent?.trim()).toBe('Storm');
    expect(tile('plain').querySelector('a')).toBeNull();
  });

  it('links the name to the hero on the Heroes page when it has a hero id', () => {
    const link = tile('linked').querySelector('a');

    expect(link?.textContent?.trim()).toBe('Hela');
    expect(link?.getAttribute('href')).toBe('/heroes?hero=hela');
  });

  it('places the figure beside the name and the other lines under it', () => {
    expect(tile('linked').querySelector('.head .aside')?.textContent).toBe('70.0%');
    expect(tile('linked').querySelector('.head .under')).toBeNull();
    expect(tile('linked').querySelector('.under')?.textContent).toBe('20 games');
  });
});

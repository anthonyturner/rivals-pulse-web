import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroTileComponent } from './hero-tile.component';

@Component({
  imports: [HeroTileComponent],
  template: `
    <app-hero-tile id="plain" name="Storm" imageUrl="/images/heroes/storm.png"><span class="under">3 games</span></app-hero-tile>
    <app-hero-tile id="picked" name="Thor" imageUrl="/images/heroes/thor.png" selectable selected />
    <app-hero-tile id="art" name="Mantis" imageUrl="/images/heroes/mantis.png" heroId="mantis" artLed role="Strategist" />
    <app-hero-tile id="art-norole" name="Gorr" imageUrl="/images/heroes/gorr.png" artLed />
    <app-hero-tile id="role-only" name="Hulk" imageUrl="/images/heroes/hulk.png" role="Vanguard" />
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
    expect(link?.getAttribute('href')).toBe('/heroes/hela');
  });

  it('places the figure beside the name and the other lines under it', () => {
    expect(tile('linked').querySelector('.head .aside')?.textContent).toBe('70.0%');
    expect(tile('linked').querySelector('.head .under')).toBeNull();
    expect(tile('linked').querySelector('.under')?.textContent).toBe('20 games');
  });

  it('marks a selectable tile and the selected one for styling, and a plain tile as neither', () => {
    expect(tile('plain').classList).not.toContain('selectable');
    expect(tile('picked').classList).toContain('selectable');
    expect(tile('picked').classList).toContain('selected');
  });

  it('keeps the plain tile unless asked for the art-led look', () => {
    expect(tile('plain').classList).not.toContain('art-led');
    expect(tile('plain').classList).not.toContain('linked');
    expect(tile('role-only').hasAttribute('data-role')).toBeFalse();
  });

  it('tints an art-led tile by the hero role and marks a linked one', () => {
    expect(tile('art').classList).toContain('art-led');
    expect(tile('art').classList).toContain('linked');
    expect(tile('art').getAttribute('data-role')).toBe('strategist');
    expect(tile('art').querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('leaves an art-led tile with no role untinted', () => {
    expect(tile('art-norole').classList).toContain('art-led');
    expect(tile('art-norole').hasAttribute('data-role')).toBeFalse();
  });

  it('reads its tint from the shared role colours, and falls back to the accent with no role', () => {
    const value = (target: HTMLElement, name: string): string => getComputedStyle(target).getPropertyValue(name).trim();
    const root = document.documentElement;

    expect(value(tile('art'), '--tile-role-color')).toBe(value(root, '--role-strategist'));
    expect(value(tile('art'), '--tile-role-ink')).toBe(value(root, '--role-strategist-ink'));
    expect(value(tile('art-norole'), '--tile-role-color')).toBe(value(root, '--accent'));
    expect(value(tile('art-norole'), '--tile-role-ink')).toBe(value(root, '--accent-strong'));
  });

  it('swaps a portrait that fails to load for the default hero portrait', () => {
    const image = tile('plain').querySelector('img') as HTMLImageElement;

    image.dispatchEvent(new Event('error'));

    expect(image.src).toContain('/images/heroes/default-hero.png');
  });
});

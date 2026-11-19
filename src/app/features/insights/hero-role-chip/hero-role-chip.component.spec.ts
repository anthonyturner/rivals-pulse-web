import { Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroTileComponent } from '../hero-tile/hero-tile.component';
import { HeroRoleChipComponent } from './hero-role-chip.component';

@Component({
  imports: [HeroRoleChipComponent, HeroTileComponent],
  template: `
    <app-hero-tile id="strategist" name="Mantis" imageUrl="/images/heroes/mantis.png" artLed role="Strategist">
      <app-hero-role-chip role="Strategist" />
    </app-hero-tile>
    <app-hero-tile id="vanguard" name="Hulk" imageUrl="/images/heroes/hulk.png" artLed role="Vanguard">
      <app-hero-role-chip role="Vanguard" />
    </app-hero-tile>
  `,
})
class HostComponent {}

describe('HeroRoleChipComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    element = fixture.nativeElement;
    document.body.append(element);
    fixture.detectChanges();
  });

  afterEach(() => element.remove());

  const chip = (id: string): HTMLElement => element.querySelector(`#${id} app-hero-role-chip`) as HTMLElement;

  it('shows the role it is given', () => {
    expect(chip('strategist').classList).toContain('role-chip');
    expect(chip('strategist').textContent?.trim()).toBe('Strategist');
  });

  it('takes its tint from the art-led tile around it, so each role differs', () => {
    expect(getComputedStyle(chip('strategist')).borderColor).not.toBe(getComputedStyle(chip('vanguard')).borderColor);
  });
});

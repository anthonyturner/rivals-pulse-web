import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';

import type { Hero } from './hero.model';
import { HeroesPageComponent } from './heroes-page.component';

const hero = (id: string, name: string, role: Hero['role']): Hero =>
  ({
    id,
    name,
    role,
    difficulty: 3,
    summary: `${name} summary.`,
    playstyle: '',
    strengths: [],
    weaknesses: [],
    counters: [],
    synergies: [],
    abilities: [],
    imageUrl: `/images/heroes/${id}.png`,
  }) as Hero;

describe('HeroesPageComponent', () => {
  let fixture: ComponentFixture<HeroesPageComponent>;
  let element: HTMLElement;
  let http: HttpTestingController;

  const card = (id: string): HTMLButtonElement => element.querySelector(`[data-hero-id="${id}"]`) as HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(HeroesPageComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  async function loadRoster(): Promise<void> {
    http.match('/api/heroes').forEach((request) =>
      request.flush([hero('mantis', 'Mantis', 'Strategist'), hero('storm', 'Storm', 'Duelist'), hero('thor', 'Thor', 'Vanguard')]),
    );
    http.match('/api/hero-videos').forEach((request) => request.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  it('uses the wide page container and a plain "Heroes" title', async () => {
    await loadRoster();

    expect(element.querySelector('.heroes-page')?.classList).toContain('page-container--wide');
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Heroes');
  });

  it('shows placeholders, not an empty message, until the roster arrives', async () => {
    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelector('.empty-state')).toBeNull();

    await loadRoster();

    expect(element.querySelector('[aria-busy="true"]')).toBeNull();
    expect(element.querySelectorAll('.hero-card').length).toBe(3);
  });

  it('selects the first hero on load and lists the count', async () => {
    await loadRoster();

    expect(card('mantis').getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('[data-testid="hero-count"]')?.textContent?.trim()).toBe('3 heroes');
  });

  it('choosing a card shows its details and moves focus to the hero name without opening the profile window', async () => {
    await loadRoster();

    card('storm').click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(card('storm').getAttribute('aria-pressed')).toBe('true');
    expect(element.querySelector('app-hero-detail-modal')).toBeNull();
    expect(document.activeElement?.tagName).toBe('H2');
    expect(document.activeElement?.textContent?.trim()).toBe('Storm');
  });

  it('"Back to roster" returns focus to the selected hero card', async () => {
    await loadRoster();
    card('storm').click();
    fixture.detectChanges();
    await fixture.whenStable();

    (element.querySelector('.detail-action:not(.detail-action--primary)') as HTMLButtonElement).click();

    expect(document.activeElement).toBe(card('storm'));
  });

  it('opens the profile window from "Open profile" only, and returns focus to that button when it closes', async () => {
    await loadRoster();

    (element.querySelector('[data-testid="open-profile"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('app-hero-detail-modal')).not.toBeNull();

    fixture.componentInstance.closeHeroDetailModal();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('app-hero-detail-modal')).toBeNull();
    expect(document.activeElement).toBe(element.querySelector('[data-testid="open-profile"]'));
  });

  it('hides the detail panel when no hero matches the filters', async () => {
    await loadRoster();

    fixture.componentInstance.updateSearchTerm('zzzz');
    fixture.detectChanges();

    expect(element.querySelector('.empty-state')).not.toBeNull();
    expect(element.querySelector('.hero-detail')).toBeNull();
  });
});

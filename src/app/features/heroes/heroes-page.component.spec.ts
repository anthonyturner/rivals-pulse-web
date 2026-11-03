import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
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

  it('shows the roster and no hero until one is chosen, and lists the count', async () => {
    await loadRoster();

    expect(element.querySelector('.hero-detail')).toBeNull();
    expect(element.querySelector('[aria-current="page"]')).toBeNull();
    expect(element.querySelector('[data-testid="hero-count"]')?.textContent?.trim()).toBe('3 heroes');
  });

  it('renders no profile window or open-profile button, even after Escape', async () => {
    await loadRoster();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('[data-testid="open-profile"]')).toBeNull();
    expect(element.querySelector('[aria-modal="true"]')).toBeNull();
  });

  it('says so, and offers no roster, when the heroes could not be loaded', async () => {
    spyOn(console, 'error');
    http.match('/api/heroes').forEach((request) => request.flush('down', { status: 500, statusText: 'Server Error' }));
    http.match('/api/hero-videos').forEach((request) => request.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.textContent).toContain('Heroes could not be loaded');
    expect(element.querySelector('app-hero-grid')).toBeNull();
    expect(element.querySelector('.empty-state')).toBeNull();
  });

  it('shows the empty message when no hero matches the filters in the address', async () => {
    await loadRoster();

    fixture.componentInstance.updateSearchTerm('zzzz');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(element.querySelector('.empty-state')).not.toBeNull();
    expect(element.querySelector('.hero-detail')).toBeNull();
  });
});

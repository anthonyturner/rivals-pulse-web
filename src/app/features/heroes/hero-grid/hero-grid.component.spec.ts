import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeroGridComponent } from './hero-grid.component';
import { Hero } from '../hero.model';

describe('HeroGridComponent', () => {
  let fixture: ComponentFixture<HeroGridComponent>;
  let component: HeroGridComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroGridComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroGridComponent);
    component = fixture.componentInstance;

    component.heroes = [createHero()];
    component.roles = ['All', 'Vanguard', 'Duelist', 'Strategist'];
    component.selectedRole = 'Vanguard';
    component.searchTerm = 'storm';
    component.gridMode = 'thumbs';
    fixture.detectChanges();
  });

  it('shows a clear-filters action when filters are active and emits a reset event', () => {
    const emitSpy = spyOn(component.filtersReset, 'emit');
    const button = fixture.nativeElement.querySelector('[data-testid="clear-filters"]') as HTMLButtonElement;

    expect(button).not.toBeNull();

    button.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  function createHero(): Hero {
    return {
      id: 'storm',
      name: 'Storm',
      role: 'Vanguard',
      difficulty: 2,
      summary: 'Weather control mage',
      playstyle: 'Control',
      strengths: ['Team control'],
      weaknesses: ['Mobility'],
      counters: [],
      synergies: [],
      abilities: [],
      imageUrl: '/images/heroes/storm.png',
    };
  }
});

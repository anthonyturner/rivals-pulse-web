import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HeroGridComponent } from './hero-grid.component';
import { Hero } from '../hero.model';

describe('HeroGridComponent', () => {
  let fixture: ComponentFixture<HeroGridComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroGridComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroGridComponent);
    element = fixture.nativeElement;

    setInputs({});
  });

  function setInputs(inputs: Partial<Record<string, unknown>>): void {
    const defaults: Record<string, unknown> = {
      heroes: [createHero('storm', 'Storm', 'Vanguard'), createHero('mantis', 'Mantis', 'Strategist')],
      roles: ['All', 'Vanguard', 'Duelist', 'Strategist'],
      selectedRole: 'All',
      selectedHeroId: 'storm',
      searchTerm: '',
      gridMode: 'thumbs',
      ...inputs,
    };

    for (const [name, value] of Object.entries(defaults)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
  }

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('shows a clear-filters action when filters are active and emits a reset event', () => {
    setInputs({ selectedRole: 'Vanguard', searchTerm: 'storm' });
    const emitSpy = spyOn(fixture.componentInstance.filtersReset, 'emit');
    const button = element.querySelector('[data-testid="clear-filters"]') as HTMLButtonElement;

    expect(button).not.toBeNull();

    button.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('hides the clear-filters action while no filter is active', () => {
    expect(element.querySelector('[data-testid="clear-filters"]')).toBeNull();
  });

  it('counts the visible heroes inline in a polite live region', () => {
    const count = element.querySelector('[data-testid="hero-count"]') as HTMLElement;

    expect(text(count)).toBe('2 heroes');
    expect(count.getAttribute('aria-live')).toBe('polite');

    setInputs({ heroes: [createHero('storm', 'Storm', 'Vanguard')] });

    expect(text(count)).toBe('1 hero');
  });

  it('keeps the search label for assistive technology only and has no "Showing" box', () => {
    const label = element.querySelector('.search-field span') as HTMLElement;

    expect(text(label)).toBe('Search heroes');
    expect(label.classList).toContain('visually-hidden');
    expect(text(element)).not.toContain('Showing');
  });

  it('marks the selected card as the current page, and the active role and layout with aria-pressed', () => {
    setInputs({ selectedRole: 'Vanguard' });
    const cards = Array.from(element.querySelectorAll<HTMLAnchorElement>('.hero-card'));
    const pressed = (label: string): string | null =>
      Array.from(element.querySelectorAll('.chip')).find((chip) => text(chip) === label)?.getAttribute('aria-pressed') ??
      null;

    expect(cards.map((card) => card.getAttribute('aria-current'))).toEqual(['page', null]);
    expect(pressed('Vanguard')).toBe('true');
    expect(pressed('All')).toBe('false');
    expect(pressed('Thumbs')).toBe('true');
    expect(pressed('Rows')).toBe('false');
  });

  it('names each card with the hero and the role it is shown under, and hides the decorative image', () => {
    setInputs({ selectedRole: 'Strategist' });
    const [, mantis] = Array.from(element.querySelectorAll<HTMLAnchorElement>('.hero-card'));

    expect(mantis.getAttribute('aria-label')).toBe('Mantis, Strategist');
    expect(mantis.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('shows only the name and role on a thumb card, and adds the summary and archetype in rows mode', () => {
    expect(element.querySelector('.hero-card-summary')).toBeNull();
    expect(element.querySelector('.archetype-label')).toBeNull();

    setInputs({ gridMode: 'rows' });

    expect(text(element.querySelector('.hero-card-summary'))).toBe('Summary of Storm');
    expect(text(element.querySelector('.archetype-label'))).toBe('Brawl');
  });

  it('links each card to its hero, so the address can be shared and opened in a new tab', () => {
    const hrefs = Array.from(element.querySelectorAll('.hero-card')).map((card) => card.getAttribute('href'));

    expect(hrefs).toEqual(['/heroes/storm', '/heroes/mantis']);
  });

  describe('in the column layout', () => {
    beforeEach(() => setInputs({ layout: 'column', gridMode: 'rows' }));

    it('marks the host as a column and keeps the search, role filters and count on top', () => {
      expect(element.getAttribute('layout')).toBe('column');
      expect(element.querySelector('.search-field input')).not.toBeNull();
      expect(element.querySelectorAll('.chip-group .chip').length).toBe(4);
      expect(text(element.querySelector('[data-testid="hero-count"]'))).toBe('2 heroes');
    });

    it('leaves out the Rows/Thumbs choice and the row summaries, even if rows were chosen', () => {
      expect(element.querySelector('.view-toggle')).toBeNull();
      expect(element.querySelector('.hero-grid--rows')).toBeNull();
      expect(element.querySelector('.hero-card-summary')).toBeNull();
      expect(element.querySelector('.archetype-label')).toBeNull();
    });

    it('shows a portrait, the name and the role on each row, and marks the selected hero as the current page', () => {
      const [storm, mantis] = Array.from(element.querySelectorAll<HTMLAnchorElement>('.hero-card'));

      expect(storm.querySelector('img')).not.toBeNull();
      expect(text(storm.querySelector('.hero-card-name'))).toBe('Storm');
      expect(text(storm.querySelector('.role-pill'))).toBe('Vanguard');
      expect(storm.getAttribute('aria-current')).toBe('page');
      expect(mantis.getAttribute('aria-current')).toBeNull();
    });

    it('still emits the filter events, so a filter changes the visible rows without choosing a hero', () => {
      const roleSpy = spyOn(fixture.componentInstance.roleSelected, 'emit');
      const searchSpy = spyOn(fixture.componentInstance.searchChanged, 'emit');
      const duelist = Array.from(element.querySelectorAll<HTMLButtonElement>('.chip')).find(
        (chip) => text(chip) === 'Duelist',
      ) as HTMLButtonElement;
      const input = element.querySelector('.search-field input') as HTMLInputElement;

      duelist.click();
      input.value = 'sto';
      input.dispatchEvent(new Event('input'));

      expect(roleSpy).toHaveBeenCalledOnceWith('Duelist');
      expect(searchSpy).toHaveBeenCalledOnceWith('sto');
    });
  });

  it('is the full grid, with the Rows/Thumbs choice, by default', () => {
    expect(element.getAttribute('layout')).toBe('grid');
    expect(element.querySelector('.view-toggle')).not.toBeNull();
  });

  it('loads images beyond the first two rows lazily', () => {
    const heroes = Array.from({ length: 22 }, (_, index) => createHero(`hero-${index}`, `Hero ${index}`, 'Duelist'));
    setInputs({ heroes });
    const images = Array.from(element.querySelectorAll('.hero-image'));

    expect(images[19].getAttribute('loading')).toBeNull();
    expect(images[20].getAttribute('loading')).toBe('lazy');
  });

  it('shows fixed-size placeholders and no empty message while the roster loads', () => {
    setInputs({ heroes: [], loading: true });

    expect(element.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(element.querySelectorAll('.hero-card--placeholder').length).toBe(20);
    expect(element.querySelector('.empty-state')).toBeNull();
  });

  it('says plainly when no hero matches and offers to clear the filters', () => {
    setInputs({ heroes: [], searchTerm: 'zzz' });
    const empty = element.querySelector('.empty-state') as HTMLElement;

    expect(empty.getAttribute('role')).toBe('status');
    expect(text(empty)).toContain('No heroes match your filters.');
    expect(empty.querySelector('button')).not.toBeNull();
  });

  function createHero(id: string, name: string, role: Hero['role']): Hero {
    return {
      id,
      name,
      role,
      difficulty: 2,
      summary: `Summary of ${name}`,
      playstyle: 'Control',
      strengths: ['Team control'],
      weaknesses: ['Mobility'],
      counters: [],
      synergies: [],
      abilities: [],
      gameplayArchetypes: [{ role, label: 'Brawl', description: '', sourceTitle: '', sourceUrl: '', timestamp: '' }],
      imageUrl: `/images/heroes/${id}.png`,
    } as Hero;
  }
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Hero } from '../../heroes/hero.model';
import { heroOf } from '../../insights/hero-matchup.fixtures';
import { TeamBuilderPageComponent } from './team-builder-page.component';

const roster = [
  heroOf('angela', 'Angela', 'Vanguard'),
  heroOf('black-cat', 'Black Cat', 'Duelist'),
  heroOf('spider-man', 'Spider-Man', 'Duelist'),
  heroOf('peni-parker', 'Peni Parker', 'Vanguard'),
  heroOf('mantis', 'Mantis', 'Strategist'),
  heroOf('psylocke', 'Psylocke', 'Duelist'),
  heroOf('magik', 'Magik', 'Duelist'),
];

const six = ['Angela', 'Black Cat', 'Spider-Man', 'Peni Parker', 'Mantis', 'Psylocke'];

describe('TeamBuilderPageComponent', () => {
  let fixture: ComponentFixture<TeamBuilderPageComponent>;
  let http: HttpTestingController;
  let root: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TeamBuilderPageComponent],
      providers: [provideZonelessChangeDetection(), provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    spyOn(console, 'error');
  });

  afterEach(() => http.verify());

  /** Opens the page; `heroes` is what `/api/heroes` answers, or `'pending'` to leave it waiting. */
  async function open(heroes: Hero[] | 'pending' = roster): Promise<void> {
    fixture = TestBed.createComponent(TeamBuilderPageComponent);
    root = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();

    if (heroes !== 'pending') {
      http.expectOne('/api/heroes').flush(heroes);
    }
    await fixture.whenStable();
  }

  const text = (selector: string): string =>
    root.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const slots = (): HTMLElement[] => [...root.querySelectorAll<HTMLElement>('.slots > li')];
  const captions = (): string[] =>
    slots().map((slot) => slot.querySelector('.caption')?.textContent?.trim() ?? '');
  const names = (): string[] => slots().map((slot) => slot.querySelector('.hero-name')?.textContent?.trim() ?? '');
  const tile = (name: string): HTMLButtonElement =>
    [...root.querySelectorAll<HTMLButtonElement>('.pick')].find((pick) =>
      pick.getAttribute('aria-label')?.includes(name),
    ) as HTMLButtonElement;
  const removeButtons = (): HTMLButtonElement[] => [...root.querySelectorAll<HTMLButtonElement>('.remove')];
  const clearButton = (): HTMLButtonElement => root.querySelector('.board .action') as HTMLButtonElement;
  const announcement = (): string => text('[aria-live="polite"]');

  async function press(button: HTMLElement): Promise<void> {
    button.click();
    await fixture.whenStable();
  }

  async function pick(...heroNames: string[]): Promise<void> {
    for (const name of heroNames) {
      await press(tile(name));
    }
  }

  describe('markup', () => {
    it('is the one main region, with a single plain heading and no article', async () => {
      await open();

      expect(root.querySelector('main.team-builder.page-container--wide')).not.toBeNull();
      expect(root.querySelectorAll('h1').length).toBe(1);
      expect(text('h1')).toBe('Marvel Rivals team builder');
      expect(root.querySelector('app-page-header, article')).toBeNull();
    });

    it('lists six empty slots to start and a pool tile for each hero', async () => {
      await open();

      expect(captions()).toEqual(['P1 · Empty', 'P2 · Empty', 'P3 · Empty', 'P4 · Empty', 'P5 · Empty', 'P6 · Empty']);
      expect(root.querySelector('ol.slots')?.getAttribute('aria-label')).toBe('Your team');
      expect(text('.count')).toBe('0 of 6 chosen');
      expect(root.querySelectorAll('.pick').length).toBe(roster.length);
      expect(tile('Angela').getAttribute('aria-label')).toBe('Add Angela, Vanguard to team');
      expect(root.querySelector('.pick[aria-pressed="true"]')).toBeNull();
    });

    it('shows one state panel in place of the analysis while the team is empty, and disables Clear team', async () => {
      await open();

      expect(text('section[aria-label="Team analysis"]')).toContain('Pick up to six heroes');
      expect(root.querySelectorAll('.panels .panel').length).toBe(0);
      expect(clearButton().disabled).toBeTrue();
    });
  });

  describe('while the heroes load', () => {
    it('shows one loading panel in the pool and keeps the six slots', async () => {
      await open('pending');

      expect(text('.pool app-state-panel')).toContain('Loading heroes');
      expect(root.querySelectorAll('app-state-panel[role="status"]').length).toBe(1);
      expect(root.querySelectorAll('.pick').length).toBe(0);
      expect(slots().length).toBe(6);

      http.expectOne('/api/heroes');
    });
  });

  describe('when the heroes cannot be loaded', () => {
    it('shows an error panel with Try again, which asks again and then shows the heroes', async () => {
      await open([]);

      expect(text('.pool app-state-panel')).toContain('Heroes could not be loaded');
      expect(root.querySelectorAll('.pick').length).toBe(0);

      await press(root.querySelector('.pool app-state-panel .action') as HTMLElement);
      expect(text('.pool app-state-panel')).toContain('Loading heroes');

      http.expectOne('/api/heroes').flush(roster);
      await fixture.whenStable();

      expect(root.querySelectorAll('.pick').length).toBe(roster.length);
    });
  });

  describe('pressing a hero', () => {
    it('adds it to the first empty slot, marks the tile pressed and announces it', async () => {
      await open();
      await pick('Angela');

      expect(names()[0]).toBe('Angela');
      expect(captions()[0]).toBe('P1 · Vanguard');
      expect(tile('Angela').getAttribute('aria-pressed')).toBe('true');
      expect(tile('Angela').getAttribute('aria-label')).toBe('Remove Angela from team');
      expect(tile('Angela').textContent).toContain('✓');
      expect(text('.count')).toBe('1 of 6 chosen');
      expect(announcement()).toBe('Angela added to P1. 1 of 6 chosen.');
      expect(clearButton().disabled).toBeFalse();
    });

    it('removes it when pressed again, and keeps the tile in the pool', async () => {
      await open();
      await pick('Angela', 'Angela');

      expect(captions()[0]).toBe('P1 · Empty');
      expect(tile('Angela').getAttribute('aria-pressed')).toBe('false');
      expect(announcement()).toBe('Angela removed. 0 of 6 chosen.');
      expect(root.querySelectorAll('.pick').length).toBe(roster.length);
    });

    it('fills the first empty slot, which may lie before the last filled one', async () => {
      await open();
      await pick('Angela', 'Black Cat', 'Spider-Man');
      await press(removeButtons()[0]);
      await pick('Mantis');

      expect(names()).toEqual(['Mantis', 'Black Cat', 'Spider-Man', '', '', '']);
    });

    it('keeps focus on the tile that was pressed', async () => {
      await open();
      tile('Angela').focus();
      await press(tile('Angela'));

      expect(document.activeElement).toBe(tile('Angela'));
    });
  });

  describe('the analysis', () => {
    it('shows the summary, build signals with named meters, and notes once a hero is picked', async () => {
      await open();
      await pick('Angela', 'Mantis');

      expect(root.querySelectorAll('.panels .panel').length).toBe(3);
      expect(root.querySelector('section[aria-label="Team analysis"] app-state-panel')).toBeNull();
      expect(text('.panels h2')).toContain('Comp');
      expect(text('.panel strong')).toMatch(/^Grade: .+ · 1 Vanguard \/ 0 Duelist \/ 1 Strategist$/);
      const labels = [...root.querySelectorAll('meter')].map((meter) => meter.getAttribute('aria-label'));
      expect(labels.length).toBe(5);
      expect(labels[0]).toMatch(/^Utility \d+ of 60$/);
      expect(text('.notes')).toContain('Strengths');
      expect(text('.notes')).toContain('Risks');
    });

    it('goes back to the state panel when the team is cleared', async () => {
      await open();
      await pick('Angela');
      await press(clearButton());

      expect(text('section[aria-label="Team analysis"]')).toContain('Pick up to six heroes');
    });
  });

  describe('a full team', () => {
    it('disables the heroes left in the pool, keeps the picked ones pressable and says the team is full', async () => {
      await open();
      await pick(...six);

      expect(text('.count')).toBe('6 of 6 chosen');
      expect(tile('Magik').disabled).toBeTrue();
      expect(tile('Angela').disabled).toBeFalse();
      expect(text('.pool app-notice')).toBe('Team is full. Remove a hero to add another.');
      expect(announcement()).toContain('Team is full. Remove a hero to add another.');
    });

    it('opens the pool again when a hero is removed', async () => {
      await open();
      await pick(...six, 'Angela');

      expect(tile('Magik').disabled).toBeFalse();
      expect(root.querySelector('.pool app-notice')).toBeNull();
    });
  });

  describe('Clear team', () => {
    it('empties every slot, announces it and moves focus to the team heading', async () => {
      await open();
      await pick('Angela', 'Mantis');
      await press(clearButton());

      expect(names().every((name) => name === '')).toBeTrue();
      expect(clearButton().disabled).toBeTrue();
      expect(announcement()).toBe('Team cleared.');
      expect(document.activeElement).toBe(root.querySelector('h2'));
      expect(tile('Angela').getAttribute('aria-pressed')).toBe('false');
    });
  });

  describe('removing a hero from its slot', () => {
    it('lists the remove buttons in slot order, each named for its hero', async () => {
      await open();
      await pick('Angela', 'Mantis');

      expect(removeButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
        'Remove Angela from team',
        'Remove Mantis from team',
      ]);
    });

    it('moves focus to the next remove button', async () => {
      await open();
      await pick('Angela', 'Black Cat', 'Mantis');
      await press(removeButtons()[1]);

      expect(captions()[1]).toBe('P2 · Empty');
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Mantis from team');
    });

    it('moves focus back to the nearest remove button when none follows', async () => {
      await open();
      await pick('Angela', 'Mantis');
      await press(removeButtons()[1]);

      expect(document.activeElement?.getAttribute('aria-label')).toBe('Remove Angela from team');
    });

    it('moves focus to the team heading when the last hero goes', async () => {
      await open();
      await pick('Angela');
      await press(removeButtons()[0]);

      expect(document.activeElement).toBe(root.querySelector('h2'));
      expect(root.querySelector('h2')?.getAttribute('tabindex')).toBe('-1');
    });
  });

  describe('dragging', () => {
    function dragTo(button: HTMLElement, slot: HTMLElement): void {
      const dataTransfer = new DataTransfer();

      button.dispatchEvent(new DragEvent('dragstart', { dataTransfer }));
      slot.dispatchEvent(new DragEvent('dragover', { dataTransfer, cancelable: true }));
      slot.dispatchEvent(new DragEvent('drop', { dataTransfer, cancelable: true }));
    }

    it('places a dragged hero in the slot it is dropped on', async () => {
      await open();
      dragTo(tile('Mantis'), slots()[3]);
      await fixture.whenStable();

      expect(names()).toEqual(['', '', '', 'Mantis', '', '']);
      expect(tile('Mantis').getAttribute('aria-pressed')).toBe('true');
    });

    it('replaces the hero already in that slot, and moves a hero already in the team', async () => {
      await open();
      await pick('Angela', 'Mantis');
      dragTo(tile('Black Cat'), slots()[0]);
      dragTo(tile('Mantis'), slots()[2]);
      await fixture.whenStable();

      expect(names()).toEqual(['Black Cat', '', 'Mantis', '', '', '']);
      expect(tile('Angela').getAttribute('aria-pressed')).toBe('false');
    });
  });
});

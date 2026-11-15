import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TripleSupportGuidePageComponent } from './triple-support-guide-page.component';

describe('TripleSupportGuidePageComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(TripleSupportGuidePageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('keeps the original article attribution and visible balance limitation', () => {
    const credit = element.querySelector('.field-guide__source-credit');
    expect(credit?.textContent).toContain('Dignitas, Lawrence');
    expect(credit?.textContent).toContain('March 9, 2025');
    expect(credit?.querySelector('a')?.getAttribute('href')).toBe('https://dignitas.gg/articles/how-to-counter-the-triple-support-meta-in-marvel-rivals');
    expect(element.querySelector('.field-guide__caveat')?.textContent).toContain('confirm current ability behavior in game');
    expect(element.querySelector('#sources')?.textContent).toContain('not current matchup measurements');
  });

  it('keeps all three ordered counter plans and their original execution steps', () => {
    const sequences = Array.from(element.querySelectorAll('.counter-plan .plan-steps'), list =>
      Array.from(list.querySelectorAll('li'), item => item.textContent?.trim()),
    );
    expect(sequences).toEqual([
      [
        'Stage from more than one angle so the single Vanguard cannot mark every entry.',
        'Call one Strategist by name and commit together; split damage gives three healers time to recover.',
        'Push the first fight early, before the enemy stores multiple defensive ultimates.',
        'Leave after the elimination or forced ultimate instead of feeding the reset.',
      ],
      [
        'Track defensive support ultimates and avoid spending every offensive ultimate into the first one.',
        'Use Groot control to group the backline or wall the Vanguard away from healing sightlines.',
        'Pair the control window with immediate area or precision burst.',
        'Hold enough damage to punish the moment a defensive ultimate expires.',
      ],
      [
        'Displace the Vanguard away from the supports, or pull a support out of the healing triangle.',
        'Fight around walls and corners that interrupt line of sight between the frontline and backline.',
        'Use a low-cost ultimate to force a premium defensive response, then re-engage.',
        'Capitalize on the comp’s reduced pick pressure by taking space decisively.',
      ],
    ]);
    expect(element.querySelector('.guide-grid, .guide-tile, .guide-bullets')).toBeNull();
    expect(element.querySelector('#break-the-formation')?.textContent).toContain('follow-up still needs coordination');
  });

  it('retains the original support core and every recommended hero with their jobs', () => {
    expect(Array.from(element.querySelectorAll('.core dt'), term => term.textContent?.trim())).toEqual([
      'Luna Snow', 'Cloak & Dagger', 'Invisible Woman', 'Loki or Mantis',
    ]);
    expect(Array.from(element.querySelectorAll('.plan-heroes dt'), term => term.textContent?.trim())).toEqual([
      'Venom', 'Captain America', 'Spider-Man', 'Psylocke', 'Black Panther',
      'Groot', 'Moon Knight', 'Iron Man', 'Namor',
      'Magneto', 'Thor', 'Winter Soldier', 'Wolverine',
    ]);
    expect(element.querySelectorAll('.plan-heroes dd').length).toBe(13);
    expect(element.textContent).toContain('Hooks a target away from support sightlines.');
    expect(element.querySelectorAll('.plan-heroes[open]').length).toBe(0);
  });

  it('keeps the four-check procedure and five replay traps with a hypothetical application', () => {
    expect(Array.from(element.querySelectorAll('.fight-checks strong'), item => item.textContent)).toEqual(['Before.', 'Entry.', 'Convert.', 'Reset.']);
    expect(element.querySelectorAll('.traps li').length).toBe(5);
    expect(element.querySelector('.traps')?.textContent).toContain('Ignoring the objective');
    expect(element.querySelector('#worked-example h2')?.textContent).toContain('Hypothetical:');
    expect(element.querySelector('#worked-example')?.textContent).toContain('reset is always free');
    expect(element.querySelector('#next-match')?.textContent).toContain('Review whether teammates arrived together');
  });

  it('provides chapter targets and guide navigation without creating a second main landmark', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('.field-guide__back a')?.getAttribute('href')).toBe('/hero-guides');
    for (const link of Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
      const id = new URL(link.href).hash.slice(1);
      expect(element.querySelector(`[id="${id}"]`)).withContext(id).not.toBeNull();
    }
  });
});

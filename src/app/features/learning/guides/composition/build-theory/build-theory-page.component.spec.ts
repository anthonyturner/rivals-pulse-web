import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BuildTheoryPageComponent } from './build-theory-page.component';

describe('BuildTheoryPageComponent', () => {
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    const fixture = TestBed.createComponent(BuildTheoryPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('leaves the main landmark to the shell and keeps its title and guide breadcrumb', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
    expect(element.querySelector('nav[aria-label="Breadcrumb"] a')?.getAttribute('href')).toBe('/hero-guides');
    expect(element.querySelector('[aria-current="page"]')?.textContent).toBe('Build theory');
    expect(element.textContent).toContain('does not ask you to buy items mid-match');
  });

  it('compares the five existing plans in prose with decorative portraits instead of cards', () => {
    const names = Array.from(element.querySelectorAll('.comparison h3'), heading => heading.textContent?.trim());
    expect(names).toEqual(['Utility build', 'Damage build', 'Sustain build', 'Mobility build', 'Ultimate build']);
    expect(element.querySelector('.guide-grid, .guide-tile, .guide-bullets')).toBeNull();
    for (const section of Array.from(element.querySelectorAll('.comparison'))) {
      expect(section.querySelector('img')?.getAttribute('alt')).toBe('');
      expect(section.querySelectorAll('p').length).toBe(2);
    }
    expect(element.textContent).toContain('reserve protection for a dive');
    expect(element.textContent).toContain('not the ultimate button on its own');
  });

  it('retains the utility decision sequence and all four final questions', () => {
    const signals = Array.from(element.querySelectorAll('.signals dt'), term => term.textContent?.trim());
    expect(signals).toEqual(['Enemy win condition', 'Reserved answer', 'Timing trigger', 'Exit plan']);
    const questions = Array.from(element.querySelectorAll('.decision-questions li'), item => item.textContent?.trim());
    expect(questions).toEqual([
      'What wins this fight if I use it at the right second?',
      'What happens if I spend this cooldown early?',
      'Can my team follow up when this utility lands?',
      'Does this build solve our actual problem or just pad stats?',
    ]);
  });

  it('distinguishes a hypothetical example from a source event and provides a review focus', () => {
    expect(element.querySelector('#worked-example h2')?.textContent).toContain('Hypothetical:');
    expect(element.querySelector('#worked-example')?.textContent).toContain('reassess the plan');
    expect(element.querySelector('#next-match')?.textContent).toContain('Review one fight');
    expect(element.querySelector('iframe')).toBeNull();
  });

  it('provides a matching destination for every chapter link', () => {
    for (const link of Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'))) {
      const id = new URL(link.href).hash.slice(1);
      expect(element.querySelector(`[id="${id}"]`)).withContext(id).not.toBeNull();
    }
  });
});

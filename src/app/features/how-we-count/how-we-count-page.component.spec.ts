import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { BLENDED_PLAY_MODE_IDS, HERO_STATS_MIN_MATCHES, PLAY_MODE_IDS, PLAY_MODES } from '../../../hero-stats';
import { SHOW_PRACTICE_MODE } from '../../shared/utilities/play-modes';
import { HowWeCountPageComponent } from './how-we-count-page.component';

describe('HowWeCountPageComponent', () => {
  let fixture: ComponentFixture<HowWeCountPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HowWeCountPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HowWeCountPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const section = (id: string): string => {
    const element = page.querySelector(`#${id}`);
    expect(element).withContext(`section #${id}`).toBeTruthy();

    return (element?.textContent ?? '').replace(/\s+/g, ' ');
  };

  it('has one h1 and a labelled section for each point', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);

    for (const id of ['source', 'appearances', 'minimum', 'ranks', 'modes', 'seasons', 'tiers']) {
      const heading = page.querySelector(`#${id}-title`);

      expect(heading?.tagName).withContext(id).toBe('H2');
      expect(page.querySelector(`#${id}`)?.getAttribute('aria-labelledby')).toBe(`${id}-title`);
    }
  });

  it('says the numbers come only from Rivals Pulse overlay uploads', () => {
    expect(section('source')).toContain('Only from matches that Rivals Pulse players record with the overlay');
  });

  it('explains that a hero on both teams counts twice', () => {
    expect(section('appearances')).toContain('two appearances');
    expect(section('appearances')).toContain('win or a loss');
  });

  it('says win rate, pick rate, appearances and tiers skip matches with no result, but KDA and final hits do not', () => {
    expect(section('appearances')).toContain(
      'Win rate, pick rate, appearances and tiers use only matches that ended in a win or a loss',
    );
    expect(section('appearances')).toContain(
      'KDA and final hits are different: they are averaged over every recorded line, including those from matches with no result',
    );
  });

  it('states the minimum the stats use', () => {
    expect(section('minimum')).toContain(`at least ${HERO_STATS_MIN_MATCHES} appearances`);
    expect(section('seasons')).toContain(`reaches ${HERO_STATS_MIN_MATCHES} appearances`);
  });

  it('says every rank is blended', () => {
    expect(section('ranks')).toContain('Every rank is counted together');
  });

  it('names the modes the stats blend and the default view', () => {
    expect(BLENDED_PLAY_MODE_IDS).toEqual([PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive]);
    expect(PLAY_MODES[0].label).toBe('Quick Match and Competitive');
    expect(section('modes')).toContain('By default, Quick Match and Competitive are counted together');
  });

  it('names every mode the API can count on its own', () => {
    for (const mode of PLAY_MODES) {
      expect(section('modes')).withContext(mode.label).toContain(mode.label);
    }
  });

  it('describes the picker, the previous half-season standing in per mode, and the unknown-mode exclusion', () => {
    expect(section('modes')).toContain('Mode picker that counts one mode on its own');
    expect(section('modes')).toContain('at least one recorded match with a win or a loss');
    expect(section('modes')).toContain('the previous half-season for that mode');
    expect(section('modes')).toContain('did not say which mode');
  });

  it('says Practice is not offered exactly while the site holds it back', () => {
    const says = section('modes').includes('Practice is not offered yet');

    expect(says).withContext('keep the copy and SHOW_PRACTICE_MODE in step').toBe(!SHOW_PRACTICE_MODE);
  });

  it('explains the previous half-season standing in', () => {
    expect(section('seasons')).toContain("previous half-season's numbers instead");
  });

  it('links to the privacy notes and the community stats', () => {
    const hrefs = Array.from(page.querySelectorAll('a')).map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['/privacy', '/community']);
  });
});

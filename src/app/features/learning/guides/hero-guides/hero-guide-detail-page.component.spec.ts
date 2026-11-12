import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { HeroGuideDetailPageComponent } from './hero-guide-detail-page.component';

describe('HeroGuideDetailPageComponent', () => {
  const params = new BehaviorSubject(convertToParamMap({ heroId: 'captain-america' }));
  let fixture: ComponentFixture<HeroGuideDetailPageComponent>;
  let element: HTMLElement;

  async function open(heroId: string): Promise<void> {
    params.next(convertToParamMap({ heroId }));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    params.next(convertToParamMap({ heroId: 'captain-america' }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    fixture = TestBed.createComponent(HeroGuideDetailPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('shows the guide for the id in the address', () => {
    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Captain America');
  });

  it('follows the address when the id changes', async () => {
    await open('jubilee');

    expect(element.querySelector('h1')?.textContent?.trim()).toBe('Jubilee');
  });

  it('reads as chapters with paragraphs instead of a grid of bullet cards', () => {
    expect(element.querySelectorAll('.field-guide__chapter h2').length).toBeGreaterThan(5);
    expect(element.querySelectorAll('.field-guide__chapter p').length).toBeGreaterThan(10);
    expect(element.querySelector('.guide-tile, .guide-bullets')).toBeNull();
    expect(element.querySelector('.field-guide__framing')?.textContent).toContain('Your job.');
    expect(element.querySelector('.field-guide__source-credit')?.textContent).toContain('Paz Captain America');
  });

  it('preserves matchup teaching as labelled definitions', () => {
    const terms = Array.from(element.querySelectorAll('.field-guide__matchups dt'), term => term.textContent?.trim());
    expect(terms).toContain('Good against');
    expect(terms).toContain('Be careful into');
    expect(element.textContent).toContain('Ultron');
  });

  it('provides a matching target for every chapter link', () => {
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('app-guide-chapters a'));
    expect(links.length).toBeGreaterThan(5);
    for (const link of links) {
      const id = new URL(link.href).hash.slice(1);
      expect(element.querySelector(`[id="${id}"]`)).withContext(id).not.toBeNull();
    }
    expect(element.querySelector('details.chapters--mobile')?.hasAttribute('open')).toBeFalse();
  });

  it('shows the sourced portal example, original timestamp and a focused practice plan', async () => {
    await open('doctor-strange');
    expect(element.querySelector('#worked-example')?.textContent).toContain('defenders');
    expect(element.querySelector('#next-match')?.textContent).toContain('supports see me');
    expect(element.querySelector('#worked-example a')?.getAttribute('href')).toContain('t=1092s');
    expect(element.querySelector('iframe')?.getAttribute('src')).toContain('start=189');
    expect(element.querySelector('#sources details')?.hasAttribute('open')).toBeFalse();
    expect(element.querySelector('.field-guide__caveat')?.textContent).toContain('balance may differ');
  });

  describe('a guide built from written articles', () => {
    const pageText = () => element.textContent?.replace(/\s+/g, ' ') ?? '';
    const sourceLinks = () =>
      Array.from(element.querySelectorAll<HTMLAnchorElement>('.field-guide__source-list a'));

    beforeEach(() => open('tempo-and-ultimate-economy'));

    it('credits each source with a visible link that opens in a new tab', () => {
      expect(sourceLinks().map((link) => link.hostname)).toEqual([
        'www.xtremeps3.com',
        'metabot.gg',
        'boostroom.com',
      ]);
      for (const link of sourceLinks()) {
        expect(link.target).toBe('_blank');
        expect(link.rel).toContain('noopener');
        expect(link.textContent).toContain('opens in a new tab');
      }
    });

    it('lists Boostroom as further reading and credits no advice to it', () => {
      const boostroom = sourceLinks()[2].closest('li');

      expect(boostroom?.textContent).toContain('Further reading only');
      expect(boostroom?.textContent).toContain('nothing in this guide is based on it');
      for (const section of Array.from(element.querySelectorAll('section.field-guide__chapter'))) {
        expect(section.textContent).not.toContain('Boostroom');
      }
    });

    it('does not offer a video or claim its source is on YouTube', () => {
      expect(element.querySelector('iframe')).toBeNull();
      expect(pageText()).not.toContain('YouTube');
    });

    it('says the tempo article is about Overwatch', () => {
      expect(sourceLinks()[0].closest('li')?.textContent).toContain('about Overwatch, not Marvel Rivals');
    });

    it('describes the overlay chip as untested, with no store link', () => {
      expect(pageText()).toContain('coming soon to the Overwolf store');
      expect(pageText()).toContain('Nobody has checked it in a real match');
      expect(element.querySelector('a[href*="overwolf"]')).toBeNull();
    });
  });

  it('shows no article sources on a guide that has a video source', () => {
    expect(element.querySelector('.field-guide__source-list')).toBeNull();
  });

  it('leaves the main landmark to the shell and has an h1', () => {
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelector('h1')).not.toBeNull();
  });
});

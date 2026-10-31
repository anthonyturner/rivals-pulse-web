import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OverlayFaqPageComponent } from './overlay-faq-page.component';

describe('OverlayFaqPageComponent', () => {
  let fixture: ComponentFixture<OverlayFaqPageComponent>;
  let page: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OverlayFaqPageComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(OverlayFaqPageComponent);
    fixture.detectChanges();
    page = fixture.nativeElement as HTMLElement;
  });

  const flat = (node: Element | null): string => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const section = (id: string): HTMLElement => {
    const element = page.querySelector<HTMLElement>(`#${id}`);
    expect(element).withContext(`section #${id}`).toBeTruthy();

    return element as HTMLElement;
  };
  const hrefs = (id: string): (string | null)[] =>
    Array.from(section(id).querySelectorAll('a')).map((link) => link.getAttribute('href'));
  const sentences = (id: string): number =>
    flat(section(id).querySelector('p')).split(/(?<=\.)\s+(?=[A-Z])/).length;

  it('has one h1, and one labelled h2 section for each question', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);

    for (const id of ['ban-risk', 'data', 'overwolf']) {
      expect(page.querySelector(`#${id}-title`)?.tagName).withContext(id).toBe('H2');
      expect(section(id).getAttribute('aria-labelledby')).toBe(`${id}-title`);
    }
    expect(page.querySelectorAll('h2').length).toBe(3);
  });

  it('keeps each answer to three sentences', () => {
    for (const id of ['ban-risk', 'data', 'overwolf']) {
      expect(sentences(id)).withContext(id).toBe(3);
    }
  });

  describe('ban risk', () => {
    it('promises nothing and says NetEase has urged players to avoid third-party plugins', () => {
      const answer = flat(section('ban-risk'));

      expect(answer).toContain('We cannot promise it will not.');
      expect(answer).toContain('NetEase decides what Marvel Rivals allows');
      expect(answer).toContain('prohibit unauthorized third-party software');
      expect(answer).toContain('urged players to avoid third-party plugins');
      expect(answer).toContain('no overlay can guarantee your account is risk-free');
    });

    it('links the NetEase sources it rests on', () => {
      expect(hrefs('ban-risk')).toEqual([
        'https://store.steampowered.com/eula/2767030_eula_0',
        'https://web.archive.org/web/20250420014247/https://www.marvelrivals.com/announcements/20250220/40955_1213199.html',
        'https://www.marvelrivals.com/guide/20250226/41348_1214569.html',
      ]);
    });
  });

  describe('data', () => {
    it("points to this site's privacy notes and How we count", () => {
      expect(hrefs('data')).toEqual(['/privacy', '/how-we-count']);
      expect(flat(section('data'))).toContain('only anonymous totals');
    });

    it("does not lean on Overwolf's privacy policy", () => {
      expect(flat(section('data'))).not.toMatch(/overwolf/i);
    });
  });

  describe('Overwolf', () => {
    it('attributes the review claims to Overwolf and says it is not affiliated', () => {
      const answer = flat(section('overwolf'));

      expect(answer).toContain("Overwolf says it requires apps to follow each game's terms");
      expect(answer).toContain('not affiliated with NetEase, Marvel or Overwolf');
      expect(answer).toContain("still NetEase's decision");
    });

    it('says the app is not listed yet while there is no store URL', () => {
      expect(flat(section('overwolf'))).toContain(
        'publishes; Rivals Pulse is not listed yet, so it has not been through that review.',
      );
    });

    it('links the Overwolf sources it rests on', () => {
      expect(hrefs('overwolf')).toEqual([
        'https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/marvel-rivals',
        'https://dev.overwolf.com/ow-native/guides/game-compliance/overview',
        'https://www.overwolf.com/our-commitment',
      ]);
    });
  });

  it('never says "safe", or that NetEase approves, endorses or partners with the overlay', () => {
    expect(flat(page)).not.toMatch(
      /\bsafe\b|ban-proof|won't get banned|(approved|endorsed|partnered) (by|with)|anti-cheat|game memory|doesn't read/i,
    );
  });

  it('does not claim the overlay avoids the features NetEase called unfair', () => {
    expect(flat(page)).not.toMatch(/damage and healing|hero-ban|ultimate prediction|avoids/i);
  });
});

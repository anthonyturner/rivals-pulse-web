import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../app.routes';
import { buildBanAnswer } from '../../shared/ban-answer';
import { OverlayFaqPageComponent } from './overlay-faq-page.component';

const IDS = ['ban-risk', 'data', 'overwolf'];

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

  const button = (id: string): HTMLButtonElement => page.querySelector<HTMLButtonElement>(`#${id}-button`) as HTMLButtonElement;
  const panel = (id: string): HTMLElement => page.querySelector<HTMLElement>(`#${id}-panel`) as HTMLElement;
  const openIds = (): string[] => IDS.filter((id) => !panel(id).hidden);

  it('has one h1, and one h2 for each question holding the button that opens its panel', () => {
    expect(page.querySelectorAll('h1').length).toBe(1);

    for (const id of IDS) {
      expect(page.querySelector(`#${id}-title`)?.tagName).withContext(id).toBe('H2');
      expect(button(id).parentElement?.id).withContext(id).toBe(`${id}-title`);
      expect(button(id).getAttribute('aria-controls')).toBe(`${id}-panel`);
      expect(panel(id).getAttribute('role')).toBe('region');
      expect(panel(id).getAttribute('aria-labelledby')).toBe(`${id}-button`);
    }
    expect(page.querySelectorAll('h2').length).toBe(3);
    expect(page.querySelectorAll('main').length).toBe(0);
  });

  describe('accordion', () => {
    it('starts with only the first question open', () => {
      expect(openIds()).toEqual(['ban-risk']);
      expect(IDS.map((id) => button(id).getAttribute('aria-expanded'))).toEqual(['true', 'false', 'false']);
    });

    it('opens and closes a question on click, and lets several stay open', () => {
      button('data').click();
      fixture.detectChanges();
      button('overwolf').click();
      fixture.detectChanges();

      expect(openIds()).toEqual(IDS);
      expect(button('data').getAttribute('aria-expanded')).toBe('true');

      button('ban-risk').click();
      fixture.detectChanges();

      expect(openIds()).toEqual(['data', 'overwolf']);
    });

    it('keeps a closed answer in the page text but out of the tab order', () => {
      expect(panel('data').hidden).toBeTrue();
      expect(flat(panel('data'))).toContain('uploads each one automatically');
    });
  });

  describe('a fragment link', () => {
    const visit = async (url: string): Promise<void> => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        providers: [provideZonelessChangeDetection(), provideRouter(routes)],
      }).compileComponents();
      const harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(url, OverlayFaqPageComponent);
      await harness.fixture.whenStable();
      page = harness.routeNativeElement as HTMLElement;
    };
    const land = async (url: string, expected: string): Promise<void> => {
      await visit(url);

      expect(page.querySelector(`#${expected}-button`)).withContext(url).toBe(document.activeElement);
      expect(panel(expected).hidden).withContext(url).toBeFalse();
    };

    for (const id of IDS) {
      it(`opens #${id} and focuses its button`, () => land(`/faq#${id}`, id));
    }

    it('lands on the question when the old /overlay-faq address is used', () => land('/overlay-faq#overwolf', 'overwolf'));

    it('leaves the first question open, and takes no focus, for a fragment that is not a question', async () => {
      await visit('/faq#nope');

      expect(openIds()).toEqual(['ban-risk']);
      expect(page.contains(document.activeElement)).toBeFalse();
    });
  });

  it('keeps the data and Overwolf answers to three sentences, and the ban answer to a "No." and three', () => {
    expect(sentences('ban-risk')).toBe(4);
    for (const id of ['data', 'overwolf']) {
      expect(sentences(id)).withContext(id).toBe(3);
    }
  });

  describe('ban risk', () => {
    it('asks about RivalsPulse and answers No', () => {
      expect(flat(page.querySelector('#ban-risk-button span'))).toBe('Will RivalsPulse get me banned?');
      expect(flat(section('ban-risk').querySelector('p'))).toMatch(/^No\. /);
    });

    it('shows the answer shared with the home page, word for word', () => {
      expect(flat(section('ban-risk').querySelector('p'))).toBe(buildBanAnswer(false));
    });

    it('rests on Overwolf game events and its statement about the apps it hosts', () => {
      const answer = flat(section('ban-risk'));

      expect(answer).toContain("only through Overwolf's official Marvel Rivals game events");
      expect(answer).toContain("doesn't modify the game, inject into it, or automate anything");
      expect(answer).toContain('follow the Marvel Rivals Terms of Service');
      expect(answer).toContain("Overwolf states that apps on its platform comply with each game's terms");
      expect(answer).toContain("using them won't get you banned");
    });

    it('says the app is not on the Overwolf store yet while there is no store URL', () => {
      expect(flat(section('ban-risk').querySelector('p'))).toContain(
        "banned, though RivalsPulse isn't listed on the Overwolf store yet.",
      );
    });

    it('drops the hedging about NetEase and third-party plugins', () => {
      expect(flat(section('ban-risk'))).not.toMatch(
        /cannot promise|urged players|third-party plugins|risk-free|unauthorized/i,
      );
    });

    it('leads with the Overwolf sources and keeps the NetEase terms last', () => {
      expect(hrefs('ban-risk')).toEqual([
        'https://www.overwolf.com/our-commitment',
        'https://dev.overwolf.com/ow-native/live-game-data-gep/supported-games/marvel-rivals',
        'https://dev.overwolf.com/ow-native/guides/game-compliance/overview',
        'https://store.steampowered.com/eula/2767030_eula_0',
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
        'publishes; RivalsPulse is not listed yet, so it has not been through that review.',
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

  it('never says "safe", or that NetEase approves, endorses or partners with the app', () => {
    expect(flat(page)).not.toMatch(
      /\bsafe\b|ban-proof|won't get banned|(approved|endorsed|partnered) (by|with)|anti-cheat|game memory|doesn't read/i,
    );
  });

  it('does not claim the app avoids the features NetEase called unfair', () => {
    expect(flat(page)).not.toMatch(/damage and healing|hero-ban|ultimate prediction|avoids/i);
  });
});

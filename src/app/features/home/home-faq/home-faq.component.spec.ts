import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { HOME_FAQ, HomeFaqComponent } from './home-faq.component';

describe('HomeFaqComponent', () => {
  let fixture: ComponentFixture<HomeFaqComponent>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(HomeFaqComponent);
    element = fixture.nativeElement;
    fixture.detectChanges();
  });

  const text = (node: Element | null): string => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const item = (id: string): HTMLDetailsElement =>
    element.querySelectorAll<HTMLDetailsElement>('details')[HOME_FAQ.findIndex((entry) => entry.id === id)];

  it('is a band whose h2 names it, with five or six native disclosure items', () => {
    expect(text(element.querySelector('h2'))).toBe('Frequently asked questions');
    expect(element.querySelector('section')?.getAttribute('aria-labelledby')).toBe('home-faq-title');
    expect(element.querySelectorAll('details').length).toBeGreaterThanOrEqual(5);
    expect(element.querySelectorAll('details').length).toBeLessThanOrEqual(6);
  });

  it('gives every item a summary that is reachable from the keyboard and an answer behind it', () => {
    for (const entry of Array.from(element.querySelectorAll('details'))) {
      const summary = entry.querySelector('summary') as HTMLElement;

      expect(text(summary).length).toBeGreaterThan(0);
      expect(summary.tabIndex).toBe(0);
      expect(text(entry.querySelector('.answer')).length).toBeGreaterThan(0);
    }
  });

  it('opens the first item and leaves the others closed', () => {
    const open = Array.from(element.querySelectorAll('details')).map((entry) => entry.open);

    expect(open).toEqual(HOME_FAQ.map((_, index) => index === 0));
  });

  it('opens and closes an item from its summary', () => {
    const entry = item('ban');

    (entry.querySelector('summary') as HTMLElement).click();
    expect(entry.open).toBeTrue();
  });

  describe('the ban, data and counting answers', () => {
    const link = (id: string): HTMLAnchorElement => item(id).querySelector('a.more') as HTMLAnchorElement;

    it('link the FAQ, the privacy notes and How we count', () => {
      expect(link('ban').getAttribute('href')).toBe('/faq#ban-risk');
      expect(link('data').getAttribute('href')).toBe('/privacy');
      expect(link('counting').getAttribute('href')).toBe('/how-we-count');
    });

    it('say the ban answer the FAQ page does, without promising safety beyond it', () => {
      const answer = text(item('ban').querySelector('.answer'));

      expect(answer).toMatch(/^No\./);
      expect(answer).toContain("Overwolf's official Marvel Rivals game events");
      expect(answer).toContain("NetEase's decision");
      expect(answer).not.toMatch(/100%|guarantee|risk-free|ban-proof/i);
    });

    it('say names and ids are uploaded and never published, as the FAQ page does', () => {
      const answer = text(item('data').querySelector('.answer'));

      expect(answer).toContain('automatically');
      expect(answer).toMatch(/names and player ids/);
      expect(answer).toContain('only anonymous totals, never names or ids');
      expect(answer).not.toMatch(/only match results|no personal|nothing personal/i);
    });

    it('name no minimum, season or match count that the stats payload owns', () => {
      expect(text(item('counting').querySelector('.answer'))).not.toMatch(/\d/);
    });
  });

  it('makes no claim about autostart, hotkeys, ranks or Pulsa', () => {
    expect(text(element)).not.toMatch(/pulsa|hotkey|autostart|starts with the game|\branks?\b|premium/i);
  });
});

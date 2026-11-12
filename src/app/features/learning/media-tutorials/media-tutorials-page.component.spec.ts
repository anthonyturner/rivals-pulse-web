import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MediaTutorialsPageComponent } from './media-tutorials-page.component';
import { MEDIA_TUTORIALS, TUTORIAL_CATEGORIES } from './media-tutorials.data';

describe('MediaTutorialsPageComponent', () => {
  let fixture: ComponentFixture<MediaTutorialsPageComponent>;
  let element: HTMLElement;

  const status = () => element.querySelector('[role="status"]')?.textContent?.trim();
  const cards = () => Array.from(element.querySelectorAll<HTMLElement>('app-tutorial-card'));
  const plays = () => Array.from(element.querySelectorAll<HTMLButtonElement>('button.play'));
  const images = () => Array.from(element.querySelectorAll<HTMLImageElement>('img.play__image'));

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function search(term: string): Promise<void> {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = term;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function pickCategory(category: string): Promise<void> {
    const select = element.querySelector('select') as HTMLSelectElement;
    select.value = category;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection(), provideRouter([])] });
    fixture = TestBed.createComponent(MediaTutorialsPageComponent);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('loads no embed before a click, and leaves the main landmark to the shell', () => {
    expect(element.querySelectorAll('iframe').length).toBe(0);
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
  });

  it('shows every tutorial once, with its title, topic and link, and says how many', () => {
    expect(cards().length).toBe(MEDIA_TUTORIALS.length);
    expect(status()).toBe('19 tutorials');

    for (const tutorial of MEDIA_TUTORIALS) {
      const card = cards().find((candidate) => candidate.textContent?.includes(tutorial.title));
      const source = card?.querySelector<HTMLAnchorElement>('a[target="_blank"]');

      expect(card).withContext(tutorial.title).toBeDefined();
      expect(card?.textContent).toContain(tutorial.category);
      expect(source?.getAttribute('href')).toBe(tutorial.sourceUrl);
    }
  });

  it('leads with the first tutorial as the featured card, and groups the rest by topic in order', () => {
    const featured = element.querySelector('app-tutorial-card.featured') as HTMLElement;
    const topics = Array.from(element.querySelectorAll('h2 .chip')).map((chip) => chip.textContent?.trim());

    expect(element.querySelectorAll('app-tutorial-card.featured').length).toBe(1);
    expect(featured.querySelector('h2')?.textContent).toContain(MEDIA_TUTORIALS[0].title);
    expect(featured.querySelector('.chip')?.getAttribute('data-kind')).toBe('accent');
    expect(topics).toEqual([...TUTORIAL_CATEGORIES]);
  });

  it('tints each topic chip by its kind', () => {
    const kinds = Object.fromEntries(
      Array.from(element.querySelectorAll('h2 .chip')).map((chip) => [chip.textContent?.trim(), chip.getAttribute('data-kind')]),
    );

    expect(kinds).toEqual({
      Fundamentals: 'accent',
      Roles: 'secondary',
      Heroes: 'secondary',
      Mindset: 'accent',
      'VOD Reviews': 'tertiary',
      'Map Guides': 'tertiary',
    });
  });

  it('loads only the featured still eagerly, keeps decorative stills empty-alt and sized', () => {
    const [lead, ...rest] = images();

    expect(images().length).toBe(MEDIA_TUTORIALS.length);
    expect(lead.getAttribute('loading')).toBe('eager');
    expect(rest.every((image) => image.getAttribute('loading') === 'lazy')).toBeTrue();
    expect(images().every((image) => image.getAttribute('alt') === '' && image.getAttribute('width') === '480' && image.getAttribute('height') === '360')).toBeTrue();
    expect(lead.src).toBe(`https://i.ytimg.com/vi/${MEDIA_TUTORIALS[0].youtubeId}/hqdefault.jpg`);
  });

  it('names each play button for its video and loads a player only for the one pressed', async () => {
    const tutorial = MEDIA_TUTORIALS[2];
    const play = () => plays().find((button) => button.getAttribute('aria-label') === `Play video: ${tutorial.title}`);

    expect(play()).toBeDefined();

    play()?.click();
    await settle();
    const iframe = element.querySelector('iframe') as HTMLIFrameElement;

    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(iframe.src).toBe(`https://www.youtube-nocookie.com/embed/${tutorial.youtubeId}?autoplay=1`);
    expect(iframe.title).toBe(tutorial.title);
    expect(plays().length).toBe(MEDIA_TUTORIALS.length - 1);
    expect(play()).toBeUndefined();
    expect(document.activeElement).toBe(iframe);
  });

  it('keeps a playing lead on screen, still playing, when a search no longer matches it', async () => {
    plays()[0].click();
    await settle();
    const player = element.querySelector('iframe');

    await search('tilt');

    expect(element.querySelector('app-tutorial-card.featured iframe')).toBe(player);
    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(cards().length).toBe(2);
  });

  it('keeps a video playing further down when a filter would make it the first match', async () => {
    const heroes = MEDIA_TUTORIALS.filter((tutorial) => tutorial.category === 'Heroes');
    const play = () =>
      plays().find((button) => button.getAttribute('aria-label') === `Play video: ${heroes[0].title}`);

    play()?.click();
    await settle();
    const player = element.querySelector('iframe');

    await pickCategory('Heroes');

    expect(element.querySelector('iframe')).toBe(player);
    expect(element.querySelector('app-tutorial-card.featured iframe')).toBeNull();
    expect(element.querySelector('app-tutorial-card.featured h2')?.textContent).toContain(heroes[1].title);
  });

  it('filters by category and by tag, counting "n of 19 tutorials"', async () => {
    await pickCategory('Roles');
    expect(status()).toBe('4 of 19 tutorials');
    expect(cards().length).toBe(4);

    await pickCategory('All');
    await search('cooldowns');
    expect(status()).toBe('1 of 19 tutorials');
    expect(cards().length).toBe(1);
    expect(element.querySelectorAll('app-tutorial-card.featured').length).toBe(1);
  });

  it('shows one silent empty panel and a single live status when nothing matches', async () => {
    await search('zzzz');

    expect(status()).toBe('0 of 19 tutorials');
    expect(cards().length).toBe(0);
    expect(element.querySelector('app-state-panel')?.textContent).toContain('No tutorials match');
    expect(element.querySelectorAll('[role="status"], [aria-live]').length).toBe(1);
  });

  it('marks the external link as opening a new tab and offers guide notes only where there are some', () => {
    const external = element.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    const withNotes = MEDIA_TUTORIALS.filter((tutorial) => tutorial.guideUrl);
    const notes = Array.from(element.querySelectorAll<HTMLAnchorElement>('a')).filter((link) =>
      link.textContent?.includes('Read guide notes'),
    );

    expect(external.getAttribute('rel')).toBe('noopener');
    expect(external.querySelector('.visually-hidden')?.textContent).toContain('opens in a new tab');
    expect(notes.length).toBe(withNotes.length);
    expect(notes.length).toBeLessThan(MEDIA_TUTORIALS.length);
  });
});

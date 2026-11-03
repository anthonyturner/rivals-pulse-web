import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MediaTutorialsPageComponent } from './media-tutorials-page.component';
import { MEDIA_TUTORIALS } from './media-tutorials.data';

describe('MediaTutorialsPageComponent', () => {
  let fixture: ComponentFixture<MediaTutorialsPageComponent>;
  let element: HTMLElement;

  const status = () => element.querySelector('[role="status"]')?.textContent?.trim();
  const rows = () => Array.from(element.querySelectorAll<HTMLButtonElement>('.tutorial-list button'));
  const playerTitle = () => element.querySelector<HTMLElement>('#player-title') as HTMLElement;

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

  it('has one player, no autoplay, and leaves the main landmark to the shell', () => {
    const iframe = element.querySelector('iframe') as HTMLIFrameElement;

    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(iframe.src).toBe('https://www.youtube.com/embed/' + MEDIA_TUTORIALS[0].youtubeId);
    expect(iframe.getAttribute('allow')).not.toContain('autoplay');
    expect(element.querySelector('main')).toBeNull();
    expect(element.querySelectorAll('h1').length).toBe(1);
  });

  it('renders a new player for each pick, so Back does not step through earlier picks, still without autoplay', async () => {
    const first = element.querySelector('iframe');

    rows()[3].click();
    await settle();
    const second = element.querySelector('iframe') as HTMLIFrameElement;

    expect(element.querySelectorAll('iframe').length).toBe(1);
    expect(second).not.toBe(first);
    expect(second.src).toBe('https://www.youtube.com/embed/' + MEDIA_TUTORIALS[3].youtubeId);
    expect(second.src).not.toContain('autoplay');
    expect(second.getAttribute('allow')).not.toContain('autoplay');
  });

  it('lists every tutorial, selects the first and says how many', () => {
    expect(rows().length).toBe(MEDIA_TUTORIALS.length);
    expect(rows()[0].getAttribute('aria-current')).toBe('true');
    expect(status()).toBe('18 tutorials');
    expect(playerTitle().textContent).toContain(MEDIA_TUTORIALS[0].title);
  });

  it('swaps the player and moves focus to its title when a row is chosen', async () => {
    rows()[2].click();
    await settle();

    expect(playerTitle().textContent).toContain(MEDIA_TUTORIALS[2].title);
    expect(element.querySelector('iframe')?.title).toBe(MEDIA_TUTORIALS[2].title);
    expect(rows()[2].getAttribute('aria-current')).toBe('true');
    expect(rows()[0].getAttribute('aria-current')).toBeNull();
    expect(document.activeElement).toBe(playerTitle());
  });

  it('filters by category and by tag, counting "n of 18 tutorials"', async () => {
    await pickCategory('Roles');
    expect(status()).toBe('4 of 18 tutorials');

    await pickCategory('All');
    await search('cooldowns');
    expect(status()).toBe('1 of 18 tutorials');
    expect(rows().length).toBe(1);
  });

  it('keeps the playing tutorial when the filter hides its row', async () => {
    await search('tilt');

    expect(playerTitle().textContent).toContain(MEDIA_TUTORIALS[0].title);
    expect(rows().every((row) => row.getAttribute('aria-current') === null)).toBeTrue();
  });

  it('shows one silent empty panel and a single live status when nothing matches', async () => {
    await search('zzzz');

    expect(status()).toBe('0 of 18 tutorials');
    expect(element.querySelector('app-state-panel')?.textContent).toContain('No tutorials match');
    expect(element.querySelectorAll('[role="status"], [aria-live]').length).toBe(1);
  });

  it('marks the external link as opening a new tab and offers guide notes only where there are some', async () => {
    const external = element.querySelector('a[target="_blank"]') as HTMLAnchorElement;

    expect(external.getAttribute('rel')).toBe('noopener');
    expect(external.querySelector('.visually-hidden')?.textContent).toContain('opens in a new tab');
    expect(element.textContent).toContain('Read guide notes');

    rows()[1].click();
    await settle();

    expect(element.textContent).not.toContain('Read guide notes');
  });
});

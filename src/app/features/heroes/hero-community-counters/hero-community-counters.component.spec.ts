import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { HeroMatchups } from '../../../../contracts/hero-matchups.model';
import { matchup, matchupsOf, season } from '../../insights/hero-matchup.fixtures';
import { HeroCommunityCountersComponent } from './hero-community-counters.component';
import { waitUntil } from '../../../testing/wait-until';

const roster = [
  { id: 'hulk', name: 'Hulk', imageUrl: '/hulk.png' },
  { id: 'thor', name: 'Thor', imageUrl: '/thor.png' },
  { id: 'storm', name: 'Storm', imageUrl: '/storm.png' },
];

const readyMatchups = matchupsOf([
  matchup('hulk', 'thor', 9, 12),
  matchup('storm', 'thor', 11, 12),
  matchup('thor', 'hulk', 3, 12),
  matchup('thor', 'storm', 1, 12),
]);

describe('HeroCommunityCountersComponent', () => {
  let fixture: ComponentFixture<HeroCommunityCountersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroCommunityCountersComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroCommunityCountersComponent);
  });

  async function show(heroId: string, heroName: string, matchups: HeroMatchups | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('heroId', heroId);
    fixture.componentRef.setInput('heroName', heroName);
    fixture.componentRef.setInput('matchups', matchups);
    fixture.componentRef.setInput('roster', roster);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  const names = (root: HTMLElement, group: number): (string | undefined)[] =>
    [...root.querySelectorAll('section section')[group].querySelectorAll('.community-counters__name')].map((name) =>
      name.textContent?.trim(),
    );

  it('lists who does better than usual against the hero, and whom the hero does better than usual against, with the edge and sample', async () => {
    const root = await show('thor', 'Thor', readyMatchups);
    const text = root.textContent ?? '';

    expect(text).toContain('RivalsPulse players');
    expect(text).toContain('Half-season: Season 10.5');
    expect(names(root, 0)).toEqual(['Hulk', 'Storm']);
    expect(names(root, 1)).toEqual([]);
    expect(text).toContain('Thor does not do at least 3 points better than usual against any of the 2 heroes it has 10 or more recorded matches against.');
    expect(text).toContain('91.7%');
    expect(text).toContain('+22.7 pts vs usual');
    expect(text).toContain('Heroes that do better than usual against Thor');
    expect(text).toContain('at least 3 points above its own usual win rate');
    expect(text).toContain('12 matches');
    expect(text).not.toContain('Not enough data yet');
  });

  it('describes a record in each card tooltip', async () => {
    const root = await show('thor', 'Thor', readyMatchups);
    const titles = [...root.querySelectorAll('button[title]')].map((card) => card.getAttribute('title'));

    expect(titles[1]).toBe('Storm won 11 of 12 against Thor (91.7%) in 12 matches.');
  });

  it('names how many heroes were checked when the hero has matchups but none is a counter', async () => {
    const root = await show('thor', 'Thor', matchupsOf([matchup('thor', 'hulk', 3, 12), matchup('hulk', 'thor', 4, 12)]));
    const text = root.textContent ?? '';

    expect(text).toContain(
      'No hero does at least 3 points better against Thor than it usually does, across the 1 hero with 10 or more recorded matches against Thor.',
    );
    expect(text).toContain(
      'Thor does not do at least 3 points better than usual against any of the 1 hero it has 10 or more recorded matches against.',
    );
    expect(text).not.toContain('Not enough data yet');
  });

  it('shows "Not enough data yet", with no cards and no NaN, when no matchup qualifies anywhere', async () => {
    const root = await show('thor', 'Thor', matchupsOf([]));
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('No two heroes have faced each other in enough matches recorded by RivalsPulse players yet.');
    expect(text).toContain('once two heroes have faced each other in 10 recorded matches');
    expect(root.querySelector('ul')).toBeNull();
    expect(text).not.toMatch(/NaN|\b0\.0%|Infinity|undefined/);
  });

  it('shows "Not enough data yet" for a hero with no matchup when others have some', async () => {
    const root = await show('storm', 'Storm', matchupsOf([matchup('hulk', 'thor', 9, 12)]));
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('Storm has not faced another hero in enough matches');
    expect(root.querySelector('ul')).toBeNull();
  });

  it('shows the empty state before any half-season exists', async () => {
    const root = await show('thor', 'Thor', matchupsOf([], { halfSeason: null }));

    expect(root.textContent).toContain('Not enough data yet');
    expect(root.textContent).not.toContain('Half-season:');
  });

  it('labels the previous half-season when it stands in for the current one', async () => {
    const root = await show('thor', 'Thor', { ...readyMatchups, halfSeason: season(10), inPlaceOf: season(10.5) });
    const text = root.textContent ?? '';

    expect(text).toContain('Previous half-season.');
    expect(text).toContain("Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.");
    expect(names(root, 0)).toEqual(['Hulk', 'Storm']);
  });

  it('keeps the empty state labelled when a stand-in half-season has nothing for the hero', async () => {
    const root = await show('storm', 'Storm', {
      ...matchupsOf([matchup('hulk', 'thor', 9, 12)], { halfSeason: season(10), inPlaceOf: season(10.5) }),
    });
    const text = root.textContent ?? '';

    expect(text).toContain('(standing in for Season 10.5)');
    expect(text).toContain('yet in Season 10.');
    expect(text).not.toContain('Previous half-season.');
  });

  it('leaves out a hero the roster does not know, rather than showing a blank card', async () => {
    const root = await show('thor', 'Thor', matchupsOf([matchup('mystery', 'thor', 9, 12), matchup('hulk', 'thor', 9, 12)]));

    expect(names(root, 0)).toEqual(['Hulk']);
  });

  it('says so when the matchups could not be read, rather than showing an empty panel', async () => {
    const root = await show('thor', 'Thor', null);

    expect(root.textContent).toContain('cannot be loaded right now');
    expect(root.querySelector('ul')).toBeNull();
  });

  it('shows a loading line before the matchups answer', async () => {
    const root = await show('thor', 'Thor', undefined);

    expect(root.querySelector('[role="status"]')?.textContent).toContain('Loading');
  });

  it('keeps one live region mounted while the result changes from loading to an answer', async () => {
    const root = await show('thor', 'Thor', undefined);
    const region = root.querySelector('[role="status"]');

    expect(region?.textContent).toContain('Loading');

    fixture.componentRef.setInput('matchups', readyMatchups);
    await fixture.whenStable();

    expect(root.querySelector('[role="status"]')).toBe(region);
    expect(region?.textContent).toContain('Half-season: Season 10.5');
    expect(root.querySelectorAll('[role="status"]').length).toBe(1);
  });

  it('gives portraits empty alt text, since the hero name is written beside each one', async () => {
    const root = await show('thor', 'Thor', readyMatchups);

    expect([...root.querySelectorAll('img')].map((image) => image.getAttribute('alt'))).toEqual(['', '']);
  });

  it('describes records only: it never orders heroes to ban', async () => {
    const root = await show('thor', 'Thor', readyMatchups);

    expect(root.textContent).not.toMatch(/\bban\b|\bbans\b|banned/i);
  });

  it('shows the two matchup directions side by side when there is room', async () => {
    const root = await show('thor', 'Thor', readyMatchups);
    root.style.width = '1000px';
    const [against, record] = [...root.querySelectorAll('section section')].map((group) => group.getBoundingClientRect());

    expect(record.left).toBeGreaterThan(against.left);
    expect(record.top).toBeLessThan(against.bottom);
  });

  it('stacks the matchup directions when the panel is narrow', async () => {
    const root = await show('thor', 'Thor', readyMatchups);
    root.style.width = '520px';
    const [against, record] = [...root.querySelectorAll('section section')].map((group) => group.getBoundingClientRect());

    expect(record.left).toBe(against.left);
    expect(record.top).toBeGreaterThanOrEqual(against.bottom);
  });

  it('names the section by its heading, and links to the counter lab', async () => {
    const root = await show('thor', 'Thor', readyMatchups);
    const section = root.querySelector('section') as HTMLElement;
    const heading = root.querySelector(`#${section.getAttribute('aria-labelledby')}`);

    expect(heading?.textContent).toContain('Community matchups');
    expect(root.querySelector('.community-counters__heading p')?.textContent).toContain('Thor');
    expect(root.querySelector('a')?.getAttribute('href')).toBe('/counters?hero=thor');
  });
  describe('head-to-head', () => {
    const card = (root: HTMLElement, name: string): HTMLButtonElement =>
      [...root.querySelectorAll<HTMLButtonElement>('.community-counters__card')].find((button) =>
        button.textContent?.includes(name),
      )!;
    const dialog = (root: HTMLElement): HTMLDialogElement => root.querySelector('dialog')!;

    afterEach(() => {
      const open = fixture.nativeElement.querySelector('dialog[open]') as HTMLDialogElement | null;
      open?.close();
    });

    it('makes each card a button named after both heroes', async () => {
      const root = await show('thor', 'Thor', readyMatchups);

      expect(card(root, 'Hulk').getAttribute('aria-label')).toContain('Head-to-head: Thor vs Hulk');
      expect(dialog(root).open).toBeFalse();
    });

    it('opens the head-to-head for the selected hero, with both sides of the record', async () => {
      const root = await show('thor', 'Thor', readyMatchups);

      card(root, 'Hulk').click();
      await fixture.whenStable();

      const text = dialog(root).textContent ?? '';
      expect(dialog(root).open).toBeTrue();
      expect(text).toContain('Thor vs Hulk');
      expect(text).toContain('25.0%');
      expect(text).toContain('75.0%');
      expect(text).toContain('12 matches');
    });

    it('closes from its button and gives focus back to the card that opened it', async () => {
      const root = await show('thor', 'Thor', readyMatchups);
      const opener = card(root, 'Hulk');

      opener.focus();
      opener.click();
      await fixture.whenStable();
      root.querySelector<HTMLButtonElement>('.head-to-head__close')!.click();
      // The dialog's close event is queued as a task, not dispatched during close().
      await waitUntil(() => !dialog(root).open && dialog(root).textContent?.trim() === '', 'the dialog has closed and emptied');
      await fixture.whenStable();

      expect(dialog(root).open).toBeFalse();
      expect(dialog(root).textContent?.trim()).toBe('');
      expect(document.activeElement).toBe(opener);
    });
  });
});

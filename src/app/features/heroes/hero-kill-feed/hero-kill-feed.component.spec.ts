import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { CommunityKills } from '../../../../contracts/community-kills.model';
import { killPair, killsOf } from '../../insights/community-extended.fixtures';
import { season } from '../../insights/hero-matchup.fixtures';
import { HeroKillFeedComponent } from './hero-kill-feed.component';

const roster = [
  { id: 'hela', name: 'Hela', imageUrl: '/hela.png' },
  { id: 'hulk', name: 'Hulk', imageUrl: '/hulk.png' },
  { id: 'thor', name: 'Thor', imageUrl: '/thor.png' },
];

const ready = killsOf([
  killPair('hela', 'hulk', 100),
  killPair('hela', 'thor', 25),
  killPair('thor', 'hela', 50),
  killPair('mystery', 'hela', 250),
]);

describe('HeroKillFeedComponent', () => {
  let fixture: ComponentFixture<HeroKillFeedComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroKillFeedComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroKillFeedComponent);
  });

  async function show(heroId: string, heroName: string, kills: CommunityKills | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('heroId', heroId);
    fixture.componentRef.setInput('heroName', heroName);
    fixture.componentRef.setInput('kills', kills);
    fixture.componentRef.setInput('roster', roster);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  const names = (root: HTMLElement, group: number): (string | undefined)[] =>
    [...root.querySelectorAll('section section')[group].querySelectorAll('.kill-feed__name')].map((name) =>
      name.textContent?.trim(),
    );

  it('lists whom the hero is seen killing and who is seen killing it, with the band and the caveat', async () => {
    const root = await show('hela', 'Hela', ready);
    const text = root.textContent ?? '';

    expect(text).toContain('a separate measure');
    expect(text).toContain('Half-season: Season 10.5');
    expect(names(root, 0)).toEqual(['Hulk', 'Thor']);
    expect(names(root, 1)).toEqual(['Thor']);
    expect(text).toContain('100+ seen kills');
    expect(text).toContain('25+ seen kills');
    expect(text).toContain('miss kills that player did not see');
    expect(text).not.toContain('Not enough data yet');
    expect(text).not.toMatch(/NaN|undefined|null/);
  });

  it('leaves out a pair that names a hero the roster does not know', async () => {
    const root = await show('hela', 'Hela', ready);

    expect(names(root, 1)).not.toContain('Mystery');
    expect(root.textContent).not.toContain('250+');
  });

  it('says a hero has no kills of one side yet while the other side has some', async () => {
    const root = await show('hulk', 'Hulk', ready);

    expect(names(root, 0)).toEqual([]);
    expect(names(root, 1)).toEqual(['Hela']);
    expect(root.textContent).toContain('Hulk is not in enough kill feeds as the killer yet.');
  });

  it('shows the designed empty state, with the minimum named, for a hero in no listed pair', async () => {
    const root = await show('thor', 'Thor', killsOf([killPair('hela', 'hulk', 25)]));
    const text = root.textContent ?? '';

    expect(text).toContain('Not enough data yet');
    expect(text).toContain('Thor is not in enough kill feeds');
    expect(text).toContain('10 recorded matches');
    expect(text).toContain('at least 3 different players');
  });

  it('shows the designed empty state when no pair is listed at all', async () => {
    const root = await show('hela', 'Hela', killsOf([]));

    expect(root.textContent).toContain('Not enough data yet');
    expect(root.textContent).toContain('No hero pair is in enough kill feeds');
  });

  it('names the previous half-season when it stands in', async () => {
    const root = await show('hela', 'Hela', killsOf([killPair('hela', 'hulk')], { halfSeason: season(10), inPlaceOf: season(10.5) }));

    expect(root.textContent).toContain('Previous half-season.');
    expect(root.textContent).toContain('Season 10.5 does not have enough data yet');
  });

  it('says it is loading, and that the counters cannot be loaded, without an empty state', async () => {
    expect((await show('hela', 'Hela', undefined)).textContent).toContain('Loading');

    const failed = await show('hela', 'Hela', null);

    expect(failed.textContent).toContain('cannot be loaded right now');
    expect(failed.textContent).not.toContain('Not enough data yet');
  });
});

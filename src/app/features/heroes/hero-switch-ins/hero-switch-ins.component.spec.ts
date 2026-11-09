import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { HeroSwitchIns } from '../../../../contracts/hero-switch-ins.model';
import { season } from '../../insights/hero-matchup.fixtures';
import { overallOf, switchIn, switchInsOf } from '../../insights/hero-switch-in.fixtures';
import { HeroSwitchInsComponent } from './hero-switch-ins.component';

const roster = [
  { id: 'hulk', name: 'Hulk', imageUrl: '/hulk.png' },
  { id: 'thor', name: 'Thor', imageUrl: '/thor.png' },
  { id: 'storm', name: 'Storm', imageUrl: '/storm.png' },
];

const readySwitchIns = switchInsOf([
  switchIn('hulk', 'thor', 5, 12, overallOf(26, 40)),
  switchIn('hulk', 'storm', 7, 20),
  switchIn('storm', 'hulk', 9, 14, overallOf(12, 25)),
  switchIn('thor', 'hulk', 6, 16, overallOf(7, 20)),
  switchIn('thor', 'storm', 4, 11),
]);

describe('HeroSwitchInsComponent', () => {
  let fixture: ComponentFixture<HeroSwitchInsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeroSwitchInsComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();

    fixture = TestBed.createComponent(HeroSwitchInsComponent);
  });

  async function show(heroId: string, heroName: string, switchIns: HeroSwitchIns | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('heroId', heroId);
    fixture.componentRef.setInput('heroName', heroName);
    fixture.componentRef.setInput('switchIns', switchIns);
    fixture.componentRef.setInput('roster', roster);
    await fixture.whenStable();

    return fixture.nativeElement as HTMLElement;
  }

  /** Each row as its name, win rate and sample, which the template lays out without whitespace between them. */
  const rows = (root: HTMLElement, group: number): string[] =>
    [...root.querySelectorAll('section section')[group].querySelectorAll('.hero-switch-ins__row')].map((row) =>
      ['.hero-switch-ins__name', 'strong', 'small']
        .map((selector) => (row.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim())
        .join(' | '),
    );

  it('lists who players switched to the hero against, and what they switched to against it', async () => {
    const root = await show('hulk', 'Hulk', readySwitchIns);
    const headings = root.querySelectorAll('section section h4');

    expect(root.querySelector('h3')?.textContent?.trim()).toBe('Switch-ins');
    expect(headings[0].textContent?.trim()).toBe('Players who switched to Hulk');
    expect(headings[1].textContent?.trim()).toBe('Heroes players switch to against Hulk');
    expect(rows(root, 0)).toEqual([
      'against Storm | 35.0% | 20 switches in 20 matches. No overall record against Storm to compare.',
      'against Thor | 41.7% | 12 switches in 12 matches. Overall 65.0% in 40 matches.',
    ]);
    expect(rows(root, 1)).toEqual([
      'Thor | 37.5% | 16 switches in 16 matches. Overall 35.0% in 20 matches.',
      'Storm | 64.3% | 14 switches in 14 matches. Overall 48.0% in 25 matches.',
    ]);
  });

  it('keeps every figure in visible text, with no tooltip a keyboard or screen reader would miss', async () => {
    const root = await show('hulk', 'Hulk', readySwitchIns);

    expect(root.querySelector('[title]')).toBeNull();
  });

  it('names the half-season and explains why switch-in rates run low', async () => {
    const root = await show('hulk', 'Hulk', readySwitchIns);
    const text = root.textContent ?? '';

    expect(text).toContain('Half-season: Season 10.5');
    expect(text).toContain('so these rates run lower');
    expect(text).not.toContain('Previous half-season.');
  });

  it('says when the previous half-season stands in for the current one', async () => {
    const root = await show(
      'hulk',
      'Hulk',
      switchInsOf([switchIn('hulk', 'thor', 5, 12)], { halfSeason: season(10), inPlaceOf: season(10.5) }),
    );

    expect(root.textContent).toContain('Previous half-season.');
    expect(root.textContent).toContain('Season 10.5 does not have enough data yet');
  });

  it('says so, in the half that is empty, when the hero has switch-ins on one side only', async () => {
    const root = await show('hulk', 'Hulk', switchInsOf([switchIn('hulk', 'thor', 5, 12)]));

    expect(rows(root, 0).length).toBe(1);
    expect(rows(root, 1)).toEqual([]);
    expect(root.textContent).toContain('No one has switched to a hero against Hulk often enough yet.');
  });

  it('names the hero, and does not say to wait for overlays, when others have switch-ins but nothing involves it', async () => {
    const root = await show('storm', 'Storm', switchInsOf([switchIn('hulk', 'thor', 5, 12)]));

    expect(root.textContent).toContain('No switch-in pairing for Storm has reached 10 matches from 2 players yet.');
    expect(root.textContent).not.toContain('overlays');
    expect(root.querySelector('.hero-switch-ins__row')).toBeNull();
    expect(root.textContent).not.toContain('NaN');
  });

  it('shows the designed empty state, with the minimums, when there are no switch-ins at all', async () => {
    const root = await show('hulk', 'Hulk', switchInsOf([]));

    expect(root.textContent).toContain(
      'No switch-ins recorded yet. This fills in once RivalsPulse overlays send hero switches and a pairing reaches 10 matches from 2 players.',
    );
  });

  it('leaves out a row that names a hero the roster does not know', async () => {
    const root = await show('hulk', 'Hulk', switchInsOf([switchIn('hulk', 'nobody', 5, 12), switchIn('hulk', 'thor', 5, 12)]));

    expect(rows(root, 0).length).toBe(1);
  });

  it('says it is loading, then that it could not be read, without calling either an empty state', async () => {
    let root = await show('hulk', 'Hulk', undefined);

    expect(root.textContent).toContain('Loading RivalsPulse hero switches...');
    expect(root.textContent).not.toContain('No switch-ins recorded yet');

    root = await show('hulk', 'Hulk', null);

    expect(root.textContent).toContain('cannot be loaded right now');
    expect(root.textContent).not.toContain('No switch-ins recorded yet');
  });

  it('names its region for assistive technology', async () => {
    const root = await show('hulk', 'Hulk', readySwitchIns);
    const region = root.querySelector('.hero-switch-ins');
    const title = root.querySelector(`#${region?.getAttribute('aria-labelledby')}`);

    expect(title?.textContent?.trim()).toBe('Switch-ins');
    expect(root.querySelector('[role="status"]')).not.toBeNull();
  });
});

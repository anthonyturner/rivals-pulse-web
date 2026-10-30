import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SeasonGlanceComponent } from './season-glance.component';
import { SeasonGlanceService, type SeasonGlanceState } from './season-glance.service';

const content: SeasonGlanceState['content'] = {
  ariaLabel: 'Season 10 at a glance',
  status: { label: 'Season status', value: 'Live now' },
  latestHero: {
    label: 'Newest hero',
    name: 'Gorr The God Butcher',
    detail: 'Season 10 latest release',
    imageUrl: '/images/heroes/gorr-the-god-butcher.png',
  },
  tuning: { label: 'Latest tuning', sourceLabel: 'Official balance post' },
};

function stubState(overrides: Partial<SeasonGlanceState> = {}): SeasonGlanceState {
  return {
    content,
    topPick: {
      name: 'Jubilee',
      role: 'Strategist',
      imageUrl: '/images/heroes/jubilee.png',
      pickRate: 33.5,
    },
    seasonDateRange: 'September 11 – October 9, 2026',
    ...overrides,
  };
}

async function render(state: SeasonGlanceState): Promise<ComponentFixture<SeasonGlanceComponent>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [SeasonGlanceComponent],
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: SeasonGlanceService,
        useValue: {
          initialState: state,
          getSeasonGlance: () => of(state),
        },
      },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(SeasonGlanceComponent);
  fixture.detectChanges();

  return fixture;
}

describe('SeasonGlanceComponent', () => {
  it('shows the top pick with its rate and role', async () => {
    const fixture = await render(stubState());
    const card = fixture.nativeElement.querySelector('.top-pick-card');

    expect(card).withContext('the glance renders a top-pick card').toBeTruthy();
    expect(card.textContent).toContain('Top pick this week');
    expect(card.textContent).toContain('Jubilee');
    expect(card.textContent).toContain('33.50% pick rate');
    expect(card.textContent).toContain('Strategist');
    expect(card.textContent).toContain('all ranks');
  });

  it('no longer renders the latest-tuning card, which duplicated the news list', async () => {
    const fixture = await render(stubState());

    expect(fixture.nativeElement.textContent).not.toContain('Official balance post');
  });

  it('omits the card entirely when the tier list is unavailable', async () => {
    const fixture = await render(stubState({ topPick: null }));

    expect(fixture.nativeElement.querySelector('.top-pick-card')).toBeNull();
    // The rest of the glance still renders.
    expect(fixture.nativeElement.querySelector('.newest-hero-card')).toBeTruthy();
  });

  it('formats a pick rate to two decimal places', async () => {
    const fixture = await render(stubState());

    expect(fixture.componentInstance.formatPickRate(7.1)).toBe('7.10%');
  });
});

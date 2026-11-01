import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HomeBandComponent } from '../home-band/home-band.component';

export interface HomeFaqItem {
  id: string;
  question: string;
  /** Two sentences at most; the page behind `more` has the full account. */
  answer: string;
  more: { label: string; path: string; fragment?: string };
}

/**
 * Short forms of what /overlay-faq, /privacy and /how-we-count say, so the three never disagree: a
 * sentence here changes when its page does. The ban answer is the FAQ's, shortened; the
 * data answer says the same thing about names and ids that the FAQ and the privacy notes do. No
 * number from the stats payload (a minimum, a season, a match count) is written out here.
 */
export const HOME_FAQ: readonly HomeFaqItem[] = [
  {
    id: 'what',
    question: 'What is RivalsPulse?',
    answer:
      'An Overwolf app that runs beside Marvel Rivals and records each match you play, plus this website, which shows hero stats counted from those matches.',
    more: { label: 'How we count', path: '/how-we-count' },
  },
  {
    id: 'ban',
    question: 'Will it get me banned?',
    answer:
      "No. RivalsPulse reads match information only through Overwolf's official Marvel Rivals game events, and it doesn't modify the game, inject into it or automate anything. What the game allows is still NetEase's decision.",
    more: { label: 'Read the FAQ', path: '/overlay-faq', fragment: 'ban-risk' },
  },
  {
    id: 'data',
    question: 'What does the app send?',
    answer:
      'It uploads each match you play automatically, including the in-game names and player ids on the scoreboard. This website publishes only anonymous totals, never names or ids.',
    more: { label: 'Read the privacy notes', path: '/privacy' },
  },
  {
    id: 'app-needed',
    question: 'Do I need the app to see the stats?',
    answer:
      'No. The stats, tier list and tools on this site are free to browse without installing anything. The app is what records matches, so every match you play with it counts toward them.',
    more: { label: 'See the community stats', path: '/community' },
  },
  {
    id: 'counting',
    question: 'Where do the numbers come from?',
    answer:
      'Only from matches that RivalsPulse players record with the app, with no outside tier list or other stats site. A hero appears only once it has enough appearances, and the site says "not enough data yet" instead of guessing.',
    more: { label: 'How we count', path: '/how-we-count' },
  },
  {
    id: 'affiliation',
    question: 'Is it made by NetEase, Marvel or Overwolf?',
    answer:
      'No. RivalsPulse is an independent project, not affiliated with NetEase, Marvel or Overwolf. It is an app that runs on the Overwolf platform.',
    more: { label: 'Read the FAQ', path: '/overlay-faq', fragment: 'overwolf' },
  },
];

/** The home page's questions, as native disclosure elements so they work from the keyboard. */
@Component({
  selector: 'app-home-faq',
  imports: [HomeBandComponent, RouterLink],
  templateUrl: './home-faq.component.html',
  styleUrl: './home-faq.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeFaqComponent {
  readonly items = HOME_FAQ;
}

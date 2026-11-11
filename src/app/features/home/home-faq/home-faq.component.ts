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
 * Short forms of what /faq, /privacy and /how-we-count say, so the three never disagree: a
 * sentence here changes when its page does. The ban answer is the FAQ's, shortened; the
 * data answer says the same thing about names and ids that the FAQ and the privacy notes do. No
 * number from the stats payload (a minimum, a season, a match count) is written out here.
 */
export const HOME_FAQ: readonly HomeFaqItem[] = [
  {
    id: 'what',
    question: 'What is RivalsPulse?',
    answer:
      'An Overwolf app, not released yet, that will run beside Marvel Rivals and record each match you play, plus this website, which shows hero stats counted from those matches.',
    more: { label: 'How we count', path: '/how-we-count' },
  },
  {
    id: 'ban',
    question: 'Will it get me banned?',
    answer:
      "No. RivalsPulse reads match information only through Overwolf's official Marvel Rivals game events, and it doesn't modify the game, inject into it or automate anything. What the game allows is still NetEase's decision.",
    more: { label: 'Read the FAQ', path: '/faq', fragment: 'ban-risk' },
  },
  {
    id: 'data',
    question: 'What does the app send?',
    answer:
      "At launch it will upload each match you play automatically, including the in-game names and player ids on the scoreboard, unless you turn uploading off in the app's Settings, under Privacy. Apart from the Pulse Records page, which shows a player's name only if that player chose to show it, this website publishes only anonymous totals and never player ids.",
    more: { label: 'Read the privacy notes', path: '/privacy' },
  },
  {
    id: 'app-needed',
    question: 'Do I need the app to see the stats?',
    answer:
      'No. The stats, tier list and tools on this site are free to browse without installing anything. Once it launches, the app is what records matches, and every match it uploads counts toward them.',
    more: { label: 'See the community stats', path: '/community' },
  },
  {
    id: 'counting',
    question: 'Where do the numbers come from?',
    answer:
      'Only from matches that RivalsPulse players will record with the app, with no outside tier list or other stats site. A hero appears only once it has enough appearances from enough different players, and the site says "not enough data yet" instead of guessing.',
    more: { label: 'How we count', path: '/how-we-count' },
  },
  {
    id: 'affiliation',
    question: 'Is it made by NetEase, Marvel or Overwolf?',
    answer:
      'No. RivalsPulse is an independent project, not affiliated with NetEase, Marvel or Overwolf. It is an app that runs on the Overwolf platform.',
    more: { label: 'Read the FAQ', path: '/faq', fragment: 'overwolf' },
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

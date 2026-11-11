import { SITE_NAME } from '../../core/seo/site-meta';

export type StatsTabId = 'overview' | 'heroes' | 'roles' | 'matchups' | 'maps' | 'team-comps' | 'records';

export interface StatsTab {
  id: StatsTabId;
  label: string;
  /** The tab's path under `/stats`; empty for the overview, which is the hub's own address. */
  path: string;
  /** The page's `<h1>` while the tab is open. */
  heading: string;
  /** The page's meta description, and the line under its heading. */
  description: string;
  /**
   * False for a tab that has nothing to read yet: it reports itself as thin, so it carries no ad and
   * is kept out of search results and the sitemap until it has content.
   */
  hasContent: boolean;
}

/** The hub's tabs, in the order the tab bar lists them. */
export const STATS_TABS: readonly StatsTab[] = [
  {
    id: 'overview',
    label: 'Overview',
    path: '',
    heading: 'Marvel Rivals community stats',
    description:
      'How many matches and players RivalsPulse has counted, the game modes the community plays, how long matches last and when players win. All from anonymous overlay uploads.',
    hasContent: true,
  },
  {
    id: 'heroes',
    label: 'Heroes',
    path: 'heroes',
    heading: 'Marvel Rivals hero stats',
    description:
      'The most picked and best-winning heroes from RivalsPulse players, each hero’s damage, healing and damage blocked per minute, and every hero’s win rate and pick rate as a table or a tier list.',
    hasContent: true,
  },
  {
    id: 'roles',
    label: 'Roles',
    path: 'roles',
    heading: 'Marvel Rivals role stats',
    description:
      'Average damage, healing, damage blocked and kills for Vanguards, Duelists and Strategists, from matches RivalsPulse players uploaded.',
    hasContent: true,
  },
  {
    id: 'matchups',
    label: 'Matchups',
    path: 'matchups',
    heading: 'Marvel Rivals hero matchups',
    description:
      'The hero matchups with the clearest winning records, and the kills players saw most often, from matches RivalsPulse players uploaded.',
    hasContent: true,
  },
  {
    id: 'maps',
    label: 'Maps',
    path: 'maps',
    heading: 'Marvel Rivals map stats',
    description: 'Which maps players win and lose on most, from matches RivalsPulse players uploaded. Coming soon.',
    hasContent: false,
  },
  {
    id: 'team-comps',
    label: 'Team comps',
    path: 'team-comps',
    heading: 'Marvel Rivals team comps',
    description:
      'What RivalsPulse players are running, all ranks together: the best duos in each role, triple-support trios and line-up shapes.',
    hasContent: true,
  },
  {
    id: 'records',
    label: 'Records',
    path: 'records',
    heading: 'Pulse Records',
    description:
      'The best single matches RivalsPulse players have recorded: most kills, assists and final hits in one match, and the most damage, healing and damage blocked on one hero.',
    hasContent: true,
  },
];

export const DEFAULT_STATS_TAB: StatsTab = STATS_TABS[0];

/** The address a tab is reached at. */
export function statsTabLink(tab: StatsTab): string {
  return tab.path === '' ? '/stats' : `/stats/${tab.path}`;
}

/** The tab's page title, as the browser tab and the search result show it. */
export function statsTabTitle(tab: StatsTab): string {
  return `${tab.heading} | ${SITE_NAME}`;
}

/** The route data key that names which tab a child route is, so the page can show that tab's heading. */
export const STATS_TAB_DATA_KEY = 'statsTab';

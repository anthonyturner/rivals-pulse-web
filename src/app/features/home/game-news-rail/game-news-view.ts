import type { HomeContent } from '../home-content.model';
import { buildSeasonUpdateSpotlight, type SeasonUpdateSpotlight } from '../home-page-hero.utils';

/** How many items the rail lists in each of its lists. */
export const RAIL_LIST_SLOTS = 3;

export interface GameNewsSeason {
  heading: string;
  value: string;
  /** Empty while the half-season dates are unknown, so no date is better than a wrong one. */
  dateRange: string;
  tuning: { label: string; title: string; meta: string; url: string; linkLabel: string } | null;
}

export interface GameNewsHero {
  heading: string;
  name: string;
  detail: string;
  imageUrl: string;
}

export interface GameNewsLink {
  title: string;
  meta: string;
  url: string;
}

export interface GameNewsEvent {
  label: string;
  title: string;
}

export interface GameNewsView {
  season: GameNewsSeason | null;
  newestHero: GameNewsHero | null;
  updates: { heading: string; items: GameNewsLink[] } | null;
  spotlight: SeasonUpdateSpotlight | null;
  events: { heading: string; items: GameNewsEvent[]; sourceLabel: string; sourceUrl: string } | null;
  /** False when every block is empty, so the rail can say so instead of showing a bare heading. */
  hasNews: boolean;
}

const UPDATES_HEADING = 'Latest news and patch notes';
const EVENTS_HEADING = 'Events and rewards';

/**
 * The rail's blocks from the cached official-site content. A block with nothing to show is null and
 * collapses, rather than printing an empty heading. `seasonDateRange` comes from the hero stats.
 */
export function buildGameNewsView(content: HomeContent, seasonDateRange: string): GameNewsView {
  const glance = content.seasonGlance;
  const tuning = content.latestTuning;
  const season: GameNewsSeason | null = glance?.status
    ? {
        heading: glance.status.label,
        value: glance.status.value,
        dateRange: seasonDateRange,
        tuning:
          tuning && glance.tuning
            ? {
                label: glance.tuning.label,
                title: tuning.title,
                meta: `${tuning.date} · ${tuning.category}`,
                url: tuning.sourceUrl,
                linkLabel: glance.tuning.sourceLabel,
              }
            : null,
      }
    : null;
  const newestHero: GameNewsHero | null = glance?.latestHero?.name
    ? {
        heading: glance.latestHero.label,
        name: glance.latestHero.name,
        detail: glance.latestHero.detail,
        imageUrl: glance.latestHero.imageUrl,
      }
    : null;
  const updateItems = content.seasonUpdates.slice(0, RAIL_LIST_SLOTS).map(
    (update): GameNewsLink => ({
      title: update.title,
      meta: `${update.date} · ${update.category}`,
      url: update.sourceUrl,
    }),
  );
  const eventItems = content.seasonEvents.slice(0, RAIL_LIST_SLOTS).map(
    (event): GameNewsEvent => ({ label: event.label, title: event.title }),
  );
  const view = {
    season,
    newestHero,
    updates:
      updateItems.length > 0
        ? { heading: content.seasonDashboard?.officialUpdates.title ?? UPDATES_HEADING, items: updateItems }
        : null,
    spotlight: buildSeasonUpdateSpotlight(content),
    events:
      eventItems.length > 0
        ? {
            heading: content.seasonDashboard?.events.title ?? EVENTS_HEADING,
            items: eventItems,
            sourceLabel: content.seasonDashboard?.events.sourceLabel ?? '',
            sourceUrl: content.seasonDashboard?.events.sourceUrl ?? '',
          }
        : null,
  };

  return { ...view, hasNews: Object.values(view).some((block) => block !== null) };
}

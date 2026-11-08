import { PULSE_RECORD_CATEGORIES, type PulseRecordCategoryKey } from '../../../contracts/pulse-records.model';

/** How a board is addressed and described on the pages. The figures themselves come from `/api/records`. */
export interface PulseRecordsPage {
  key: PulseRecordCategoryKey;
  /** The last segment of the list's address, `/records/<slug>`. */
  slug: string;
  title: string;
  /** What the board ranks. */
  heading: string;
  /** The board's own page. */
  link: string;
}

const PAGE_DETAILS: Record<PulseRecordCategoryKey, Pick<PulseRecordsPage, 'slug' | 'heading'>> = {
  kills: { slug: 'kills', heading: 'Most kills in one match' },
  assists: { slug: 'assists', heading: 'Most assists in one match' },
  final_hits: { slug: 'final-hits', heading: 'Most final hits in one match' },
  damage: { slug: 'damage', heading: 'Most damage on one hero in one match' },
  healing: { slug: 'healing', heading: 'Most healing on one hero in one match' },
  blocked: { slug: 'damage-blocked', heading: 'Most damage blocked on one hero in one match' },
};

export const PULSE_RECORDS_PAGES: readonly PulseRecordsPage[] = PULSE_RECORD_CATEGORIES.map(({ key, title }) => ({
  key,
  title,
  ...PAGE_DETAILS[key],
  link: `/records/${PAGE_DETAILS[key].slug}`,
}));

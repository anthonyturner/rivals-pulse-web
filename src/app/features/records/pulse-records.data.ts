import { PULSE_RECORD_CATEGORIES, type PulseRecordCategoryKey } from '../../../contracts/pulse-records.model';

/** How a board is named and addressed on the Stats hub Records tab. The figures themselves come from `/api/records`. */
export interface PulseRecordsPage {
  key: PulseRecordCategoryKey;
  /** The list's value in the Records tab's `?category=` query. */
  slug: string;
  title: string;
}

const PAGE_DETAILS: Record<PulseRecordCategoryKey, Pick<PulseRecordsPage, 'slug'>> = {
  kills: { slug: 'kills' },
  assists: { slug: 'assists' },
  final_hits: { slug: 'final-hits' },
  damage: { slug: 'damage' },
  healing: { slug: 'healing' },
  blocked: { slug: 'damage-blocked' },
};

export const PULSE_RECORDS_PAGES: readonly PulseRecordsPage[] = PULSE_RECORD_CATEGORIES.map(({ key, title }) => ({
  key,
  title,
  ...PAGE_DETAILS[key],
}));
